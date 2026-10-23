"""Offline S3-AI03 embedding, comparison, and pgvector indexing workflows."""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from pathlib import Path

from biodiversity_ai.assistant.contracts import (
    DatasetPartition,
    DatasetSlice,
    LabeledExample,
    RetrievalHit,
)
from biodiversity_ai.assistant.corpus import load_dataset_slice
from biodiversity_ai.assistant.dataset_build import load_env_file
from biodiversity_ai.assistant.generation import GroundedRagAssistant, RagAnswer
from biodiversity_ai.assistant.ingestion.postgres import PostgresSettings
from biodiversity_ai.assistant.retrieval import (
    Bm25Retriever,
    DenseRetriever,
    EmbeddingArtifact,
    HybridRetriever,
    PgVectorCollection,
    PgVectorRetriever,
    PgVectorStore,
    fuse_ranked_hits,
    load_embedding_artifact,
    write_embedding_artifact,
)
from biodiversity_ai.llm import (
    CrossEncoderReranker,
    SentenceTransformerEmbedder,
    TransformersGenerator,
)


@dataclass(frozen=True, slots=True)
class RetrievalMetrics:
    evaluated_examples: int
    recall_at_k: float
    mean_reciprocal_rank: float


@dataclass(frozen=True, slots=True)
class RetrievalComparison:
    dataset_version: str
    partition: str
    embedding_model: str
    reranker_model: str | None
    top_k: int
    candidate_limit: int
    dense: RetrievalMetrics
    hybrid: RetrievalMetrics
    hybrid_reranked: RetrievalMetrics | None


