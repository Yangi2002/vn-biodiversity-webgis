"""Command-line entry points for reproducible assistant research workflows."""

from __future__ import annotations

import argparse
import json
from collections.abc import Sequence
from dataclasses import asdict
from pathlib import Path

from biodiversity_ai.assistant.contracts import DatasetPartition
from biodiversity_ai.assistant.dataset_build import DatasetBuildConfig, build_real_dataset
from biodiversity_ai.assistant.labeling.sft import (
    build_sft_gap_examples,
    combine_sft_reviews,
    curate_sft_training,
    export_sft_review_queue,
    export_approved_sft,
    prepare_sft_review,
    review_source_snapshots,
)
from biodiversity_ai.assistant.rag_workflow import (
    answer_with_pgvector_rag,
    answer_with_local_rag,
    embed_dataset,
    evaluate_retrieval_variants,
    index_embeddings_in_pgvector,
    write_comparison,
)


def main(argv: Sequence[str] | None = None) -> int:
    parser = _parser()
    args = parser.parse_args(argv)
    if args.command == "prepare-sft-review":
        _print_json(prepare_sft_review(
            args.dataset_directory, args.output,
            partition=DatasetPartition(args.partition), limit=args.limit,
            balanced=args.balanced,
        ))
        return 0
    if args.command == "export-approved-sft":
        _print_json(export_approved_sft(args.review_file, args.output))
        return 0
    if args.command == "review-sft-snapshots":
        _print_json(review_source_snapshots(args.review_file, args.output))
        return 0
    if args.command == "build-sft-gaps":
        _print_json(build_sft_gap_examples(
            args.review_file, args.output,
            conservation_limit=args.conservation_limit,
            abstention_limit=args.abstention_limit,
        ))
        return 0
    if args.command == "combine-sft-reviews":
        _print_json(combine_sft_reviews(args.base_file, args.gaps_file, args.output))
        return 0
    if args.command == "curate-sft-training":
        _print_json(curate_sft_training(
            args.train_file, args.validation_file, args.output, args.report,
            empty_evidence_limit=args.empty_evidence_limit,
            wrong_facet_limit=args.wrong_facet_limit,
        ))
        return 0
    if args.command == "export-sft-review-queue":
        _print_json(export_sft_review_queue(args.review_file, args.output))
        return 0
    if args.command == "build-dataset":
        summary = build_real_dataset(
            DatasetBuildConfig(
                version=args.version,
                output_root=args.output_root,
                cache_root=args.cache_root,
                env_file=args.env_file,
                limit_per_table=args.limit_per_table,
                literature_species_limit=args.literature_species_limit,
                literature_results_per_provider=args.literature_results,
                request_delay_seconds=args.request_delay,
                split_seed=args.split_seed,
                evaluation_example_limit=args.evaluation_example_limit,
                api_workers=args.api_workers,
                crossref_workers=args.crossref_workers,
                crossref_delay_seconds=args.crossref_delay,
                crossref_mailto=args.crossref_mailto,
            )
        )
        _print_json(asdict(summary))
        return 0
    if args.command == "embed-corpus":
        result = embed_dataset(
            args.dataset_directory,
            args.output_directory,
            model_name=args.model,
            batch_size=args.batch_size,
            device=args.device,
            query_prefix=args.query_prefix,
            document_prefix=args.document_prefix,
        )
        _print_json({"embedding_directory": str(result)})
        return 0
    if args.command == "evaluate-retrieval":
        comparison = evaluate_retrieval_variants(
            args.dataset_directory,
            args.embedding_directory,
            partition=DatasetPartition(args.partition),
            limit=args.limit,
            candidate_limit=args.candidate_limit,
            example_limit=args.example_limit,
            batch_size=args.batch_size,
            device=args.device,
            reranker_model=args.reranker_model,
            keyword_weight=args.keyword_weight,
        )
        write_comparison(args.output, comparison)
        _print_json(asdict(comparison))
        return 0
    if args.command == "index-pgvector":
        indexed = index_embeddings_in_pgvector(
            args.dataset_directory,
            args.embedding_directory,
            env_file=args.env_file,
            batch_size=args.batch_size,
        )
        _print_json({"indexed_documents": indexed})
        return 0
    if args.command == "ask":
        answer = answer_with_local_rag(
            args.dataset_directory,
            args.embedding_directory,
            args.question,
            generator_model=args.generator_model,
            partition=DatasetPartition(args.partition),
            reranker_model=args.reranker_model,
            batch_size=args.batch_size,
            device=args.device,
            max_new_tokens=args.max_new_tokens,
            candidate_limit=args.candidate_limit,
            evidence_limit=args.evidence_limit,
        )
        _print_json(asdict(answer))
        return 0
    if args.command == "ask-pgvector":
        answer = answer_with_pgvector_rag(
            args.dataset_directory,
            args.embedding_directory,
            args.question,
            generator_model=args.generator_model,
            env_file=args.env_file,
            partition=DatasetPartition(args.partition),
            batch_size=args.batch_size,
            device=args.device,
            max_new_tokens=args.max_new_tokens,
            evidence_limit=args.evidence_limit,
        )
        _print_json(asdict(answer))
        return 0
    parser.error("A command is required.")


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="biodiversity-ai")
    commands = parser.add_subparsers(dest="command")
    sft_review = commands.add_parser(
        "prepare-sft-review", help="Prepare source-grounded SFT labels for human review."
    )
    sft_review.add_argument("--dataset-directory", type=Path, required=True)
    sft_review.add_argument("--output", type=Path, required=True)
    sft_review.add_argument(
        "--partition", choices=("train", "validation"), default="train"
    )
    sft_review.add_argument("--limit", type=int)
    sft_review.add_argument("--balanced", action="store_true")

    sft_export = commands.add_parser(
        "export-approved-sft", help="Export explicitly approved SFT chat messages."
    )
    sft_export.add_argument("--review-file", type=Path, required=True)
    sft_export.add_argument("--output", type=Path, required=True)

    sft_snapshot = commands.add_parser(
        "review-sft-snapshots", help="Check extractive drafts against stored source snapshots."
    )
    sft_snapshot.add_argument("--review-file", type=Path, required=True)
    sft_snapshot.add_argument("--output", type=Path, required=True)

    sft_gaps = commands.add_parser(
        "build-sft-gaps", help="Prepare source-backed conservation and abstention examples."
    )
    sft_gaps.add_argument("--review-file", type=Path, required=True)
    sft_gaps.add_argument("--output", type=Path, required=True)
    sft_gaps.add_argument("--conservation-limit", type=int, default=80)
    sft_gaps.add_argument("--abstention-limit", type=int, default=50)
    sft_combine = commands.add_parser(
        "combine-sft-reviews", help="Combine one partition of reviewed and gap examples."
    )
    sft_combine.add_argument("--base-file", type=Path, required=True)
    sft_combine.add_argument("--gaps-file", type=Path, required=True)
    sft_combine.add_argument("--output", type=Path, required=True)
    sft_curate = commands.add_parser(
        "curate-sft-training", help="Screen v2 SFT train and add abstention review cases."
    )
    sft_curate.add_argument("--train-file", type=Path, required=True)
    sft_curate.add_argument("--validation-file", type=Path, required=True)
    sft_curate.add_argument("--output", type=Path, required=True)
    sft_curate.add_argument("--report", type=Path, required=True)
    sft_curate.add_argument("--empty-evidence-limit", type=int, default=25)
    sft_curate.add_argument("--wrong-facet-limit", type=int, default=25)
    sft_queue = commands.add_parser(
        "export-sft-review-queue", help="Extract held SFT examples for manual review."
    )
    sft_queue.add_argument("--review-file", type=Path, required=True)
    sft_queue.add_argument("--output", type=Path, required=True)
    build = commands.add_parser(
        "build-dataset",
        help="Build a versioned, read-only S3-AI02 dataset.",
    )
    build.add_argument("--version", required=True)
    build.add_argument("--env-file", type=Path)
    build.add_argument("--output-root", type=Path, default=Path("datasets"))
    build.add_argument(
        "--cache-root",
        type=Path,
        default=Path("artifacts") / "dataset-build-cache",
    )
    build.add_argument("--limit-per-table", type=int)
    build.add_argument("--literature-species-limit", type=int, default=100)
    build.add_argument("--literature-results", type=int, default=2)
    build.add_argument("--request-delay", type=float, default=0.1)
    build.add_argument("--split-seed", default="vn-biodiversity-v1")
    build.add_argument("--evaluation-example-limit", type=int, default=500)
    build.add_argument("--api-workers", type=int, default=6)
    build.add_argument("--crossref-workers", type=int, default=1)
    build.add_argument("--crossref-delay", type=float, default=1.0)
    build.add_argument("--crossref-mailto")

    embed = commands.add_parser(
        "embed-corpus",
        help="Create immutable embedding artifacts for a locked dataset.",
    )
    embed.add_argument("--dataset-directory", type=Path, required=True)
    embed.add_argument("--output-directory", type=Path, required=True)
    embed.add_argument("--model", default="BAAI/bge-m3")
    embed.add_argument("--batch-size", type=int, default=16)
    embed.add_argument("--device")
    embed.add_argument("--query-prefix", default="")
    embed.add_argument("--document-prefix", default="")

    evaluate = commands.add_parser(
        "evaluate-retrieval",
        help="Compare dense-only, Hybrid RAG retrieval, and optional reranking.",
    )
    evaluate.add_argument("--dataset-directory", type=Path, required=True)
    evaluate.add_argument("--embedding-directory", type=Path, required=True)
    evaluate.add_argument(
        "--partition",
        choices=tuple(partition.value for partition in DatasetPartition),
        default=DatasetPartition.VALIDATION.value,
    )
    evaluate.add_argument("--limit", type=int, default=5)
    evaluate.add_argument("--candidate-limit", type=int, default=20)
    evaluate.add_argument("--example-limit", type=int, default=500)
    evaluate.add_argument("--batch-size", type=int, default=16)
    evaluate.add_argument("--device")
    evaluate.add_argument("--reranker-model")
    evaluate.add_argument("--keyword-weight", type=float, default=1.0)
    evaluate.add_argument(
        "--output",
        type=Path,
        default=Path("artifacts") / "rag" / "retrieval-comparison.json",
    )

    pgvector = commands.add_parser(
        "index-pgvector",
        help="Explicitly write locked corpus embeddings to PostgreSQL/pgvector.",
    )
    pgvector.add_argument("--dataset-directory", type=Path, required=True)
    pgvector.add_argument("--embedding-directory", type=Path, required=True)
    pgvector.add_argument("--env-file", type=Path)
    pgvector.add_argument("--batch-size", type=int, default=200)

    ask = commands.add_parser(
        "ask",
        help="Run one grounded answer with local open-weight models.",
    )
    ask.add_argument("--dataset-directory", type=Path, required=True)
    ask.add_argument("--embedding-directory", type=Path, required=True)
    ask.add_argument("--question", required=True)
    ask.add_argument("--generator-model", required=True)
    ask.add_argument(
        "--partition",
        choices=tuple(partition.value for partition in DatasetPartition),
        default=DatasetPartition.TRAIN.value,
    )
    ask.add_argument("--reranker-model")
    ask.add_argument("--batch-size", type=int, default=16)
    ask.add_argument("--device")
    ask.add_argument("--max-new-tokens", type=int, default=384)
    ask.add_argument("--candidate-limit", type=int, default=20)
    ask.add_argument("--evidence-limit", type=int, default=5)

    ask_pgvector = commands.add_parser(
        "ask-pgvector",
        help="Answer with the validated dense pgvector baseline and grounded citations.",
    )
    ask_pgvector.add_argument("--dataset-directory", type=Path, required=True)
    ask_pgvector.add_argument("--embedding-directory", type=Path, required=True)
    ask_pgvector.add_argument("--env-file", type=Path)
    ask_pgvector.add_argument("--question", required=True)
    ask_pgvector.add_argument(
        "--generator-model",
        default="Qwen/Qwen2.5-3B-Instruct",
    )
    ask_pgvector.add_argument(
        "--partition",
        choices=tuple(partition.value for partition in DatasetPartition),
        default=DatasetPartition.TRAIN.value,
    )
    ask_pgvector.add_argument("--batch-size", type=int, default=16)
    ask_pgvector.add_argument("--device")
    ask_pgvector.add_argument("--max-new-tokens", type=int, default=384)
    ask_pgvector.add_argument("--evidence-limit", type=int, default=5)
    return parser


def _print_json(value: object) -> None:
    print(json.dumps(value, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    raise SystemExit(main())

