"""Contracts for corpus construction, labeling, splitting, and evaluation."""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import StrEnum
from typing import Any


class AssistantIntent(StrEnum):
    SPECIES_IDENTIFICATION = "species_identification"
    SPECIES_ECOLOGY = "species_ecology"
    SPECIES_DISTRIBUTION = "species_distribution"
    SPECIES_CONSERVATION = "species_conservation"
    SPECIES_VALUE = "species_value"
    SPECIES_DESCRIPTION = "species_description"
    SCIENTIFIC_LITERATURE = "scientific_literature"
    UNSUPPORTED = "unsupported"


class DatasetPartition(StrEnum):
    TRAIN = "train"
    VALIDATION = "validation"
    TEST = "test"


@dataclass(frozen=True, slots=True)
class CorpusDocument:
    document_id: str
    entity_id: str
    entity_type: str
    section: str
    title: str
    content: str
    source_name: str
    source_url: str | None
    content_hash: str
    visibility: str = "authenticated"
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True, slots=True)
class LabeledExample:
    example_id: str
    question: str
    intent: AssistantIntent
    entity_ids: tuple[str, ...]
    relevant_document_ids: tuple[str, ...]
    expected_facts: tuple[str, ...]
    expected_citations: tuple[str, ...]
    should_abstain: bool = False


@dataclass(frozen=True, slots=True)
class DatasetSlice:
    partition: DatasetPartition
    documents: tuple[CorpusDocument, ...]
    examples: tuple[LabeledExample, ...]


@dataclass(frozen=True, slots=True)
class DatasetSplits:
    train: DatasetSlice
    validation: DatasetSlice
    test: DatasetSlice

    def all_slices(self) -> tuple[DatasetSlice, DatasetSlice, DatasetSlice]:
        return self.train, self.validation, self.test


@dataclass(frozen=True, slots=True)
class LeakageIssue:
    code: str
    message: str
    partitions: tuple[DatasetPartition, ...]
    value: str


@dataclass(frozen=True, slots=True)
class LeakageReport:
    issues: tuple[LeakageIssue, ...]

    @property
    def is_clean(self) -> bool:
        return not self.issues


@dataclass(frozen=True, slots=True)
class DatasetManifest:
    version: str
    created_at: str
    schema_version: str
    source_snapshot: str
    corpus_hash: str
    document_counts: dict[str, int]
    example_counts: dict[str, int]
    providers: tuple[str, ...]


@dataclass(frozen=True, slots=True)
class RetrievalHit:
    document: CorpusDocument
    score: float
    rank: int


@dataclass(frozen=True, slots=True)
class BaselineAnswer:
    question: str
    answer: str | None
    citations: tuple[str, ...]
    hits: tuple[RetrievalHit, ...]
    abstained: bool


@dataclass(frozen=True, slots=True)
class EvaluationReport:
    partition: DatasetPartition
    evaluated_examples: int
    recall_at_k: float
    mean_reciprocal_rank: float
    citation_precision: float
    factual_token_recall: float
    abstention_accuracy: float

