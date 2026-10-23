"""Build a versioned assistant dataset from PostgreSQL and scientific APIs."""

from __future__ import annotations

import hashlib
import json
import os
import time
from collections import defaultdict
from collections.abc import Iterable, Mapping
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from biodiversity_ai.assistant.contracts import (
    EvaluationReport,
    RawSpeciesRecord,
    ScientificEnrichment,
    ScientificPublication,
    SpeciesKey,
)
from biodiversity_ai.assistant.ingestion.literature_apis import (
    CrossrefLiteratureClient,
    EuropePmcLiteratureClient,
    LiteratureProvider,
    search_literature,
)
from biodiversity_ai.assistant.ingestion.postgres import (
    PostgresSettings,
    PostgresSpeciesExtractor,
)
from biodiversity_ai.assistant.ingestion.scientific_apis import GbifSpeciesClient
from biodiversity_ai.assistant.workflow import ResearchWorkflowResult, run_research_workflow


@dataclass(frozen=True, slots=True)
class DatasetBuildConfig:
    version: str
    output_root: Path
    cache_root: Path
    env_file: Path | None = None
    limit_per_table: int | None = None
    literature_species_limit: int | None = 100
    literature_results_per_provider: int = 2
    request_delay_seconds: float = 0.1
    split_seed: str = "vn-biodiversity-v1"
    evaluation_example_limit: int | None = 500
    api_workers: int = 6
    crossref_workers: int = 1
    crossref_delay_seconds: float = 1.0
    crossref_mailto: str | None = None


@dataclass(frozen=True, slots=True)
class DatasetBuildSummary:
    version: str
    extracted_records: int
    gbif_api_records: int
    literature_species: int
    publications: int
    api_failures: tuple[dict[str, str], ...]
    rejected_entities: tuple[str, ...]
    validation: dict[str, object]
    test: dict[str, object]
    output_directory: str


def build_real_dataset(config: DatasetBuildConfig) -> DatasetBuildSummary:
    """Execute the read-only S3-AI02 workflow and persist its audit report."""

    if config.env_file is not None:
        load_env_file(config.env_file)
    _validate_config(config)

    settings = PostgresSettings.from_env()
    raw_records = tuple(
        PostgresSpeciesExtractor(settings).iter_all_species(
            limit_per_table=config.limit_per_table
        )
    )
    if not raw_records:
        raise RuntimeError("PostgreSQL extraction returned no species records.")

    cache = _shared_api_cache(config.cache_root)
    enrichments, gbif_count, gbif_failures = _load_gbif_enrichments(
        raw_records,
        cache,
        config.request_delay_seconds,
        config.api_workers,
    )
    publications, literature_count, literature_failures = _load_literature(
        raw_records,
        cache,
        species_limit=config.literature_species_limit,
        results_per_provider=config.literature_results_per_provider,
        delay_seconds=config.request_delay_seconds,
        api_workers=config.api_workers,
        crossref_workers=config.crossref_workers,
        crossref_delay_seconds=config.crossref_delay_seconds,
        crossref_mailto=config.crossref_mailto or os.getenv("CROSSREF_MAILTO"),
    )
    source_snapshot = _source_snapshot(settings)
    providers = ("PostgreSQL", "GBIF", "Crossref", "Europe PMC")
    result = run_research_workflow(
        raw_records,
        version=config.version,
        source_snapshot=source_snapshot,
        providers=providers,
        enrichments=enrichments,
        publications=publications,
        output_root=config.output_root,
        split_seed=config.split_seed,
        evaluation_example_limit=config.evaluation_example_limit,
    )
    if result.output_directory is None:
        raise RuntimeError("Dataset workflow did not create an output directory.")

    summary = DatasetBuildSummary(
        version=config.version,
        extracted_records=len(raw_records),
        gbif_api_records=gbif_count,
        literature_species=literature_count,
        publications=sum(len(items) for items in publications.values()),
        api_failures=(*gbif_failures, *literature_failures),
        rejected_entities=result.rejected_entity_ids,
        validation=_evaluation_dict(result.validation_report),
        test=_evaluation_dict(result.test_report),
        output_directory=str(result.output_directory.resolve()),
    )
    _write_build_reports(result, summary)
    return summary


def load_env_file(path: Path) -> None:
    """Load missing environment variables from a simple dotenv file."""

    if not path.is_file():
        raise FileNotFoundError(f"Environment file does not exist: {path}")
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in {'"', "'"}:
            value = value[1:-1]
        if key:
            os.environ.setdefault(key, value)


