"""Command-line entry points for reproducible assistant research workflows."""

from __future__ import annotations

import argparse
import json
from collections.abc import Sequence
from dataclasses import asdict
from pathlib import Path

from biodiversity_ai.assistant.dataset_build import DatasetBuildConfig, build_real_dataset


def main(argv: Sequence[str] | None = None) -> int:
    parser = _parser()
    args = parser.parse_args(argv)
    if args.command != "build-dataset":
        parser.error("A command is required.")

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
        )
    )
    print(json.dumps(asdict(summary), ensure_ascii=False, indent=2))
    return 0


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="biodiversity-ai")
    commands = parser.add_subparsers(dest="command")
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
    return parser


if __name__ == "__main__":
    raise SystemExit(main())

