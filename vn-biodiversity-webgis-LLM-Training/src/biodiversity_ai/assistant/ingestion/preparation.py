"""Composition of normalization and quality checks without dataset export."""

from __future__ import annotations

from collections.abc import Iterable, Mapping
from dataclasses import dataclass

from biodiversity_ai.assistant.contracts import (
    NormalizedSpeciesRecord,
    QualityReport,
    RawSpeciesRecord,
    ScientificEnrichment,
    SpeciesKey,
)
from biodiversity_ai.assistant.corpus import normalize_species, validate_species_records


@dataclass(frozen=True, slots=True)
class PreparedSpeciesBatch:
    """In-memory result ready for the later corpus-building stage."""

    records: tuple[NormalizedSpeciesRecord, ...]
    quality: QualityReport


def prepare_species_records(
    raw_records: Iterable[RawSpeciesRecord],
    enrichments: Mapping[SpeciesKey, Iterable[ScientificEnrichment]] | None = None,
) -> PreparedSpeciesBatch:
    """Normalize, link enrichment by stable key, and validate a bounded batch."""

    enrichment_index = enrichments or {}
    records = tuple(
        normalize_species(raw, enrichment_index.get(raw.key, ()))
        for raw in raw_records
    )
    return PreparedSpeciesBatch(
        records=records,
        quality=validate_species_records(records),
    )