class _ApiCache:
    def __init__(self, root: Path, fallback_roots: tuple[Path, ...] = ()) -> None:
        self.root = root
        self.fallback_roots = fallback_roots

    def read(self, provider: str, key: str) -> object | None:
        path = self._path(provider, key)
        if path.is_file():
            return json.loads(path.read_text(encoding="utf-8"))
        for fallback_root in self.fallback_roots:
            fallback_path = self._path(provider, key, root=fallback_root)
            if fallback_path.is_file():
                payload = json.loads(fallback_path.read_text(encoding="utf-8"))
                self.write(provider, key, payload)
                return payload
        return None

    def write(self, provider: str, key: str, payload: object) -> None:
        path = self._path(provider, key)
        path.parent.mkdir(parents=True, exist_ok=True)
        temporary = path.with_suffix(".tmp")
        temporary.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        temporary.replace(path)

    def _path(self, provider: str, key: str, *, root: Path | None = None) -> Path:
        digest = hashlib.sha256(key.encode("utf-8")).hexdigest()
        return (root or self.root) / provider / f"{digest}.json"


def _load_gbif_enrichments(
    records: Iterable[RawSpeciesRecord],
    cache: _ApiCache,
    delay_seconds: float,
    api_workers: int,
) -> tuple[dict[SpeciesKey, tuple[ScientificEnrichment, ...]], int, list[dict[str, str]]]:
    result: dict[SpeciesKey, tuple[ScientificEnrichment, ...]] = {}
    failures: list[dict[str, str]] = []
    api_count = 0
    records_by_name: dict[str, list[RawSpeciesRecord]] = defaultdict(list)
    display_names: dict[str, str] = {}
    for record in records:
        if record.gbif_taxonomy:
            continue
        scientific_name = _scientific_name(record)
        if not scientific_name:
            continue
        cache_key = scientific_name.casefold()
        records_by_name[cache_key].append(record)
        display_names.setdefault(cache_key, scientific_name)

    with GbifSpeciesClient() as client:
        pending: dict[object, str] = {}
        for cache_key, matching_records in records_by_name.items():
            cached = cache.read("gbif", cache_key)
            if isinstance(cached, dict):
                enrichment = _enrichment_from_json(cached)
                for record in matching_records:
                    result[record.key] = (enrichment,)
                continue
            pending[cache_key] = display_names[cache_key]

        with ThreadPoolExecutor(max_workers=api_workers) as executor:
            futures = {
                executor.submit(client.match, scientific_name): cache_key
                for cache_key, scientific_name in pending.items()
            }
            for future in as_completed(futures):
                cache_key = futures[future]
                matching_records = records_by_name[cache_key]
                try:
                    enrichment = future.result()
                    cache.write("gbif", cache_key, _json_value(enrichment))
                    api_count += 1
                    for record in matching_records:
                        result[record.key] = (enrichment,)
                    time.sleep(delay_seconds)
                except Exception as error:  # noqa: BLE001 - provider failures are audited
                    failures.extend(
                        _failure("GBIF", record.key, error) for record in matching_records
                    )
    return result, api_count, failures


def _load_literature(
    records: Iterable[RawSpeciesRecord],
    cache: _ApiCache,
    *,
    species_limit: int | None,
    results_per_provider: int,
    delay_seconds: float,
    api_workers: int,
    crossref_workers: int,
    crossref_delay_seconds: float,
    crossref_mailto: str | None,
) -> tuple[dict[SpeciesKey, tuple[ScientificPublication, ...]], int, list[dict[str, str]]]:
    records_by_name: dict[str, list[RawSpeciesRecord]] = defaultdict(list)
    display_names: dict[str, str] = {}
    for record in records:
        scientific_name = _scientific_name(record)
        if not scientific_name:
            continue
        cache_key = scientific_name.casefold()
        records_by_name[cache_key].append(record)
        display_names.setdefault(cache_key, scientific_name)
    selected_names = tuple(records_by_name)[:species_limit]

    with CrossrefLiteratureClient(
        mailto=crossref_mailto,
        max_retries=5,
    ) as crossref, EuropePmcLiteratureClient(max_retries=5) as europe_pmc:
        crossref_results, crossref_failures = _load_literature_provider(
            provider=crossref,
            provider_cache_name="crossref",
            records_by_name=records_by_name,
            display_names=display_names,
            selected_names=selected_names,
            cache=cache,
            results_per_provider=results_per_provider,
            workers=crossref_workers,
            delay_seconds=crossref_delay_seconds,
        )
        europe_pmc_results, europe_pmc_failures = _load_literature_provider(
            provider=europe_pmc,
            provider_cache_name="europe-pmc",
            records_by_name=records_by_name,
            display_names=display_names,
            selected_names=selected_names,
            cache=cache,
            results_per_provider=results_per_provider,
            workers=api_workers,
            delay_seconds=delay_seconds,
        )

    result = _merge_publication_results(crossref_results, europe_pmc_results)
    return result, len(selected_names), [*crossref_failures, *europe_pmc_failures]


