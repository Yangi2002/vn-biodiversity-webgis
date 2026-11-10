"""Prepare a locked, oracle-evidence final-test bundle without running a model.

The Kaggle input has questions and evidence only. Gold facts remain in a
separate local file and must not be uploaded with the inference input.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[4]
DATASET = ROOT / "datasets" / "v0.1.0"
OUTPUT = ROOT / "artifacts" / "evaluation" / "ai05-v2" / "final-test"


def _rows(path: Path) -> list[dict]:
    with path.open(encoding="utf-8") as source:
        return [json.loads(line) for line in source if line.strip()]


def _write_jsonl(path: Path, rows: list[dict]) -> None:
    with path.open("x", encoding="utf-8", newline="\n") as target:
        for row in rows:
            target.write(json.dumps(row, ensure_ascii=False) + "\n")


def prepare(dataset: Path, output: Path, *, limit: int = 100) -> dict:
    if limit < 1:
        raise ValueError("limit must be positive")
    if output.exists() and any(output.iterdir()):
        raise FileExistsError(f"Refusing to overwrite final-test bundle: {output}")
    manifest = json.loads((dataset / "manifest.json").read_text(encoding="utf-8"))
    examples = _rows(dataset / "test" / "examples.jsonl")
    documents = {
        row["document_id"]: row
        for row in _rows(dataset / "test" / "documents.jsonl")
    }
    selected = sorted(
        (row for row in examples if row["relevant_document_ids"]),
        key=lambda row: hashlib.sha256(row["example_id"].encode("utf-8")).hexdigest(),
    )[:limit]
    if len(selected) != limit:
        raise ValueError(f"Only {len(selected)} eligible test examples; requested {limit}.")
    if len({row["example_id"] for row in selected}) != limit:
        raise ValueError("Duplicate selected example_id.")

    prompts = []
    gold = []
    for row in selected:
        evidence = []
        for number, document_id in enumerate(row["relevant_document_ids"], start=1):
            document = documents.get(document_id)
            if document is None:
                raise ValueError(f"Missing test document: {document_id}")
            evidence.append({
                "number": number,
                "document_id": document_id,
                "title": document["title"],
                "content": document["content"],
                "source_name": document["source_name"],
                "source_url": document.get("source_url"),
            })
        prompts.append({
            "example_id": row["example_id"],
            "question": row["question"],
            "evidence": evidence,
        })
        gold.append({
            "example_id": row["example_id"],
            "intent": row["intent"],
            "entity_ids": row["entity_ids"],
            "relevant_document_ids": row["relevant_document_ids"],
            "expected_facts": row["expected_facts"],
            "expected_citations": row["expected_citations"],
            "should_abstain": row["should_abstain"],
        })

    output.mkdir(parents=True, exist_ok=True)
    input_path = output / "test-inference-input.jsonl"
    gold_path = output / "test-gold-local.jsonl"
    _write_jsonl(input_path, prompts)
    _write_jsonl(gold_path, gold)
    input_hash = hashlib.sha256(input_path.read_bytes()).hexdigest()
    selection = {
        "dataset_version": manifest["version"],
        "corpus_hash": manifest["corpus_hash"],
        "partition": "test",
        "evidence_mode": "oracle_relevant_documents",
        "selection": "lowest SHA-256(example_id), first N eligible",
        "examples": limit,
        "input_sha256": input_hash,
        "warning": (
            "Oracle-evidence generation isolates the generator. It is not "
            "an end-to-end retrieval-plus-generation score."
        ),
    }
    (output / "selection.json").write_text(
        json.dumps(selection, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    return selection


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dataset-directory", type=Path, default=DATASET)
    parser.add_argument("--output-directory", type=Path, default=OUTPUT)
    parser.add_argument("--limit", type=int, default=100)
    args = parser.parse_args()
    print(json.dumps(
        prepare(args.dataset_directory, args.output_directory, limit=args.limit),
        ensure_ascii=False, indent=2,
    ))


if __name__ == "__main__":
    main()
