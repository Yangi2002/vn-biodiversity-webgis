"""Compare a loaded pilot adapter with its base model on reviewed validation rows.

Call compare_validation(model, tokenizer, input_path, output_path) from Kaggle.
This module never trains or downloads a model on import.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

import torch


SYSTEM_MESSAGE = (
    "Bạn là trợ lý tri thức đa dạng sinh học Việt Nam. Chỉ trả lời dựa trên "
    "bằng chứng được cung cấp. Nếu không đủ bằng chứng, hãy nói rõ không đủ "
    "dữ liệu. Dẫn nguồn bằng ký hiệu [1], [2] cho từng thông tin liên quan."
)
ABSTENTION_MARKERS = ("không đủ dữ liệu", "chưa đủ dữ liệu", "không có đủ thông tin")


def _messages(row: dict) -> list[dict[str, str]]:
    context = "\n\n".join(
        f"[{item['number']}] {item['title']}\n"
        f"Nguồn: {item.get('source_url') or item['source_name']}\n"
        f"Nội dung: {item['content']}"
        for item in row["evidence"]
    )
    return [
        {"role": "system", "content": SYSTEM_MESSAGE},
        {"role": "user", "content": f"Câu hỏi: {row['question']}\n\nBằng chứng:\n{context}"},
    ]


def _generate(model, tokenizer, messages: list[dict[str, str]], max_new_tokens: int) -> str:
    inputs = tokenizer.apply_chat_template(
        messages, add_generation_prompt=True, return_tensors="pt",
        truncation=True, max_length=1800,
    ).to(model.device)
    with torch.inference_mode():
        output = model.generate(
            input_ids=inputs,
            max_new_tokens=max_new_tokens,
            do_sample=False,
            pad_token_id=tokenizer.eos_token_id,
        )
    return tokenizer.decode(output[0, inputs.shape[-1]:], skip_special_tokens=True).strip()


def _flags(answer: str, row: dict) -> dict[str, bool]:
    citations = {int(value) for value in re.findall(r"\[(\d+)\]", answer)}
    allowed = {int(item["number"]) for item in row["evidence"]}
    return {
        "has_valid_citation": bool(citations) and citations.issubset(allowed),
        "has_invalid_citation": bool(citations - allowed),
        "abstained": any(marker in answer.casefold() for marker in ABSTENTION_MARKERS),
    }


def compare_validation(
    model,
    tokenizer,
    input_path: str | Path,
    output_path: str | Path,
    *,
    max_new_tokens: int = 180,
) -> dict[str, object]:
    """Write each result immediately; never touch the sealed test partition."""
    with Path(input_path).open(encoding="utf-8") as source:
        rows = [json.loads(line) for line in source if line.strip()]
    if not rows or any(row.get("partition") != "validation" for row in rows):
        raise ValueError("Input must contain only reviewed validation examples.")
    if not hasattr(model, "disable_adapter"):
        raise ValueError("Load the pilot adapter first; model.disable_adapter() is required.")
    output = Path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)
    if output.exists():
        raise FileExistsError(f"Refusing to overwrite comparison: {output}")
    model.eval()
    counts = {"examples": 0, "abstention_examples": 0,
              "base_valid_citations": 0, "adapter_valid_citations": 0,
              "base_expected_abstentions": 0, "adapter_expected_abstentions": 0,
              "base_unwanted_abstentions": 0, "adapter_unwanted_abstentions": 0}
    with output.open("x", encoding="utf-8", newline="\n") as destination:
        for row in rows:
            messages = _messages(row)
            with model.disable_adapter():
                base = _generate(model, tokenizer, messages, max_new_tokens)
            tuned = _generate(model, tokenizer, messages, max_new_tokens)
            base_flags = _flags(base, row)
            tuned_flags = _flags(tuned, row)
            abstain = bool(row.get("should_abstain"))
            counts["examples"] += 1
            counts["abstention_examples"] += abstain
            for name, flags in (("base", base_flags), ("adapter", tuned_flags)):
                counts[f"{name}_valid_citations"] += flags["has_valid_citation"]
                counts[f"{name}_expected_abstentions"] += abstain and flags["abstained"]
                counts[f"{name}_unwanted_abstentions"] += not abstain and flags["abstained"]
            destination.write(json.dumps({
                "example_id": row["example_id"],
                "intent": row["intent"],
                "question": row["question"],
                "reference": row["approved_answer"],
                "should_abstain": abstain,
                "evidence": row["evidence"],
                "base": base,
                "adapter": tuned,
                "base_flags": base_flags,
                "adapter_flags": tuned_flags,
                "human_verdict": None,
            }, ensure_ascii=False) + "\n")
            destination.flush()
            print(f"Compared {counts['examples']}/{len(rows)}: {row['example_id']}", flush=True)
    summary = {**counts, "output": str(output),
               "note": "Citation validity is mechanical; factuality requires manual review."}
    summary_path = output.with_suffix(".summary.json")
    summary_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    return summary
