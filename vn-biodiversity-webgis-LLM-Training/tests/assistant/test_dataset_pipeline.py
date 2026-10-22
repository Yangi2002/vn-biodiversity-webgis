from pathlib import Path

from biodiversity_ai.assistant.contracts import (
    NormalizedSpeciesRecord,
    RawSpeciesRecord,
    SourceReference,
    SpeciesKey,
)
from biodiversity_ai.assistant.corpus import build_species_corpus
from biodiversity_ai.assistant.evaluation import evaluate_baseline
from biodiversity_ai.assistant.labeling import (
    build_manifest,
    build_seed_labels,
    check_dataset_leakage,
    split_by_entity,
    write_dataset_version,
)
from biodiversity_ai.assistant.workflow import run_research_workflow


def test_corpus_label_split_version_and_evaluation_pipeline(tmp_path: Path) -> None:
    records = tuple(_species_record(index) for index in range(12))
    documents = build_species_corpus(records)
    examples = build_seed_labels(documents)
    splits = split_by_entity(documents, examples, seed="pipeline-test")

    leakage = check_dataset_leakage(splits)
    manifest = build_manifest(
        splits,
        version="test-v0.1.0",
        source_snapshot="postgres-test-fixture",
        providers=("PostgreSQL",),
    )
    output_directory = write_dataset_version(tmp_path, splits, manifest)
    validation_report = evaluate_baseline(splits.validation, retrieval_limit=5)
    test_report = evaluate_baseline(splits.test, retrieval_limit=5)

    assert len(documents) == 24
    assert len(examples) == 24
    assert leakage.is_clean
    assert manifest.corpus_hash
    assert (output_directory / "manifest.json").is_file()
    assert (output_directory / "train" / "documents.jsonl").is_file()
    assert validation_report.evaluated_examples > 0
    assert validation_report.recall_at_k == 1.0
    assert test_report.evaluated_examples > 0
    assert test_report.recall_at_k == 1.0


def test_research_workflow_rejects_invalid_entities_and_runs_final_test(
    tmp_path: Path,
) -> None:
    raw_records = tuple(_raw_species_record(index) for index in range(12)) + (
        RawSpeciesRecord(
            key=SpeciesKey("plant_db_vn", "missing-scientific-name"),
            values={
                "ten_viet_nam": "Loài chưa định danh",
                "mo_ta": "Bản ghi này không đủ điều kiện tạo corpus.",
            },
        ),
    )

    result = run_research_workflow(
        raw_records,
        version="workflow-v0.1.0",
        source_snapshot="postgres-test-fixture",
        providers=("PostgreSQL",),
        output_root=tmp_path,
        split_seed="workflow-test",
    )

    assert result.quality.checked_records == 13
    assert result.rejected_entity_ids == (
        "species:plant_db_vn:missing-scientific-name",
    )
    assert check_dataset_leakage(result.splits).is_clean
    assert result.output_directory == tmp_path / "workflow-v0.1.0"
    assert result.validation_report.evaluated_examples > 0
    assert result.validation_report.recall_at_k == 1.0
    assert result.test_report.evaluated_examples > 0
    assert result.test_report.recall_at_k == 1.0


def _species_record(index: int) -> NormalizedSpeciesRecord:
    key = SpeciesKey("animal_db_vn", f"species-{index:02d}")
    scientific_name = f"Genus{index} species{index}"
    vietnamese_name = f"Loài thử nghiệm {index}"
    source_url = f"https://example.test/species/{index}"
    return NormalizedSpeciesRecord(
        key=key,
        preferred_scientific_name=scientific_name,
        scientific_names=(scientific_name,),
        preferred_vietnamese_name=vietnamese_name,
        vietnamese_names=(vietnamese_name,),
        taxonomy={"genus": f"Genus{index}"},
        sections={
            "description": f"Mô tả riêng biệt của loài số {index}.",
            "distribution": f"Loài số {index} phân bố tại vùng kiểm thử {index}.",
        },
        source_url=source_url,
        source_references=(
            SourceReference(source_name="animal_db_vn", source_url=source_url),
        ),
        enrichments=(),
    )


def _raw_species_record(index: int) -> RawSpeciesRecord:
    return RawSpeciesRecord(
        key=SpeciesKey("animal_db_vn", f"species-{index:02d}"),
        values={
            "species_id": f"species-{index:02d}",
            "ten_viet_nam": f"Loài thử nghiệm {index}",
            "ten_latin": f"Genus{index} species{index}",
            "ho": f"Family{index}",
            "mo_ta": f"Mô tả riêng biệt của loài số {index}.",
            "phan_bo": f"Loài số {index} phân bố tại vùng kiểm thử {index}.",
            "detail_url": f"https://example.test/species/{index}",
        },
    )

