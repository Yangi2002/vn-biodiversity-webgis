"""End-to-end offline research workflow from raw records to final test metrics."""

from __future__ import annotations

from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass
from pathlib import Path

from biodiversity_ai.assistant.contracts import (
    DatasetManifest,
    DatasetSplits,
    EvaluationReport,
    QualityReport,
    QualitySeverity,
    RawSpeciesRecord,
    ScientificEnrichment,
    ScientificPublication,
    SpeciesKey,
)
from biodiversity_ai.assistant.corpus import build_species_corpus
from biodiversity_ai.assistant.evaluation import evaluate_baseline
from biodiversity_ai.assistant.ingestion.preparation import prepare_species_records
from biodiversity_ai.assistant.labeling import (
    build_manifest,
    build_seed_labels,
    split_by_entity,
    write_dataset_version,
)


@dataclass(frozen=True, slots=True)
class ResearchWorkflowResult:
    quality: QualityReport
    rejected_entity_ids: tuple[str, ...]
    splits: DatasetSplits
    manifest: DatasetManifest
    validation_report: EvaluationReport
    test_report: EvaluationReport
    output_directory: Path | None


def run_research_workflow(
    raw_records: Iterable[RawSpeciesRecord],
    *,
    version: str,
    source_snapshot: str,
    providers: tuple[str, ...],
    enrichments: Mapping[SpeciesKey, Iterable[ScientificEnrichment]] | None = None,
    publications: Mapping[SpeciesKey, Sequence[ScientificPublication]] | None = None,
    output_root: Path | None = None,
    split_seed: str = "vn-biodiversity-v1",
    retrieval_limit: int = 5,
    evaluation_example_limit: int | None = None,
) -> ResearchWorkflowResult:
    """Run steps 3-11; extraction and API calls remain explicit caller concerns."""

    prepared = prepare_species_records(raw_records, enrichments)
    rejected_entity_ids = tuple(
        sorted(
            {
                issue.entity_id
                for issue in prepared.quality.issues
                if issue.severity is QualitySeverity.ERROR
            }
        )
    )
    rejected = set(rejected_entity_ids)
    accepted_records = tuple(
        record for record in prepared.records if record.entity_id not in rejected
    )
    documents = build_species_corpus(accepted_records, publications)
    examples = build_seed_labels(documents)
    splits = split_by_entity(documents, examples, seed=split_seed)
    manifest = build_manifest(
        splits,
        version=version,
        source_snapshot=source_snapshot,
        providers=providers,
    )
    output_directory = (
        write_dataset_version(output_root, splits, manifest)
        if output_root is not None
        else None
    )
    return ResearchWorkflowResult(
        quality=prepared.quality,
        rejected_entity_ids=rejected_entity_ids,
        splits=splits,
        manifest=manifest,
        validation_report=evaluate_baseline(
            splits.validation,
            retrieval_limit=retrieval_limit,
            example_limit=evaluation_example_limit,
        ),
        test_report=evaluate_baseline(
            splits.test,
            retrieval_limit=retrieval_limit,
            example_limit=evaluation_example_limit,
        ),
        output_directory=output_directory,
    )

