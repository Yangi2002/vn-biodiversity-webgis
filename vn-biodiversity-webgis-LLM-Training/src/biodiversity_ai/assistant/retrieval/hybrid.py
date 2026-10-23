"""Rank-fusion retrieval combining lexical and dense evidence."""

from __future__ import annotations

from typing import Protocol

from biodiversity_ai.assistant.contracts import RetrievalHit


class Retriever(Protocol):
    def search(self, query: str, *, limit: int = 5) -> tuple[RetrievalHit, ...]: ...


class HybridRetriever:
    """Weighted reciprocal-rank fusion without mixing incomparable raw scores."""

    def __init__(
        self,
        keyword_retriever: Retriever,
        dense_retriever: Retriever,
        *,
        keyword_weight: float = 1.0,
        dense_weight: float = 1.0,
        rrf_constant: int = 60,
        candidate_multiplier: int = 4,
    ) -> None:
        if keyword_weight <= 0 or dense_weight <= 0:
            raise ValueError("Hybrid weights must be positive.")
        self._keyword = keyword_retriever
        self._dense = dense_retriever
        self._keyword_weight = keyword_weight
        self._dense_weight = dense_weight
        self._rrf_constant = rrf_constant
        self._candidate_multiplier = candidate_multiplier

    def search(self, query: str, *, limit: int = 5) -> tuple[RetrievalHit, ...]:
        candidate_limit = max(limit, limit * self._candidate_multiplier)
        keyword_hits = self._keyword.search(query, limit=candidate_limit)
        dense_hits = self._dense.search(query, limit=candidate_limit)
        return fuse_ranked_hits(
            keyword_hits,
            dense_hits,
            limit=limit,
            keyword_weight=self._keyword_weight,
            dense_weight=self._dense_weight,
            rrf_constant=self._rrf_constant,
        )


def fuse_ranked_hits(
    keyword_hits: tuple[RetrievalHit, ...],
    dense_hits: tuple[RetrievalHit, ...],
    *,
    limit: int,
    keyword_weight: float = 1.0,
    dense_weight: float = 1.0,
    rrf_constant: int = 60,
) -> tuple[RetrievalHit, ...]:
    documents = {
        hit.document.document_id: hit.document for hit in (*keyword_hits, *dense_hits)
    }
    scores: dict[str, float] = {}
    for hit in keyword_hits:
        scores[hit.document.document_id] = scores.get(hit.document.document_id, 0.0) + (
            keyword_weight / (rrf_constant + hit.rank)
        )
    for hit in dense_hits:
        scores[hit.document.document_id] = scores.get(hit.document.document_id, 0.0) + (
            dense_weight / (rrf_constant + hit.rank)
        )
    ranked = sorted(scores, key=lambda key: (-scores[key], key))[:limit]
    return tuple(
        RetrievalHit(
            document=documents[document_id],
            score=scores[document_id],
            rank=rank,
        )
        for rank, document_id in enumerate(ranked, start=1)
    )

