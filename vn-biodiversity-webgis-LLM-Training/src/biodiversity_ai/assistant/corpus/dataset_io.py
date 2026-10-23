"""Read immutable JSONL dataset partitions produced by S3-AI02."""

from __future__ import annotations

import json
from pathlib import Path

from biodiversity_ai.assistant.contracts import (
    AssistantIntent,
    CorpusDocument,
    DatasetPartition,
    DatasetSlice,
    LabeledExample,
)


def load_dataset_slice(dataset_directory: Path, partition: DatasetPartition) -> DatasetSlice:
    partition_directory = dataset_directory / partition.value
    documents = tuple(
        _document(payload)
        for payload in _read_jsonl(partition_directory / "documents.jsonl")
    )
    examples = tuple(
        _example(payload)
        for payload in _read_jsonl(partition_directory / "examples.jsonl")
    )
    return DatasetSlice(partition=partition, documents=documents, examples=examples)


def _read_jsonl(path: Path) -> tuple[dict[str, object], ...]:
    if not path.is_file():
        raise FileNotFoundError(f"Dataset file does not exist: {path}")
    records: list[dict[str, object]] = []
    with path.open(encoding="utf-8") as source:
        for line_number, line in enumerate(source, start=1):
            if not line.strip():
                continue
            payload = json.loads(line)
            if not isinstance(payload, dict):
                raise ValueError(f"Expected an object at {path}:{line_number}.")
            records.append(payload)
    return tuple(records)


def _document(payload: dict[str, object]) -> CorpusDocument:
    metadata = payload.get("metadata")
    return CorpusDocument(
        document_id=str(payload["document_id"]),
        entity_id=str(payload["entity_id"]),
        entity_type=str(payload["entity_type"]),
        section=str(payload["section"]),
        title=str(payload["title"]),
        content=str(payload["content"]),
        source_name=str(payload["source_name"]),
        source_url=str(payload["source_url"]) if payload.get("source_url") else None,
        content_hash=str(payload["content_hash"]),
        visibility=str(payload.get("visibility", "authenticated")),
        metadata=dict(metadata) if isinstance(metadata, dict) else {},
    )


def _example(payload: dict[str, object]) -> LabeledExample:
    return LabeledExample(
        example_id=str(payload["example_id"]),
        question=str(payload["question"]),
        intent=AssistantIntent(str(payload["intent"])),
        entity_ids=_strings(payload.get("entity_ids")),
        relevant_document_ids=_strings(payload.get("relevant_document_ids")),
        expected_facts=_strings(payload.get("expected_facts")),
        expected_citations=_strings(payload.get("expected_citations")),
        should_abstain=bool(payload.get("should_abstain", False)),
    )


def _strings(value: object) -> tuple[str, ...]:
    return tuple(str(item) for item in value) if isinstance(value, list) else ()

