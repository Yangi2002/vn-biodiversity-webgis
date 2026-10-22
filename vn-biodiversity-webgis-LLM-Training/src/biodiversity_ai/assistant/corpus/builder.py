"""Build deterministic retrieval documents from normalized records."""

from __future__ import annotations

import hashlib
from collections.abc import Mapping, Sequence

from biodiversity_ai.assistant.contracts import (
    CorpusDocument,
    NormalizedSpeciesRecord,
    ScientificPublication,
    SpeciesKey,
)


def build_species_corpus(
    records: Sequence[NormalizedSpeciesRecord],
    publications: Mapping[SpeciesKey, Sequence[ScientificPublication]] | None = None,
    *,
    visibility: str = "authenticated",
) -> tuple[CorpusDocument, ...]:
    """Create section-aware documents without changing PostgreSQL source records."""

    publication_index = publications or {}
    documents: list[CorpusDocument] = []
    for record in records:
        display_name = (
            record.preferred_vietnamese_name
            or record.preferred_scientific_name
            or record.entity_id
        )
        scientific_name = record.preferred_scientific_name
        source_name = record.source_references[0].source_name

        for section, content in record.sections.items():
            document_id = _stable_id(record.entity_id, section)
            documents.append(
                CorpusDocument(
                    document_id=document_id,
                    entity_id=record.entity_id,
                    entity_type="species",
                    section=section,
                    title=f"{display_name} - {section}",
                    content=_document_content(display_name, scientific_name, content),
                    source_name=source_name,
                    source_url=record.source_url,
                    content_hash=_content_hash(content),
                    visibility=visibility,
                    metadata={
                        "source_table": record.key.source_table,
                        "species_id": record.key.species_id,
                        "scientific_name": scientific_name,
                        "vietnamese_name": record.preferred_vietnamese_name,
                        "taxonomy": dict(record.taxonomy),
                    },
                )
            )

        for publication in publication_index.get(record.key, ()):
            if not publication.abstract:
                continue
            publication_key = publication.doi or publication.source_url
            section = "scientific_literature"
            documents.append(
                CorpusDocument(
                    document_id=_stable_id(record.entity_id, section, publication_key),
                    entity_id=record.entity_id,
                    entity_type="species",
                    section=section,
                    title=publication.title,
                    content=_document_content(
                        display_name,
                        scientific_name,
                        publication.abstract,
                    ),
                    source_name=publication.provider,
                    source_url=publication.source_url,
                    content_hash=_content_hash(publication.abstract),
                    visibility=visibility,
                    metadata={
                        "doi": publication.doi,
                        "journal": publication.journal,
                        "publication_year": publication.publication_year,
                        "authors": list(publication.authors),
                        "license": publication.license,
                        "open_access": publication.open_access,
                    },
                )
            )
    return tuple(documents)


def _document_content(
    display_name: str,
    scientific_name: str | None,
    content: str,
) -> str:
    heading = display_name
    if scientific_name and scientific_name.casefold() != display_name.casefold():
        heading = f"{display_name} ({scientific_name})"
    return f"{heading}\n{content.strip()}"


def _stable_id(*parts: str) -> str:
    value = "|".join(parts).encode("utf-8")
    return f"doc-{hashlib.sha256(value).hexdigest()[:20]}"


def _content_hash(content: str) -> str:
    normalized = " ".join(content.casefold().split())
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()