def embed_dataset(
    dataset_directory: Path,
    output_directory: Path,
    *,
    model_name: str,
    batch_size: int = 16,
    device: str | None = None,
    query_prefix: str = "",
    document_prefix: str = "",
) -> Path:
    """Encode each locked partition and bind vectors to the corpus fingerprint."""

    dataset_manifest = _dataset_manifest(dataset_directory)
    output_directory.mkdir(parents=True, exist_ok=True)
    root_manifest = output_directory / "manifest.json"
    if root_manifest.exists():
        raise FileExistsError(
            f"Embedding artifact is already complete: {output_directory}"
        )
    embedder = SentenceTransformerEmbedder(
        model_name,
        batch_size=batch_size,
        device=device,
        query_prefix=query_prefix,
        document_prefix=document_prefix,
    )
    dimensions: set[int] = set()
    for partition in DatasetPartition:
        dataset_slice = load_dataset_slice(dataset_directory, partition)
        partition_directory = output_directory / partition.value
        existing_artifact = _completed_embedding_artifact(partition_directory)
        if existing_artifact is not None:
            expected_ids = tuple(
                document.document_id for document in dataset_slice.documents
            )
            if existing_artifact.model_name != model_name:
                raise ValueError(
                    f"Embedding model mismatch for existing {partition.value} artifact."
                )
            if existing_artifact.dataset_corpus_hash != dataset_manifest["corpus_hash"]:
                raise ValueError(
                    f"Dataset hash mismatch for existing {partition.value} artifact."
                )
            if existing_artifact.document_ids != expected_ids:
                raise ValueError(
                    f"Document order mismatch for existing {partition.value} artifact."
                )
            dimensions.add(existing_artifact.dimension)
            continue
        if partition_directory.exists():
            raise FileExistsError(
                "Incomplete embedding partition exists. Remove only this generated "
                f"directory and rerun: {partition_directory}"
            )
        vectors = embedder.encode_documents(
            tuple(f"{document.title}\n{document.content}" for document in dataset_slice.documents)
        )
        artifact_directory = write_embedding_artifact(
            partition_directory,
            model_name=model_name,
            dataset_corpus_hash=str(dataset_manifest["corpus_hash"]),
            document_ids=tuple(document.document_id for document in dataset_slice.documents),
            vectors=vectors,
        )
        dimensions.add(load_embedding_artifact(artifact_directory).dimension)
    if len(dimensions) != 1:
        raise ValueError("Embedding dimensions differ across dataset partitions.")
    root_manifest.write_text(
        json.dumps(
            {
                "dataset_version": dataset_manifest["version"],
                "dataset_corpus_hash": dataset_manifest["corpus_hash"],
                "embedding_model": model_name,
                "dimension": dimensions.pop(),
                "query_prefix": query_prefix,
                "document_prefix": document_prefix,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    return output_directory


def _completed_embedding_artifact(directory: Path) -> EmbeddingArtifact | None:
    if not (directory / "manifest.json").is_file():
        return None
    if not (directory / "vectors.npy").is_file():
        return None
    return load_embedding_artifact(directory)


def evaluate_retrieval_variants(
    dataset_directory: Path,
    embedding_directory: Path,
    *,
    partition: DatasetPartition = DatasetPartition.VALIDATION,
    limit: int = 5,
    candidate_limit: int = 20,
    example_limit: int | None = 500,
    batch_size: int = 16,
    device: str | None = None,
    reranker_model: str | None = None,
) -> RetrievalComparison:
    """Compare dense-only, BM25+dense RRF, and optional reranking."""

    if limit < 1:
        raise ValueError("Retrieval limit must be positive.")
    if candidate_limit < limit:
        raise ValueError("Candidate limit must be greater than or equal to retrieval limit.")
    if example_limit is not None and example_limit < 1:
        raise ValueError("Example limit must be positive when provided.")

    dataset_manifest = _dataset_manifest(dataset_directory)
    embedding_manifest = json.loads(
        (embedding_directory / "manifest.json").read_text(encoding="utf-8")
    )
    if embedding_manifest["dataset_corpus_hash"] != dataset_manifest["corpus_hash"]:
        raise ValueError("Embedding artifact does not belong to this dataset corpus.")

    dataset_slice = load_dataset_slice(dataset_directory, partition)
    artifact = load_embedding_artifact(embedding_directory / partition.value)
    document_ids = tuple(document.document_id for document in dataset_slice.documents)
    if artifact.document_ids != document_ids:
        raise ValueError("Embedding document order differs from the dataset partition.")

    embedder = SentenceTransformerEmbedder(
        str(embedding_manifest["embedding_model"]),
        batch_size=batch_size,
        device=device,
        query_prefix=str(embedding_manifest.get("query_prefix", "")),
        document_prefix=str(embedding_manifest.get("document_prefix", "")),
    )
    dense = DenseRetriever(dataset_slice.documents, artifact.vectors, embedder)
    keyword = Bm25Retriever(dataset_slice.documents)
    examples = _evaluation_examples(dataset_slice, example_limit)
    query_vectors = embedder.encode_queries(tuple(example.question for example in examples))
    dense_results: list[tuple[RetrievalHit, ...]] = []
    hybrid_results: list[tuple[RetrievalHit, ...]] = []
    hybrid_candidate_groups: list[tuple[RetrievalHit, ...]] = []
    reranker = (
        CrossEncoderReranker(reranker_model, batch_size=batch_size, device=device)
        if reranker_model
        else None
    )

    for example, query_vector in zip(examples, query_vectors, strict=True):
        dense_candidates = dense.search_vector(query_vector, limit=candidate_limit)
        keyword_candidates = keyword.search(example.question, limit=candidate_limit)
        hybrid_candidates = fuse_ranked_hits(
            keyword_candidates,
            dense_candidates,
            limit=candidate_limit,
        )
        dense_results.append(dense_candidates[:limit])
        hybrid_results.append(hybrid_candidates[:limit])
        hybrid_candidate_groups.append(hybrid_candidates)

    reranked_results = (
        list(
            reranker.rerank_many(
                tuple(example.question for example in examples),
                hybrid_candidate_groups,
                limit=limit,
            )
        )
        if reranker is not None
        else []
    )

    comparison = RetrievalComparison(
        dataset_version=str(dataset_manifest["version"]),
        partition=partition.value,
        embedding_model=artifact.model_name,
        reranker_model=reranker_model,
        top_k=limit,
        candidate_limit=candidate_limit,
        dense=_retrieval_metrics(examples, dense_results),
        hybrid=_retrieval_metrics(examples, hybrid_results),
        hybrid_reranked=(
            _retrieval_metrics(examples, reranked_results) if reranker is not None else None
        ),
    )
    return comparison


def write_comparison(path: Path, comparison: RetrievalComparison) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(asdict(comparison), ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def index_embeddings_in_pgvector(
    dataset_directory: Path,
    embedding_directory: Path,
    *,
    env_file: Path | None = None,
    batch_size: int = 200,
) -> int:
    """Explicitly create pgvector storage and index all locked partitions."""

    if env_file is not None:
        load_env_file(env_file)
    dataset_manifest = _dataset_manifest(dataset_directory)
    embedding_manifest = json.loads(
        (embedding_directory / "manifest.json").read_text(encoding="utf-8")
    )
    collection = PgVectorCollection(
        dataset_version=str(dataset_manifest["version"]),
        embedding_model=str(embedding_manifest["embedding_model"]),
        dimension=int(embedding_manifest["dimension"]),
    )
    store = PgVectorStore(PostgresSettings.from_env(), collection)
    store.ensure_schema()
    indexed = 0
    for partition in DatasetPartition:
        dataset_slice = load_dataset_slice(dataset_directory, partition)
        artifact = load_embedding_artifact(embedding_directory / partition.value)
        expected_ids = tuple(document.document_id for document in dataset_slice.documents)
        if artifact.document_ids != expected_ids:
            raise ValueError(f"Embedding order mismatch for {partition.value}.")
        indexed += store.upsert(
            dataset_slice.documents,
            artifact.vectors,
            partition=partition.value,
            batch_size=batch_size,
        )
    return indexed


def answer_with_pgvector_rag(
    dataset_directory: Path,
    embedding_directory: Path,
    question: str,
    *,
    generator_model: str,
    env_file: Path | None = None,
    partition: DatasetPartition = DatasetPartition.TRAIN,
    batch_size: int = 16,
    device: str | None = None,
    max_new_tokens: int = 384,
    evidence_limit: int = 5,
) -> RagAnswer:
    """Answer with the validated dense baseline persisted in pgvector."""

    if env_file is not None:
        load_env_file(env_file)
    dataset_manifest = _dataset_manifest(dataset_directory)
    embedding_manifest = json.loads(
        (embedding_directory / "manifest.json").read_text(encoding="utf-8")
    )
    if embedding_manifest["dataset_corpus_hash"] != dataset_manifest["corpus_hash"]:
        raise ValueError("Embedding artifact does not belong to this dataset corpus.")

    embedder = SentenceTransformerEmbedder(
        str(embedding_manifest["embedding_model"]),
        batch_size=batch_size,
        device=device,
        query_prefix=str(embedding_manifest.get("query_prefix", "")),
        document_prefix=str(embedding_manifest.get("document_prefix", "")),
    )
    collection = PgVectorCollection(
        dataset_version=str(dataset_manifest["version"]),
        embedding_model=str(embedding_manifest["embedding_model"]),
        dimension=int(embedding_manifest["dimension"]),
    )
    retriever = PgVectorRetriever(
        PgVectorStore(PostgresSettings.from_env(), collection),
        embedder,
        partition=partition.value,
    )
    return GroundedRagAssistant(
        retriever,
        TransformersGenerator(generator_model, max_new_tokens=max_new_tokens),
        candidate_limit=evidence_limit,
        evidence_limit=evidence_limit,
    ).answer(question)


def answer_with_local_rag(
    dataset_directory: Path,
    embedding_directory: Path,
    question: str,
    *,
    generator_model: str,
    partition: DatasetPartition = DatasetPartition.TRAIN,
    reranker_model: str | None = None,
    batch_size: int = 16,
    device: str | None = None,
    max_new_tokens: int = 384,
    candidate_limit: int = 20,
    evidence_limit: int = 5,
) -> RagAnswer:
    """Run one local grounded answer without calling a commercial model API."""

    dataset_manifest = _dataset_manifest(dataset_directory)
    embedding_manifest = json.loads(
        (embedding_directory / "manifest.json").read_text(encoding="utf-8")
    )
    if embedding_manifest["dataset_corpus_hash"] != dataset_manifest["corpus_hash"]:
        raise ValueError("Embedding artifact does not belong to this dataset corpus.")

    dataset_slice = load_dataset_slice(dataset_directory, partition)
    artifact = load_embedding_artifact(embedding_directory / partition.value)
    document_ids = tuple(document.document_id for document in dataset_slice.documents)
    if artifact.document_ids != document_ids:
        raise ValueError("Embedding document order differs from the dataset partition.")

    embedder = SentenceTransformerEmbedder(
        str(embedding_manifest["embedding_model"]),
        batch_size=batch_size,
        device=device,
        query_prefix=str(embedding_manifest.get("query_prefix", "")),
        document_prefix=str(embedding_manifest.get("document_prefix", "")),
    )
    retriever = DenseRetriever(dataset_slice.documents, artifact.vectors, embedder)
    reranker = (
        CrossEncoderReranker(reranker_model, batch_size=batch_size, device=device)
        if reranker_model
        else None
    )
    assistant = GroundedRagAssistant(
        retriever,
        TransformersGenerator(
            generator_model,
            max_new_tokens=max_new_tokens,
        ),
        reranker=reranker,
        candidate_limit=candidate_limit,
        evidence_limit=evidence_limit,
    )
    return assistant.answer(question)


def _dataset_manifest(dataset_directory: Path) -> dict[str, object]:
    manifest = json.loads((dataset_directory / "manifest.json").read_text(encoding="utf-8"))
    if not isinstance(manifest, dict):
        raise ValueError("Dataset manifest must be a JSON object.")
    return manifest


def _evaluation_examples(
    dataset_slice: DatasetSlice,
    limit: int | None,
) -> tuple[LabeledExample, ...]:
    examples = tuple(
        sorted(
            (
                example
                for example in dataset_slice.examples
                if not example.should_abstain and example.relevant_document_ids
            ),
            key=lambda item: item.example_id,
        )
    )
    return examples[:limit] if limit is not None else examples


def _retrieval_metrics(
    examples: tuple[LabeledExample, ...],
    results: list[tuple[RetrievalHit, ...]],
) -> RetrievalMetrics:
    recalls: list[float] = []
    reciprocal_ranks: list[float] = []
    for example, hits in zip(examples, results, strict=True):
        relevant = set(example.relevant_document_ids)
        hit_ids = [hit.document.document_id for hit in hits]
        recalls.append(len(relevant & set(hit_ids)) / len(relevant))
        reciprocal_ranks.append(
            next(
                (
                    1.0 / rank
                    for rank, document_id in enumerate(hit_ids, 1)
                    if document_id in relevant
                ),
                0.0,
            )
        )
    count = len(examples)
    return RetrievalMetrics(
        evaluated_examples=count,
        recall_at_k=sum(recalls) / count if count else 0.0,
        mean_reciprocal_rank=sum(reciprocal_ranks) / count if count else 0.0,
    )

