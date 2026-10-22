"""Leakage checks and reproducible dataset version output."""

from __future__ import annotations

import hashlib
import json
from dataclasses import asdict
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from biodiversity_ai.assistant.contracts import (
    DatasetManifest,
    DatasetPartition,
    DatasetSlice,
    DatasetSplits,
    LeakageIssue,
    LeakageReport,
)
from biodiversity_ai.assistant.corpus.normalization import normalize_lookup_key


def check_dataset_leakage(splits: DatasetSplits) -> LeakageReport:
    """Detect entity, document, content, and question overlap across partitions."""

    issues: list[LeakageIssue] = []
    slices = splits.all_slices()
    for index, left in enumerate(slices):
        for right in slices[index + 1 :]:
            issues.extend(_overlap_issues(left, right))

    for dataset_slice in slices:
        document_ids = {document.document_id for document in dataset_slice.documents}
        for example in dataset_slice.examples:
            missing = set(example.relevant_document_ids) - document_ids
            for document_id in sorted(missing):
                issues.append(
                    LeakageIssue(
                        code="missing_relevant_document",
                        message="Example references a document outside its partition.",
                        partitions=(dataset_slice.partition,),
                        value=document_id,
                    )
                )
    return LeakageReport(issues=tuple(issues))


def build_manifest(
    splits: DatasetSplits,
    *,
    version: str,
    source_snapshot: str,
    providers: tuple[str, ...],
    schema_version: str = "1.0",
) -> DatasetManifest:
    """Create an immutable summary and hash for a clean dataset split."""

    leakage = check_dataset_leakage(splits)
    if not leakage.is_clean:
        raise ValueError("Cannot version a dataset with leakage issues.")
    corpus_hash = _corpus_hash(splits)
    return DatasetManifest(
        version=version,
        created_at=datetime.now(UTC).isoformat(),
        schema_version=schema_version,
        source_snapshot=source_snapshot,
        corpus_hash=corpus_hash,
        document_counts={
            dataset_slice.partition.value: len(dataset_slice.documents)
            for dataset_slice in splits.all_slices()
        },
        example_counts={
            dataset_slice.partition.value: len(dataset_slice.examples)
            for dataset_slice in splits.all_slices()
        },
        providers=providers,
    )


def write_dataset_version(
    output_root: Path,
    splits: DatasetSplits,
    manifest: DatasetManifest,
) -> Path:
    """Write JSONL partitions only after leakage checks and manifest creation."""

    output_directory = output_root / manifest.version
    if output_directory.exists():
        raise FileExistsError(f"Dataset version already exists: {output_directory}")
    output_directory.mkdir(parents=True)

    for dataset_slice in splits.all_slices():
        partition_directory = output_directory / dataset_slice.partition.value
        partition_directory.mkdir()
        _write_jsonl(partition_directory / "documents.jsonl", dataset_slice.documents)
        _write_jsonl(partition_directory / "examples.jsonl", dataset_slice.examples)

    manifest_path = output_directory / "manifest.json"
    manifest_path.write_text(
        json.dumps(_json_value(manifest), ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return output_directory


def _overlap_issues(left: DatasetSlice, right: DatasetSlice) -> list[LeakageIssue]:
    issues: list[LeakageIssue] = []
    checks = {
        "entity_overlap": (
            {document.entity_id for document in left.documents},
            {document.entity_id for document in right.documents},
        ),
        "document_overlap": (
            {document.document_id for document in left.documents},
            {document.document_id for document in right.documents},
        ),
        "content_overlap": (
            {document.content_hash for document in left.documents},
            {document.content_hash for document in right.documents},
        ),
        "question_overlap": (
            {normalize_lookup_key(example.question) for example in left.examples},
            {normalize_lookup_key(example.question) for example in right.examples},
        ),
    }
    for code, (left_values, right_values) in checks.items():
        for value in sorted(left_values & right_values):
            issues.append(
                LeakageIssue(
                    code=code,
                    message=f"{code.replace('_', ' ').title()} detected across partitions.",
                    partitions=(left.partition, right.partition),
                    value=value,
                )
            )
    return issues


def _corpus_hash(splits: DatasetSplits) -> str:
    values = [
        f"{dataset_slice.partition.value}:{document.document_id}:{document.content_hash}"
        for dataset_slice in splits.all_slices()
        for document in dataset_slice.documents
    ]
    values.extend(
        f"{dataset_slice.partition.value}:{example.example_id}"
        for dataset_slice in splits.all_slices()
        for example in dataset_slice.examples
    )
    return hashlib.sha256("\n".join(sorted(values)).encode()).hexdigest()


def _write_jsonl(path: Path, records: tuple[object, ...]) -> None:
    with path.open("x", encoding="utf-8", newline="\n") as output:
        for record in records:
            output.write(json.dumps(_json_value(record), ensure_ascii=False))
            output.write("\n")


def _json_value(value: object) -> Any:
    if hasattr(value, "__dataclass_fields__"):
        return _json_value(asdict(value))
    if isinstance(value, dict):
        return {str(key): _json_value(item) for key, item in value.items()}
    if isinstance(value, (tuple, list)):
        return [_json_value(item) for item in value]
    if isinstance(value, DatasetPartition):
        return value.value
    return value

