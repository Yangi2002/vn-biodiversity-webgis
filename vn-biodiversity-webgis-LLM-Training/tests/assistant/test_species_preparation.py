from datetime import UTC, datetime

from biodiversity_ai.assistant.contracts import (
    QualitySeverity,
    RawSpeciesRecord,
    ScientificEnrichment,
    SpeciesKey,
)
from biodiversity_ai.assistant.corpus import normalize_lookup_key, normalize_species
from biodiversity_ai.assistant.ingestion.preparation import prepare_species_records


def test_normalization_links_internal_and_external_taxonomy() -> None:
    key = SpeciesKey("animal_db_vn", "animal-1")
    raw = RawSpeciesRecord(
        key=key,
        values={
            "species_id": "animal-1",
            "ten_viet_nam": "  Voọc   chà vá chân nâu ",
            "ten_latin": "Pygathrix nemaeus",
            "list_ten_latin": "Pygathrix nemaeus; Simia nemaeus",
            "ho": "Cercopithecidae",
            "mo_ta": "Một loài linh trưởng quý hiếm.",
            "detail_url": "https://example.test/species/animal-1",
        },
    )
    enrichment = ScientificEnrichment(
        provider="GBIF",
        query="Pygathrix nemaeus",
        retrieved_at=datetime.now(UTC),
        source_url="https://api.gbif.org/v1/species/match?name=Pygathrix+nemaeus",
        payload={"usageKey": 2436481},
        accepted_scientific_name="Pygathrix nemaeus",
        taxonomy={"order": "Primates", "genus": "Pygathrix"},
    )

    normalized = normalize_species(raw, [enrichment])

    assert normalized.preferred_vietnamese_name == "Voọc chà vá chân nâu"
    assert normalized.scientific_names == ("Pygathrix nemaeus", "Simia nemaeus")
    assert normalized.taxonomy["family"] == "Cercopithecidae"
    assert normalized.taxonomy["order"] == "Primates"
    assert normalized.sections["description"] == "Một loài linh trưởng quý hiếm."


def test_lookup_key_is_case_and_accent_insensitive() -> None:
    assert normalize_lookup_key("  Voọc CHÀ VÁ  ") == "vooc cha va"


def test_quality_report_rejects_missing_scientific_name() -> None:
    raw = RawSpeciesRecord(
        key=SpeciesKey("plant_db_vn", "plant-1"),
        values={"species_id": "plant-1", "ten_viet_nam": "Cây chưa định danh"},
    )

    batch = prepare_species_records([raw])

    assert not batch.quality.is_valid
    assert batch.quality.error_count == 1
    assert any(
        issue.code == "missing_scientific_name"
        and issue.severity is QualitySeverity.ERROR
        for issue in batch.quality.issues
    )

