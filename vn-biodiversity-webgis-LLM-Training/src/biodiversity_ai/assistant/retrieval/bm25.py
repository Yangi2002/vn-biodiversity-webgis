"""Dependency-light BM25 retrieval baseline for reproducible comparison."""

from __future__ import annotations

import math
import re
from collections import Counter
from collections.abc import Sequence

from biodiversity_ai.assistant.contracts import CorpusDocument, RetrievalHit
from biodiversity_ai.assistant.corpus.normalization import normalize_lookup_key

_TOKEN = re.compile(r"[a-z0-9]+")


class Bm25Retriever:
    """Small baseline retriever; later embeddings must outperform this model."""

    def __init__(
        self,
        documents: Sequence[CorpusDocument],
        *,
        k1: float = 1.5,
        b: float = 0.75,
    ) -> None:
        self._documents = tuple(documents)
        self._k1 = k1
        self._b = b
        self._tokens = tuple(_tokens(f"{doc.title} {doc.content}") for doc in documents)
        self._term_frequencies = tuple(Counter(tokens) for tokens in self._tokens)
        self._document_lengths = tuple(len(tokens) for tokens in self._tokens)
        self._average_length = (
            sum(self._document_lengths) / len(self._document_lengths)
            if self._document_lengths
            else 0.0
        )
        document_frequency: Counter[str] = Counter()
        for tokens in self._tokens:
            document_frequency.update(set(tokens))
        self._document_frequency = document_frequency

    def search(self, query: str, *, limit: int = 5) -> tuple[RetrievalHit, ...]:
        if limit < 1:
            raise ValueError("limit must be positive.")
        query_terms = set(_tokens(query))
        if not query_terms or not self._documents:
            return ()

        scored = [
            (index, self._score(index, query_terms))
            for index in range(len(self._documents))
        ]
        ranked = sorted(
            ((index, score) for index, score in scored if score > 0),
            key=lambda item: (-item[1], self._documents[item[0]].document_id),
        )[:limit]
        return tuple(
            RetrievalHit(document=self._documents[index], score=score, rank=rank)
            for rank, (index, score) in enumerate(ranked, start=1)
        )

    def _score(self, index: int, query_terms: set[str]) -> float:
        if self._average_length == 0:
            return 0.0
        score = 0.0
        frequencies = self._term_frequencies[index]
        document_length = self._document_lengths[index]
        document_count = len(self._documents)
        for term in query_terms:
            frequency = frequencies.get(term, 0)
            if frequency == 0:
                continue
            containing_documents = self._document_frequency[term]
            inverse_document_frequency = math.log(
                1 + (document_count - containing_documents + 0.5) / (containing_documents + 0.5)
            )
            denominator = frequency + self._k1 * (
                1 - self._b + self._b * document_length / self._average_length
            )
            score += inverse_document_frequency * frequency * (self._k1 + 1) / denominator
        return score


def _tokens(value: str) -> tuple[str, ...]:
    return tuple(_TOKEN.findall(normalize_lookup_key(value)))