def _load_literature_provider(
    *,
    provider: LiteratureProvider,
    provider_cache_name: str,
    records_by_name: Mapping[str, list[RawSpeciesRecord]],
    display_names: Mapping[str, str],
    selected_names: tuple[str, ...],
    cache: _ApiCache,
    results_per_provider: int,
    workers: int,
    delay_seconds: float,
) -> tuple[
    dict[SpeciesKey, tuple[ScientificPublication, ...]],
    list[dict[str, str]],
]:
    results: dict[SpeciesKey, tuple[ScientificPublication, ...]] = {}
    failures: list[dict[str, str]] = []
    pending: dict[str, str] = {}

    for cache_key in selected_names:
        cached = cache.read(provider_cache_name, cache_key)
        if not isinstance(cached, list):
            legacy = cache.read("literature", cache_key)
            if isinstance(legacy, list):
                cached = [
                    item
                    for item in legacy
                    if isinstance(item, dict)
                    and str(item.get("provider", "")).casefold()
                    == provider.provider_name.casefold()
                ]
                cache.write(provider_cache_name, cache_key, cached)
        if isinstance(cached, list):
            publications = tuple(_publication_from_json(item) for item in cached)
            for record in records_by_name[cache_key]:
                results[record.key] = publications
            continue
        pending[cache_key] = display_names[cache_key]

    with ThreadPoolExecutor(max_workers=workers) as executor:
        futures = {
            executor.submit(
                _fetch_publications,
                provider,
                scientific_name,
                results_per_provider,
                delay_seconds,
            ): cache_key
            for cache_key, scientific_name in pending.items()
        }
        for future in as_completed(futures):
            cache_key = futures[future]
            matching_records = records_by_name[cache_key]
            try:
                publications = future.result()
                cache.write(
                    provider_cache_name,
                    cache_key,
                    [_json_value(publication) for publication in publications],
                )
                for record in matching_records:
                    results[record.key] = publications
            except Exception as error:  # noqa: BLE001 - provider failures are audited
                failures.extend(
                    _failure(provider.provider_name, record.key, error)
                    for record in matching_records
                )
    return results, failures


def _fetch_publications(
    provider: LiteratureProvider,
    scientific_name: str,
    results_per_provider: int,
    delay_seconds: float,
) -> tuple[ScientificPublication, ...]:
    try:
        return search_literature(
            scientific_name,
            (provider,),
            limit_per_provider=results_per_provider,
        )
    finally:
        time.sleep(delay_seconds)


def _merge_publication_results(
    *provider_results: Mapping[SpeciesKey, tuple[ScientificPublication, ...]],
) -> dict[SpeciesKey, tuple[ScientificPublication, ...]]:
    merged: dict[SpeciesKey, list[ScientificPublication]] = defaultdict(list)
    seen: dict[SpeciesKey, set[str]] = defaultdict(set)
    for provider_result in provider_results:
        for key, publications in provider_result.items():
            for publication in publications:
                identity = (
                    f"doi:{publication.doi.casefold()}"
                    if publication.doi
                    else f"url:{publication.source_url.casefold()}"
                )
                if identity not in seen[key]:
                    seen[key].add(identity)
                    merged[key].append(publication)
    return {key: tuple(publications) for key, publications in merged.items()}


def _shared_api_cache(cache_root: Path) -> _ApiCache:
    shared_root = cache_root / "shared"
    fallback_roots = tuple(
        path
        for path in sorted(cache_root.glob("*"), reverse=True)
        if path.is_dir() and path != shared_root
    )
    return _ApiCache(shared_root, fallback_roots)


