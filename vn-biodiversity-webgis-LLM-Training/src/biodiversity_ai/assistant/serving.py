"""Internal STAC inference service. No schema creation or indexing on startup."""

import hashlib
import json
import os
import re
import secrets
import threading
import time
from contextlib import asynccontextmanager
from pathlib import Path
from urllib.parse import urlparse
from uuid import uuid4

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

from biodiversity_ai.assistant.ingestion.postgres import PostgresSettings
from biodiversity_ai.assistant.retrieval import PgVectorCollection, PgVectorRetriever, PgVectorStore
from biodiversity_ai.llm import SentenceTransformerEmbedder


def web_url(value):
    if not isinstance(value, str):
        return None
    parsed = urlparse(value)
    return value if parsed.scheme in {"http", "https"} and parsed.hostname and not parsed.username else None


class Question(BaseModel):
    question: str = Field(min_length=1, max_length=2000)
    timeout_seconds: float = Field(default=540, ge=1, le=1800)


class Pipeline:
    def __init__(self):
        import torch
        from peft import PeftModel
        from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig

        release = Path(os.environ["STAC_RELEASE_DIR"])
        self.release = json.loads((release / "release.json").read_text(encoding="utf-8"))
        adapter = Path(os.environ["STAC_ADAPTER_DIR"])
        expected = self.release["adapter"]["weights_sha256"]
        with (adapter / "adapter_model.safetensors").open("rb") as stream:
            actual = hashlib.file_digest(stream, "sha256").hexdigest()
        if actual != expected:
            raise ValueError("Adapter weights do not match the release")
        config = json.loads((adapter / "adapter_config.json").read_text(encoding="utf-8"))
        if config["base_model_name_or_path"] != self.release["base_model"]["training_checkpoint"]:
            raise ValueError("Adapter base checkpoint mismatch")
        self.tokenizer = AutoTokenizer.from_pretrained(adapter, local_files_only=True)
        # Require an explicit local base path; startup never downloads model weights.
        options = {"local_files_only": True}
        if os.getenv("STAC_DEVICE", "cpu") == "cuda":
            if not torch.cuda.is_available():
                raise RuntimeError("CUDA requested but unavailable")
            options.update(device_map="auto", quantization_config=BitsAndBytesConfig(load_in_4bit=True))
        else:
            options.update(device_map="cpu", dtype=torch.float32)
        base = AutoModelForCausalLM.from_pretrained(os.environ["STAC_BASE_MODEL_DIR"], **options)
        self.model = PeftModel.from_pretrained(base, adapter, is_trainable=False).eval()
        embedder = SentenceTransformerEmbedder(os.environ["STAC_EMBEDDING_MODEL_DIR"])
        collection = PgVectorCollection(self.release["dataset"]["version"], "BAAI/bge-m3", 1024)
        self.retriever = PgVectorRetriever(
            PgVectorStore(PostgresSettings.from_env(), collection), embedder,
            partition=None if os.environ["STAC_CORPUS_PARTITION"] == "all" else os.environ["STAC_CORPUS_PARTITION"],
        )
        self.retriever.prioritize_entity = True
        self.lock = threading.Lock()

    def answer(self, question, timeout_seconds=540):
        import torch

        if not self.lock.acquire(blocking=False):
            raise HTTPException(429, "Model is busy", headers={"Retry-After": "15"})
        deadline = time.monotonic() + timeout_seconds

        def remaining():
            seconds = deadline - time.monotonic()
            if seconds <= 0:
                raise HTTPException(504, "Inference time budget exceeded")
            return seconds

        try:
            hits = self.retriever.search(question, limit=12)
            remaining()
            selected = []
            system = "Bạn là trợ lý tri thức đa dạng sinh học Việt Nam. Chỉ trả lời dựa trên bằng chứng. Nếu không đủ bằng chứng, nói rõ điều đó. Dẫn nguồn bằng ký hiệu [1], [2]."

            def messages(items):
                context = "\n\n".join(
                    f"[{i}] {h.document.title}\nNguồn: {h.document.source_url or h.document.source_name}\nNội dung: {h.document.content}"
                    for i, h in enumerate(items, 1)
                )
                return [{"role": "system", "content": system},
                        {"role": "user", "content": f"Câu hỏi: {question}\n\nBằng chứng:\n{context}"}]

            for hit in hits:
                if hit.document.section == "references":
                    continue
                trial = selected + [hit]
                if len(self.tokenizer.apply_chat_template(messages(trial), add_generation_prompt=True)) <= 1800:
                    selected = trial
                if len(selected) == 5:
                    break
            sources = [{"number": i, "document_id": h.document.document_id,
                        "title": h.document.title, "url": web_url(h.document.source_url),
                        "source_name": h.document.source_name} for i, h in enumerate(selected, 1)]
            answer = "Không đủ bằng chứng để trả lời câu hỏi này."
            finish = "no_evidence"
            if selected:
                inputs = self.tokenizer.apply_chat_template(messages(selected), add_generation_prompt=True,
                    tokenize=True, return_dict=True, return_tensors="pt").to(self.model.device)
                with torch.inference_mode():
                    output = self.model.generate(**inputs, max_new_tokens=180, do_sample=False,
                        max_time=remaining(),
                        pad_token_id=self.tokenizer.eos_token_id)
                # Never present a time-budget-truncated answer as a completed response.
                remaining()
                generated = output[0, inputs["input_ids"].shape[-1]:]
                answer = self.tokenizer.decode(generated, skip_special_tokens=True).strip()
                finish = "eos" if generated[-1].item() == self.tokenizer.eos_token_id else "token_limit"
            numbers = {int(n) for n in re.findall(r"\[(\d+)\]", answer)}
            citations = [s for s in sources if s["number"] in numbers]
            media = []
            for number, hit in enumerate(selected, 1):
                if number not in numbers:
                    continue
                # Only explicit source media metadata; never infer URLs from generated text.
                for item in hit.document.metadata.get("media", []) or []:
                    if isinstance(item, dict) and web_url(item.get("url")) and item.get("type") in {"image", "video", "audio"}:
                        media.append({"url": item["url"], "type": item["type"], "source_number": number,
                                      "license": item.get("license"), "creator": item.get("creator")})
            return {"answer": answer, "sources": sources, "citations": citations, "media": media,
                    "status": "generated" if selected else "insufficient_evidence",
                    "finish_reason": finish, "citation_numbers_valid": numbers.issubset(set(range(1, len(sources)+1))),
                    "model_version": self.release["release_version"], "model_id": self.release["model_id"],
                    "retrieval_profile": "entity_priority_dense", "request_id": str(uuid4()),
                    "retrieval_diagnostics": {"partition": os.environ["STAC_CORPUS_PARTITION"],
                        "candidates": len(hits), "selected": len(selected),
                        "document_ids": [h.document.document_id for h in selected]}}
        finally:
            self.lock.release()


@asynccontextmanager
async def lifespan(app):
    if len(os.environ.get("STAC_INTERNAL_KEY", "")) < 32:
        raise ValueError("STAC_INTERNAL_KEY must have at least 32 characters")
    app.state.pipeline = Pipeline()
    yield


app = FastAPI(lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)


@app.post("/internal/answer")
def answer(body: Question, x_stac_key: str = Header(default="")):
    if not secrets.compare_digest(x_stac_key, os.environ["STAC_INTERNAL_KEY"]):
        raise HTTPException(401, "Unauthorized")
    if not body.question.strip():
        raise HTTPException(422, "Question cannot be blank")
    return app.state.pipeline.answer(body.question.strip(), body.timeout_seconds)
