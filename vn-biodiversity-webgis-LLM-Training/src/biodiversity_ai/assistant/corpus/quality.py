"""Data-quality checks run before corpus construction and labeling."""

from __future__ import annotations

from collections.abc import Iterable

from biodiversity_ai.assistant.contracts import (
    NormalizedSpeciesRecord,
    QualityIssue,
    QualityReport,
    QualitySeverity,
    ScientificPublication,
)


def validate_species_records(records: Iterable[NormalizedSpeciesRecord]) -> QualityReport:
    """Validate canonical records without mutating or discarding source data."""

    report = QualityReport()
    seen_entity_ids: set[str] = set()

    for record in records:
        report.checked_records += 1
        if record.entity_id in seen_entity_ids:
            report.issues.append(
                _issue(record, "duplicate_entity_id", "Entity ID is duplicated.", QualitySeverity.ERROR)
            )
        seen_entity_ids.add(record.entity_id)

        if not record.preferred_scientific_name:
            report.issues.append(
                _issue(
                    record,
                    "missing_scientific_name",
                    "No scientific name is available for entity linking.",
                    QualitySeverity.ERROR,
                    "preferred_scientific_name",
                )
            )
        if not record.sections:
            report.issues.append(
                _issue(
                    record,
                    "empty_content",
                    "The record has no descriptive section for retrieval.",
                    QualitySeverity.WARNING,
                    "sections",
                )
            )
        if not record.taxonomy:
            report.issues.append(
                _issue(
                    record,
                    "missing_taxonomy",
                    "The record has no usable taxonomy.",
                    QualitySeverity.WARNING,
                    "taxonomy",
                )
            )
        if not record.source_url:
            report.issues.append(
                _issue(
                    record,
                    "missing_source_url",
                    "The internal record has no detail/source URL.",
                    QualitySeverity.WARNING,
                    "source_url",
                )
            )

        for enrichment in record.enrichments:
            if not enrichment.source_url:
                report.issues.append(
                    _issue(
                        record,
                        "missing_enrichment_provenance",
                        f"{enrichment.provider} enrichment has no source URL.",
                        QualitySeverity.ERROR,
                    )
                )

    return report


def validate_publications(publications: Iterable[ScientificPublication]) -> QualityReport:
    """Check literature metadata before it is admitted to a retrieval corpus."""

    report = QualityReport()
    seen_keys: set[str] = set()
    for publication in publications:
        report.checked_records += 1
        entity_id = publication.doi or publication.source_url
        key = entity_id.casefold()
        if key in seen_keys:
            report.issues.append(
                QualityIssue(
                    entity_id=entity_id,
                    code="duplicate_publication",
                    message="Publication DOI or source URL is duplicated.",
                    severity=QualitySeverity.ERROR,
                )
            )
        seen_keys.add(key)
        if not publication.title.strip():
            report.issues.append(
                QualityIssue(
                    entity_id=entity_id,
                    code="missing_publication_title",
                    message="Publication has no title.",
                    severity=QualitySeverity.ERROR,
                    field="title",
                )
            )
        if not publication.retrieval_url:
            report.issues.append(
                QualityIssue(
                    entity_id=entity_id,
                    code="missing_retrieval_provenance",
                    message="Publication has no API retrieval URL.",
                    severity=QualitySeverity.ERROR,
                    field="retrieval_url",
                )
            )
        if not publication.doi:
            report.issues.append(
                QualityIssue(
                    entity_id=entity_id,
                    code="missing_doi",
                    message="Publication has no DOI and must use its provider ID.",
                    severity=QualitySeverity.WARNING,
                    field="doi",
                )
            )
        if not publication.abstract:
            report.issues.append(
                QualityIssue(
                    entity_id=entity_id,
                    code="missing_abstract",
                    message="Publication metadata does not include an abstract.",
                    severity=QualitySeverity.WARNING,
                    field="abstract",
                )
            )
    return report


def _issue(
    record: NormalizedSpeciesRecord,
    code: str,
    message: str,
    severity: QualitySeverity,
    field: str | None = None,
) -> QualityIssue:
    return QualityIssue(
        entity_id=record.entity_id,
        code=code,
        message=message,
        severity=severity,
        field=field,
    )

