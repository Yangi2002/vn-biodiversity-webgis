"""Extractive assistant baseline grounded only in retrieved documents."""

from __future__ import annotations

from biodiversity_ai.assistant.contracts import BaselineAnswer

from .bm25 import Bm25Retriever


class ExtractiveBaselineAssistant:
    """Returns top evidence verbatim so later LLM variants have a fair baseline."""

    def __init__(self, retriever: Bm25Retriever, *, minimum_score: float = 0.0) -> None:
        self._retriever = retriever
        self._minimum_score = minimum_score

    def answer(self, question: str, *, limit: int = 5) -> BaselineAnswer:
        hits = self._retriever.search(question, limit=limit)
        if not hits or hits[0].score <= self._minimum_score:
            return BaselineAnswer(
                question=question,
                answer=None,
                citations=(),
                hits=hits,
                abstained=True,
            )

        citations = tuple(
            dict.fromkeys(
                hit.document.source_url
                for hit in hits
                if hit.document.source_url is not None
            )
        )
        return BaselineAnswer(
            question=question,
            answer=hits[0].document.content,
            citations=citations,
            hits=hits,
            abstained=False,
        )

