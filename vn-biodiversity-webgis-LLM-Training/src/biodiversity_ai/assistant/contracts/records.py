"""Shared records for the assistant data-preparation pipeline."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import StrEnum
from typing import Any

JsonObject = dict[str, Any]


class QualitySeverity(StrEnum):
    """Severity assigned to a data-quality issue."""

    ERROR = "error"
    WARNING = "warning"


@dataclass(frozen=True, slots=True)
class SpeciesKey:
    """Stable identity of a species record in the operational database."""

    source_table: str
    species_id: str

    @property
    def entity_id(self) -> str:
        return f"species:{self.source_table}:{self.species_id}"


@dataclass(frozen=True, slots=True)
class SourceReference:
    """Provenance for an internal or external piece of evidence."""

    source_name: str
    source_url: str | None = None
    author: str | None = None
    license: str | None = None
    accessed_at: datetime | None = None


@dataclass(frozen=True, slots=True)
class RawSpeciesRecord:
    """Species row extracted from PostgreSQL without destructive cleanup."""

    key: SpeciesKey
    values: JsonObject
    gbif_taxonomy: JsonObject | None = None


@dataclass(frozen=True, slots=True)
class ScientificEnrichment:
    """A provider response normalized only enough to retain provenance."""

    provider: str
    query: str
    retrieved_at: datetime
    source_url: str
    payload: JsonObject
    accepted_scientific_name: str | None = None
    canonical_name: str | None = None
    taxonomy: JsonObject = field(default_factory=dict)
    license: str | None = None


@dataclass(frozen=True, slots=True)
class ScientificPublication:
    """Scientific-paper metadata returned by a literature provider."""

    provider: str
    query: str
    retrieved_at: datetime
    title: str
    source_url: str
    retrieval_url: str
    authors: tuple[str, ...] = ()
    publication_year: int | None = None
    journal: str | None = None
    doi: str | None = None
    abstract: str | None = None
    license: str | None = None
    open_access: bool | None = None
    payload: JsonObject = field(default_factory=dict)


@dataclass(frozen=True, slots=True)
class NormalizedSpeciesRecord:
    """Canonical species record used by later corpus and labeling stages."""

    key: SpeciesKey
    preferred_scientific_name: str | None
    scientific_names: tuple[str, ...]
    preferred_vietnamese_name: str | None
    vietnamese_names: tuple[str, ...]
    taxonomy: JsonObject
    sections: JsonObject
    source_url: str | None
    source_references: tuple[SourceReference, ...]
    enrichments: tuple[ScientificEnrichment, ...]

    @property
    def entity_id(self) -> str:
        return self.key.entity_id


@dataclass(frozen=True, slots=True)
class QualityIssue:
    """One actionable issue found in a normalized record."""

    entity_id: str
    code: str
    message: str
    severity: QualitySeverity
    field: str | None = None


@dataclass(slots=True)
class QualityReport:
    """Aggregated quality result without modifying the source data."""

    checked_records: int = 0
    issues: list[QualityIssue] = field(default_factory=list)

    @property
    def error_count(self) -> int:
        return sum(issue.severity is QualitySeverity.ERROR for issue in self.issues)

    @property
    def warning_count(self) -> int:
        return sum(issue.severity is QualitySeverity.WARNING for issue in self.issues)

    @property
    def is_valid(self) -> bool:
        return self.error_count == 0

