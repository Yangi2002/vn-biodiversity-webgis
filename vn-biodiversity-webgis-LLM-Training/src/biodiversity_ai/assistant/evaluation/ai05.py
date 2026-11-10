"""Build a reproducible, offline review package from saved AI04 predictions.

This module does not import a model, access PostgreSQL, or call an API.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import unicodedata
import zipfile
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parents[4]
ARTIFACTS = ROOT / "artifacts"
ABSTENTION = re.compile(
    r"kh[oô]ng (?:c[oó] |c[oó] đ[uủ] |đ[uủ] )?"
    r"(?:th[oô]ng tin|d[uữ] li[eệ]u|b[aằ]ng ch[uứ]ng)"
    r"|ch[uư]a đ[uủ] (?:th[oô]ng tin|d[uữ] li[eệ]u|b[aằ]ng ch[uứ]ng)",
    re.IGNORECASE,
)
CITATION = re.compile(r"\[(\d+)\]")
WEB_NOISE = re.compile(r"web admin|documentation and reference sources|tin m[oớ]i c[aậ]p nh[aậ]t", re.IGNORECASE)


def _read_jsonl(path: Path) -> list[dict]:
    with path.open(encoding="utf-8") as source:
        return [json.loads(line) for line in source if line.strip()]


def _digest(path: Path) -> str:
    result = hashlib.sha256()
    with path.open("rb") as source:
        for block in iter(lambda: source.read(1024 * 1024), b""):
            result.update(block)
    return result.hexdigest()


def _normalized(value: str) -> str:
    value = unicodedata.normalize("NFC", value).casefold()
    return " ".join(value.split())


def _flags(answer: str, evidence: list[dict]) -> dict[str, bool]:
    citations = {int(number) for number in CITATION.findall(answer)}
    available = {int(item["number"]) for item in evidence}
    return {
        "abstained": bool(ABSTENTION.search(answer)),
        "has_citation": bool(citations),
        "invalid_citation": bool(citations - available),
    }


def _metrics(rows: list[dict], key: str) -> dict:
    totals = Counter()
    for row in rows:
        flags = _flags(row[key], row["evidence"])
        expected = bool(row["should_abstain"])
        totals["expected_abstentions"] += expected
        totals["correct_abstentions"] += expected and flags["abstained"]
        totals["false_abstentions"] += not expected and flags["abstained"]
        totals["missing_citations_on_answered"] += (
            not expected and not flags["abstained"] and not flags["has_citation"]
        )
        totals["invalid_citations"] += flags["invalid_citation"]
        totals["exact_reference_matches"] += (
            not expected and _normalized(row[key]) == _normalized(row["reference"])
        )
    return {
        "examples": len(rows),
        **{
            name: totals[name]
            for name in (
                "expected_abstentions",
                "correct_abstentions",
                "false_abstentions",
                "missing_citations_on_answered",
                "invalid_citations",
                "exact_reference_matches",
            )
        },
    }


def _check_alignment(v2: list[dict], pilot: list[dict], validation: list[dict]) -> None:
    if len(v2) != 138 or len(pilot) != 138 or len(validation) != 138:
        raise ValueError("Expected exactly 138 v2, pilot, and validation rows.")
    ids = [row["example_id"] for row in v2]
    if len(set(ids)) != len(ids):
        raise ValueError("Duplicate v2 example_id.")
    for index, (current, older, label) in enumerate(zip(v2, pilot, validation)):
        if current["example_id"] != label["example_id"]:
            raise ValueError(f"Validation example_id mismatch at row {index + 1}.")
        if any(current["question"] != row["question"] for row in (older, label)):
            raise ValueError(f"Question mismatch at row {index + 1}.")
        if current["should_abstain"] != label["should_abstain"]:
            raise ValueError(f"Abstention label mismatch at row {index + 1}.")
        for row in (older, label):
            current_ids = [item["document_id"] for item in current["evidence"]]
            other_ids = [item["document_id"] for item in row["evidence"]]
            if current_ids != other_ids:
                raise ValueError(f"Evidence mismatch at row {index + 1}.")


def build_report(
    predictions: Path,
    pilot_normal: Path,
    pilot_gaps: Path,
    validation: Path,
    retrieval: Path,
    adapter: Path,
    output_directory: Path,
) -> dict:
    inputs = (predictions, pilot_normal, pilot_gaps, validation, retrieval, adapter)
    for path in inputs:
        if not path.is_file():
            raise FileNotFoundError(path)
    v2 = _read_jsonl(predictions)
    pilot = _read_jsonl(pilot_normal) + _read_jsonl(pilot_gaps)
    labels = _read_jsonl(validation)
    _check_alignment(v2, pilot, labels)
    with retrieval.open(encoding="utf-8") as source:
        retrieval_report = json.load(source)
    if retrieval_report.get("partition") != "validation":
        raise ValueError("Retrieval report must be from validation, not test.")
    with zipfile.ZipFile(adapter) as archive:
        configs = [name for name in archive.namelist() if Path(name).name == "adapter_config.json"]
        if len(configs) != 1:
            raise ValueError("Adapter archive needs exactly one adapter_config.json.")
        adapter_config = json.loads(archive.read(configs[0]))
        if not any(Path(name).name == "adapter_model.safetensors" for name in archive.namelist()):
            raise ValueError("Adapter weights missing from archive.")

    if output_directory.exists() and any(output_directory.iterdir()):
        raise FileExistsError(f"Refusing to overwrite an existing review: {output_directory}")
    output_directory.mkdir(parents=True, exist_ok=True)

    cases = []
    for index, (current, older) in enumerate(zip(v2, pilot), start=1):
        expected = bool(current["should_abstain"])
        flags = _flags(current["v2"], current["evidence"])
        reasons = []
        if expected and not flags["abstained"]:
            reasons.append("failed_to_abstain")
        if not expected and flags["abstained"]:
            reasons.append("unexpected_abstention")
        if not expected and not flags["abstained"] and not flags["has_citation"]:
            reasons.append("missing_citation")
        if flags["invalid_citation"]:
            reasons.append("invalid_citation")
        if not expected and _normalized(current["v2"]) != _normalized(current["reference"]):
            reasons.append("differs_from_reference_review_facts")
        if any(WEB_NOISE.search(item["content"]) for item in current["evidence"]):
            reasons.append("source_contains_web_noise")
        cases.append({
            "row": index,
            "example_id": current["example_id"],
            "intent": current["intent"],
            "question": current["question"],
            "should_abstain": expected,
            "reference": current["reference"],
            "base": older["base"],
            "pilot": older["adapter"],
            "v2": current["v2"],
            "evidence": current["evidence"],
            "review_reasons": reasons,
            "human_factuality": None,
            "human_groundedness": None,
            "human_citation_accuracy": None,
            "human_notes": "",
        })

    report = {
        "status": "mechanical_review_only",
        "dataset_partition": "validation",
        "dataset_examples": len(v2),
        "model_base": adapter_config.get("base_model_name_or_path"),
        "adapter_peft_type": adapter_config.get("peft_type"),
        "adapter_rank": adapter_config.get("r"),
        "inputs_sha256": {path.name: _digest(path) for path in inputs},
        "retrieval": {
            name: retrieval_report[name]
            for name in ("dense", "hybrid", "hybrid_reranked")
        },
        "generation": {
            "base": _metrics(cases, "base"),
            "pilot": _metrics(cases, "pilot"),
            "v2": _metrics(cases, "v2"),
        },
        "review_reason_counts": dict(Counter(reason for case in cases for reason in case["review_reasons"])),
        "limitations": [
            "Exact reference match is a wording proxy, not factual accuracy.",
            "Citation-number validity does not prove the cited source supports the claim.",
            "Factuality, groundedness, hallucination, and citation accuracy require human review.",
            "These 138 examples are validation, not a sealed final test set.",
        ],
    }
    with (output_directory / "review-cases.jsonl").open("x", encoding="utf-8", newline="\n") as target:
        for case in cases:
            target.write(json.dumps(case, ensure_ascii=False) + "\n")
    (output_directory / "metrics.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    source = ARTIFACTS / "evaluation" / "ai05-v2"
    parser.add_argument("--predictions", type=Path, default=source / "ai04-v2-138.jsonl")
    parser.add_argument("--pilot-normal", type=Path, default=source / "ai04-pilot-100.jsonl")
    parser.add_argument("--pilot-gaps", type=Path, default=source / "ai04-pilot-gaps-38.jsonl")
    parser.add_argument("--validation", type=Path, default=ARTIFACTS / "sft" / "v0.1.0" / "validation-v2-review.jsonl")
    parser.add_argument("--retrieval", type=Path, default=ARTIFACTS / "rag" / "v0.1.0" / "retrieval-validation.json")
    parser.add_argument("--adapter", type=Path, default=ARTIFACTS / "models" / "qwen2.5-3b-sft-v2" / "biodiversity-sft-v2-adapter.zip")
    parser.add_argument("--output-directory", type=Path, default=source / "report-v1")
    args = parser.parse_args()
    report = build_report(args.predictions, args.pilot_normal, args.pilot_gaps,
                          args.validation, args.retrieval, args.adapter, args.output_directory)
    print(json.dumps({"output": str(args.output_directory), "generation": report["generation"]},
                     ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
