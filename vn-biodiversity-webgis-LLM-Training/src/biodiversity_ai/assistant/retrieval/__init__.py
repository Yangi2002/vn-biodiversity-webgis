"""Hybrid structured, spatial, and semantic retrieval pipelines."""

from .baseline import ExtractiveBaselineAssistant
from .bm25 import Bm25Retriever
from .dense import DenseRetriever
from .embedding_artifact import (
    EmbeddingArtifact,
    load_embedding_artifact,
    write_embedding_artifact,
)
from .hybrid import HybridRetriever, Retriever, fuse_ranked_hits
from .pgvector_store import PgVectorCollection, PgVectorRetriever, PgVectorStore

__all__ = [
    "Bm25Retriever",
    "DenseRetriever",
    "EmbeddingArtifact",
    "ExtractiveBaselineAssistant",
    "HybridRetriever",
    "PgVectorCollection",
    "PgVectorRetriever",
    "PgVectorStore",
    "Retriever",
    "fuse_ranked_hits",
    "load_embedding_artifact",
    "write_embedding_artifact",
]

