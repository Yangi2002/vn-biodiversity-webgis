"""Canonical normalization and entity linking for species records."""

from __future__ import annotations

import re
import unicodedata
from collections.abc import Iterable
from typing import Any

from biodiversity_ai.assistant.contracts import (
    NormalizedSpeciesRecord,
    RawSpeciesRecord,
    ScientificEnrichment,
    SourceReference,
)

_WHITESPACE = re.compile(r"\s+")
_NAME_SEPARATOR = re.compile(r"\s*[;,|]\s*")

_SECTION_FIELDS: dict[str, tuple[str, ...]] = {
    "identification": ("dac_diem_nhan_dang", "dac_diem_bo_sung", "kich_thuoc", "mau_mo_ta"),
    "biology_ecology": ("sinh_hoc_sinh_thai", "sinh_thai", "moi_truong_song"),
    "distribution": ("phan_bo", "ban_do_phan_bo_cua_loai"),
    "conservation": ("tinh_trang", "phan_hang", "bien_phap_bao_ve"),
    "value_and_use": ("gia_tri", "cong_dung"),
    "description": ("mo_ta", "mo_ta_loai", "title_block"),
    "references": ("tai_lieu_dan",),
}


def normalize_species(
    raw: RawSpeciesRecord,
    enrichments: Iterable[ScientificEnrichment] = (),
) -> NormalizedSpeciesRecord:
    """Normalize a source row while preserving its identity and provenance."""

    enrichment_items = tuple(enrichments)
    values = raw.values
    local_scientific_names = _names(values.get("ten_latin"), values.get("list_ten_latin"))
    external_names = tuple(
        name
        for enrichment in enrichment_items
        for name in (enrichment.accepted_scientific_name, enrichment.canonical_name)
        if name
    )
    scientific_names = _unique((*local_scientific_names, *external_names))
    vietnamese_names = _names(values.get("ten_viet_nam"), values.get("list_ten_viet_nam"))

    taxonomy = _taxonomy_from_source(raw)
    for enrichment in enrichment_items:
        for rank, name in enrichment.taxonomy.items():
            normalized_name = _clean_text(name)
            if normalized_name:
                taxonomy.setdefault(_normalize_rank(rank), normalized_name)

    source_url = _clean_text(values.get("detail_url") or values.get("source_post_url"))
    references = [SourceReference(source_name=raw.key.source_table, source_url=source_url)]
    references.extend(
        SourceReference(
            source_name=enrichment.provider,
            source_url=enrichment.source_url,
            license=enrichment.license,
            accessed_at=enrichment.retrieved_at,
        )
        for enrichment in enrichment_items
    )

    return NormalizedSpeciesRecord(
        key=raw.key,
        preferred_scientific_name=_first(scientific_names),
        scientific_names=scientific_names,
        preferred_vietnamese_name=_first(vietnamese_names),
        vietnamese_names=vietnamese_names,
        taxonomy=taxonomy,
        sections=_sections(values),
        source_url=source_url,
        source_references=tuple(references),
        enrichments=enrichment_items,
    )


def normalize_lookup_key(value: str) -> str:
    """Build an accent-insensitive key for aliases without changing display text."""

    normalized = unicodedata.normalize("NFD", value)
    without_marks = "".join(char for char in normalized if unicodedata.category(char) != "Mn")
    return _WHITESPACE.sub(" ", without_marks).strip().casefold()


def _taxonomy_from_source(raw: RawSpeciesRecord) -> dict[str, str]:
    values = raw.values
    taxonomy: dict[str, str] = {}
    local_fields = {
        "class": values.get("lop_nhom") or values.get("lop"),
        "order": values.get("bo"),
        "family": values.get("ho"),
        "kingdom": values.get("gioi"),
        "phylum": values.get("nganh"),
    }
    for rank, value in local_fields.items():
        if cleaned := _clean_text(value):
            taxonomy[rank] = cleaned

    if raw.gbif_taxonomy:
        gbif_fields = {
            "kingdom": raw.gbif_taxonomy.get("kingdom"),
            "phylum": raw.gbif_taxonomy.get("phylum"),
            "class": raw.gbif_taxonomy.get("class_name"),
            "order": raw.gbif_taxonomy.get("order_name"),
            "family": raw.gbif_taxonomy.get("family"),
            "genus": raw.gbif_taxonomy.get("genus"),
            "species": raw.gbif_taxonomy.get("species"),
        }
        for rank, value in gbif_fields.items():
            if cleaned := _clean_text(value):
                taxonomy[rank] = cleaned
    return taxonomy


def _sections(values: dict[str, Any]) -> dict[str, str]:
    sections: dict[str, str] = {}
    for section, fields in _SECTION_FIELDS.items():
        parts = []
        for field in fields:
            if cleaned := _clean_text(values.get(field)):
                parts.append(cleaned)
        if parts:
            sections[section] = "\n\n".join(_unique(parts))
    return sections


def _names(primary: object, alternatives: object) -> tuple[str, ...]:
    names: list[str] = []
    for value in (primary, alternatives):
        cleaned = _clean_text(value)
        if cleaned:
            names.extend(part for part in _NAME_SEPARATOR.split(cleaned) if part)
    return _unique(names)


def _unique(values: Iterable[str]) -> tuple[str, ...]:
    seen: set[str] = set()
    result: list[str] = []
    for value in values:
        cleaned = _clean_text(value)
        if not cleaned:
            continue
        key = normalize_lookup_key(cleaned)
        if key not in seen:
            seen.add(key)
            result.append(cleaned)
    return tuple(result)


def _clean_text(value: object) -> str | None:
    if value is None:
        return None
    cleaned = _WHITESPACE.sub(" ", unicodedata.normalize("NFC", str(value))).strip()
    return cleaned or None


def _normalize_rank(rank: object) -> str:
    return str(rank).strip().casefold().replace("class_name", "class").replace("order_name", "order")


def _first(values: tuple[str, ...]) -> str | None:
    return values[0] if values else None

