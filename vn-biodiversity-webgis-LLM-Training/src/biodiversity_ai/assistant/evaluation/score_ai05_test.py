"""Score mechanical final-test checks and create a human-review queue offline."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parents[4]
FINAL = ROOT / "artifacts" / "evaluation" / "ai05-v2" / "final-test"
CITATION = re.compile(r"\[(\d+)\]")


def _rows(path: Path) -> list[dict]:
    with path.open(encoding="utf-8") as source:
        return [json.loads(line) for line in source if line.strip()]


def _hash(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def score(input_path: Path, gold_path: Path, predictions_path: Path, output: Path) -> dict:
    if output.exists() and any(output.iterdir()):
        raise FileExistsError(f"Refusing to overwrite prior test report: {output}")
    prompts = _rows(input_path)
    gold = _rows(gold_path)
    predictions = _rows(predictions_path)
    if not prompts or not (len(prompts) == len(gold) == len(predictions)):
        raise ValueError("Input, gold, and predictions must have the same nonzero row count.")
    if len({row["example_id"] for row in prompts}) != len(prompts):
        raise ValueError("Duplicate test example_id.")

    totals = {"base": Counter(), "v2": Counter()}
    review = []
    for index, (prompt, label, prediction) in enumerate(
        zip(prompts, gold, predictions, strict=True), start=1
    ):
        ids = {row["example_id"] for row in (prompt, label, prediction)}
        if len(ids) != 1 or prompt["question"] != prediction["question"]:
            raise ValueError(f"Test row mismatch at {index}.")
        if prompt["evidence"] != prediction["evidence"]:
            raise ValueError(f"Evidence mismatch at test row {index}.")
        allowed = {int(item["number"]) for item in prompt["evidence"]}
        flags = {}
        for model_name in ("base", "v2"):
            answer = prediction[model_name]
            citations = {int(value) for value in CITATION.findall(answer)}
            model_flags = {
                "missing_citation": bool(answer.strip()) and not citations,
                "invalid_citation": bool(citations - allowed),
            }
            flags[model_name] = model_flags
            for flag, value in model_flags.items():
                totals[model_name][flag] += value
        review.append({
            "row": index,
            "example_id": prompt["example_id"],
            "intent": label["intent"],
            "question": prompt["question"],
            "evidence": prompt["evidence"],
            "expected_facts": label["expected_facts"],
            "should_abstain": label["should_abstain"],
            "base": prediction["base"],
            "v2": prediction["v2"],
            "mechanical_flags": flags,
            "human_base_factuality": None,
            "human_v2_factuality": None,
            "human_base_groundedness": None,
            "human_v2_groundedness": None,
            "human_citation_accuracy": None,
            "human_notes": "",
        })

    output.mkdir(parents=True, exist_ok=True)
    with (output / "review-cases.jsonl").open("x", encoding="utf-8", newline="\n") as target:
        for row in review:
            target.write(json.dumps(row, ensure_ascii=False) + "\n")
    report = {
        "status": "awaiting_human_factuality_review",
        "partition": "test",
        "evidence_mode": "oracle_relevant_documents",
        "examples": len(review),
        "input_sha256": _hash(input_path),
        "gold_sha256": _hash(gold_path),
        "predictions_sha256": _hash(predictions_path),
        "mechanical": {name: dict(counts) for name, counts in totals.items()},
        "limitations": [
            "Oracle evidence measures generation, not end-to-end retrieval.",
            "Citation-number validity does not establish claim support.",
            "Factual accuracy and groundedness require human review.",
        ],
    }
    (output / "metrics.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, default=FINAL / "test-inference-input.jsonl")
    parser.add_argument("--gold", type=Path, default=FINAL / "test-gold-local.jsonl")
    parser.add_argument("--predictions", type=Path, required=True)
    parser.add_argument("--output-directory", type=Path, default=FINAL / "report-v1")
    args = parser.parse_args()
    print(json.dumps(score(args.input, args.gold, args.predictions, args.output_directory),
                     ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