def _write_build_reports(
    result: ResearchWorkflowResult,
    summary: DatasetBuildSummary,
) -> None:
    assert result.output_directory is not None
    report_path = result.output_directory / "build-report.json"
    report_path.write_text(
        json.dumps(_json_value(summary), ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    quality_path = result.output_directory / "quality-report.json"
    quality_path.write_text(
        json.dumps(_json_value(result.quality), ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def _evaluation_dict(report: EvaluationReport) -> dict[str, object]:
    values = asdict(report)
    values["partition"] = report.partition.value
    return values


def _source_snapshot(settings: PostgresSettings) -> str:
    database = settings.dsn.rsplit("/", maxsplit=1)[-1].split("?", maxsplit=1)[0]
    timestamp = datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")
    return f"postgresql:{database}:{settings.schema}@{timestamp}"


def _scientific_name(record: RawSpeciesRecord) -> str | None:
    value = record.values.get("ten_latin")
    if value is None:
        return None
    name = " ".join(str(value).split()).strip()
    return name or None


def _failure(provider: str, key: SpeciesKey, error: Exception) -> dict[str, str]:
    return {
        "provider": provider,
        "entity_id": key.entity_id,
        "error_type": type(error).__name__,
        "message": str(error),
    }


def _enrichment_from_json(payload: Mapping[str, Any]) -> ScientificEnrichment:
    return ScientificEnrichment(
        provider=str(payload["provider"]),
        query=str(payload["query"]),
        retrieved_at=datetime.fromisoformat(str(payload["retrieved_at"])),
        source_url=str(payload["source_url"]),
        payload=dict(payload.get("payload", {})),
        accepted_scientific_name=_optional_string(payload.get("accepted_scientific_name")),
        canonical_name=_optional_string(payload.get("canonical_name")),
        taxonomy=dict(payload.get("taxonomy", {})),
        license=_optional_string(payload.get("license")),
    )


def _publication_from_json(payload: Mapping[str, Any]) -> ScientificPublication:
    return ScientificPublication(
        provider=str(payload["provider"]),
        query=str(payload["query"]),
        retrieved_at=datetime.fromisoformat(str(payload["retrieved_at"])),
        title=str(payload["title"]),
        source_url=str(payload["source_url"]),
        retrieval_url=str(payload["retrieval_url"]),
        authors=tuple(str(item) for item in payload.get("authors", [])),
        publication_year=_optional_integer(payload.get("publication_year")),
        journal=_optional_string(payload.get("journal")),
        doi=_optional_string(payload.get("doi")),
        abstract=_optional_string(payload.get("abstract")),
        license=_optional_string(payload.get("license")),
        open_access=_optional_boolean(payload.get("open_access")),
        payload=dict(payload.get("payload", {})),
    )


def _json_value(value: object) -> Any:
    if hasattr(value, "__dataclass_fields__"):
        return _json_value(asdict(value))
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, dict):
        return {str(key): _json_value(item) for key, item in value.items()}
    if isinstance(value, (tuple, list)):
        return [_json_value(item) for item in value]
    if hasattr(value, "value"):
        return value.value
    return value


def _validate_config(config: DatasetBuildConfig) -> None:
    if not config.version.strip():
        raise ValueError("version must not be blank.")
    if config.literature_species_limit is not None and config.literature_species_limit < 1:
        raise ValueError("literature_species_limit must be positive or None.")
    if not 1 <= config.literature_results_per_provider <= 100:
        raise ValueError("literature_results_per_provider must be between 1 and 100.")
    if config.request_delay_seconds < 0:
        raise ValueError("request_delay_seconds must not be negative.")
    if config.evaluation_example_limit is not None and config.evaluation_example_limit < 1:
        raise ValueError("evaluation_example_limit must be positive or None.")
    if not 1 <= config.api_workers <= 16:
        raise ValueError("api_workers must be between 1 and 16.")
    if not 1 <= config.crossref_workers <= 2:
        raise ValueError("crossref_workers must be between 1 and 2.")
    if config.crossref_delay_seconds < 0:
        raise ValueError("crossref_delay_seconds must not be negative.")


def _optional_string(value: object) -> str | None:
    return str(value) if value is not None else None


def _optional_integer(value: object) -> int | None:
    return int(value) if value is not None else None


def _optional_boolean(value: object) -> bool | None:
    return bool(value) if value is not None else None

