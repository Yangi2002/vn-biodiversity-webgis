"""Kaggle-only final-test inference with a downloaded v2 LoRA adapter.

Upload only test-inference-input.jsonl, the adapter zip, and this script.
Never upload test-gold-local.jsonl to the inference notebook.
"""

from __future__ import annotations

import argparse
import json
import zipfile
from pathlib import Path


SYSTEM = (
    "Bạn là trợ lý tri thức đa dạng sinh học Việt Nam. "
    "Chỉ trả lời dựa trên bằng chứng được cung cấp. "
    "Nếu không đủ bằng chứng, nói rõ điều đó. Dẫn nguồn bằng [1], [2]."
)


def _load_rows(path: Path) -> list[dict]:
    with path.open(encoding="utf-8") as source:
        rows = [json.loads(line) for line in source if line.strip()]
    if not rows or len({row["example_id"] for row in rows}) != len(rows):
        raise ValueError("Input must contain distinct, nonempty example IDs.")
    if any("expected_facts" in row or "approved_answer" in row for row in rows):
        raise ValueError("Gold labels must not be present in the inference input.")
    return rows


def _adapter_directory(archive_path: Path, working: Path) -> tuple[Path, str]:
    with zipfile.ZipFile(archive_path) as archive:
        configs = [name for name in archive.namelist() if Path(name).name == "adapter_config.json"]
        weights = [name for name in archive.namelist() if Path(name).name == "adapter_model.safetensors"]
        if len(configs) != 1 or len(weights) != 1:
            raise ValueError("Adapter archive needs one config and one safetensors file.")
        for info in archive.infolist():
            destination = (working / info.filename).resolve()
            if not destination.is_relative_to(working.resolve()):
                raise ValueError(f"Unsafe adapter archive path: {info.filename}")
        config = json.loads(archive.read(configs[0]))
        adapter_dir = working / Path(configs[0]).parent
        if not (adapter_dir / "adapter_model.safetensors").is_file():
            archive.extractall(working)
    return adapter_dir, config["base_model_name_or_path"]


def _messages(row: dict) -> list[dict[str, str]]:
    evidence = "\n\n".join(
        f"[{item['number']}] {item['title']}\n"
        f"Nguồn: {item.get('source_url') or item['source_name']}\n"
        f"Nội dung: {item['content']}"
        for item in row["evidence"]
    )
    return [
        {"role": "system", "content": SYSTEM},
        {"role": "user", "content": f"Câu hỏi: {row['question']}\n\nBằng chứng:\n{evidence}"},
    ]


def _generate(model, tokenizer, row: dict, torch, max_new_tokens: int) -> str:
    ids = tokenizer.apply_chat_template(
        _messages(row), add_generation_prompt=True, return_tensors="pt",
        truncation=True, max_length=1800,
    ).to(model.device)
    with torch.inference_mode():
        output = model.generate(
            input_ids=ids, max_new_tokens=max_new_tokens, do_sample=False,
            pad_token_id=tokenizer.eos_token_id,
        )
    return tokenizer.decode(output[0, ids.shape[-1]:], skip_special_tokens=True).strip()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--adapter-zip", type=Path, required=True)
    parser.add_argument("--output", type=Path, default=Path("/kaggle/working/ai05-test-predictions.jsonl"))
    parser.add_argument("--max-new-tokens", type=int, default=180)
    args = parser.parse_args()
    rows = _load_rows(args.input)
    if args.output.resolve() == args.input.resolve():
        raise ValueError("Output must differ from the input file.")

    saved = _load_rows(args.output) if args.output.exists() and args.output.stat().st_size else []
    if len(saved) > len(rows) or any(
        saved[index]["example_id"] != rows[index]["example_id"]
        for index in range(len(saved))
    ):
        raise ValueError("Existing output is not a prefix of this locked test input.")
    if len(saved) == len(rows):
        print(f"Already complete: {len(rows)}/{len(rows)}")
        return

    from unsloth import FastLanguageModel
    import torch
    from peft import PeftModel

    if not torch.cuda.is_available():
        raise RuntimeError("Enable Kaggle GPU before loading the model.")
    adapter_dir, base_name = _adapter_directory(
        args.adapter_zip, Path("/kaggle/working/ai05-adapter-extracted")
    )
    base, tokenizer = FastLanguageModel.from_pretrained(
        model_name=base_name, max_seq_length=2048, load_in_4bit=True,
    )
    model = PeftModel.from_pretrained(base, str(adapter_dir), is_trainable=False)
    FastLanguageModel.for_inference(model)
    model.eval()
    if not hasattr(model, "disable_adapter"):
        raise RuntimeError("Loaded adapter cannot be disabled for base comparison.")

    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("a", encoding="utf-8", newline="\n") as target:
        for index in range(len(saved), len(rows)):
            row = rows[index]
            with model.disable_adapter():
                base_answer = _generate(model, tokenizer, row, torch, args.max_new_tokens)
            v2_answer = _generate(model, tokenizer, row, torch, args.max_new_tokens)
            target.write(json.dumps({
                "example_id": row["example_id"],
                "question": row["question"],
                "evidence": row["evidence"],
                "base": base_answer,
                "v2": v2_answer,
            }, ensure_ascii=False) + "\n")
            target.flush()
            print(f"{index + 1}/{len(rows)}", flush=True)


if __name__ == "__main__":
    main()
