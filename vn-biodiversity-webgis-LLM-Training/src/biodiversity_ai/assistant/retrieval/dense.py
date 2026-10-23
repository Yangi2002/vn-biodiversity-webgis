"""Dense cosine retrieval over immutable embedding artifacts."""

from __future__ import annotations

from collections.abc import Sequence
from typing import Any

from biodiversity_ai.assistant.contracts import CorpusDocument, RetrievalHit
from biodiversity_ai.llm import TextEmbedder


class DenseRetriever:
    def __init__(
        self,
        documents: Sequence[CorpusDocument],
        vectors: object,
        embedder: TextEmbedder,
    ) -> None:
        self._documents = tuple(documents)
        self._vectors = _numpy().asarray(vectors, dtype=_numpy().float32)
        self._embedder = embedder
        if self._vectors.ndim != 2 or self._vectors.shape[0] != len(self._documents):
            raise ValueError("Dense vectors must have one row per document.")

    def search(self, query: str, *, limit: int = 5) -> tuple[RetrievalHit, ...]:
        if limit < 1:
            raise ValueError("limit must be positive.")
        if not query.strip() or not self._documents:
            return ()
        np = _numpy()
        query_vector = np.asarray(self._embedder.encode_queries((query,)), dtype=np.float32)[0]
        return self.search_vector(query_vector, limit=limit)

    def search_vector(
        self,
        query_vector: object,
        *,
        limit: int = 5,
    ) -> tuple[RetrievalHit, ...]:
        if limit < 1:
            raise ValueError("limit must be positive.")
        if not self._documents:
            return ()
        np = _numpy()
        query_vector = np.asarray(query_vector, dtype=np.float32)
        scores = self._vectors @ query_vector
        candidate_count = min(limit, len(self._documents))
        indexes = np.argpartition(-scores, candidate_count - 1)[:candidate_count]
        ranked_indexes = sorted(
            (int(index) for index in indexes),
            key=lambda index: (-float(scores[index]), self._documents[index].document_id),
        )
        return tuple(
            RetrievalHit(
                document=self._documents[index],
                score=float(scores[index]),
                rank=rank,
            )
            for rank, index in enumerate(ranked_indexes, start=1)
        )


def _numpy() -> Any:
    try:
        import numpy as np
    except ImportError as error:
        raise RuntimeError("Dense retrieval requires the optional 'rag' dependencies.") from error
    return np

