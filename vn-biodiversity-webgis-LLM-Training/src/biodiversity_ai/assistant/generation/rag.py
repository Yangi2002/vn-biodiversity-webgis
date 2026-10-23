"""Grounded RAG generation over retrieved and optionally reranked evidence."""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from typing import Protocol

from biodiversity_ai.assistant.contracts import RetrievalHit
from biodiversity_ai.assistant.retrieval import Retriever
from biodiversity_ai.llm import TextGenerator


class EvidenceReranker(Protocol):
    def rerank(
        self,
        query: str,
        hits: Sequence[RetrievalHit],
        *,
        limit: int,
    ) -> tuple[RetrievalHit, ...]: ...


@dataclass(frozen=True, slots=True)
class RagAnswer:
    question: str
    answer: str | None
    citations: tuple[str, ...]
    evidence: tuple[RetrievalHit, ...]
    abstained: bool


class GroundedRagAssistant:
    def __init__(
        self,
        retriever: Retriever,
        generator: TextGenerator,
        *,
        reranker: EvidenceReranker | None = None,
        candidate_limit: int = 20,
        evidence_limit: int = 5,
    ) -> None:
        self._retriever = retriever
        self._generator = generator
        self._reranker = reranker
        self._candidate_limit = candidate_limit
        self._evidence_limit = evidence_limit

    def answer(self, question: str) -> RagAnswer:
        candidates = self._retriever.search(question, limit=self._candidate_limit)
        evidence = (
            self._reranker.rerank(question, candidates, limit=self._evidence_limit)
            if self._reranker is not None
            else candidates[: self._evidence_limit]
        )
        if not evidence:
            return RagAnswer(question, None, (), (), True)
        answer = self._generator.generate(_grounded_prompt(question, evidence)).strip()
        citations = tuple(
            dict.fromkeys(
                hit.document.source_url or hit.document.source_name
                for hit in evidence
            )
        )
        return RagAnswer(
            question=question,
            answer=answer or None,
            citations=citations,
            evidence=evidence,
            abstained=not answer,
        )


def _grounded_prompt(question: str, evidence: Sequence[RetrievalHit]) -> str:
    blocks = []
    for index, hit in enumerate(evidence, start=1):
        source = hit.document.source_url or hit.document.source_name
        blocks.append(
            f"[{index}] {hit.document.title}\n"
            f"Nguồn: {source}\n"
            f"Nội dung: {hit.document.content}"
        )
    context = "\n\n".join(blocks)
    return (
        "Bạn là trợ lý tri thức đa dạng sinh học Việt Nam. "
        "Chỉ trả lời bằng chứng bên dưới. Nếu bằng chứng không đủ, "
        "hãy nói rõ không đủ dữ liệu. Không tự tạo tên loài, địa điểm hay tài liệu. "
        "Dẫn nguồn bằng ký hiệu [1], [2].\n\n"
        f"Câu hỏi: {question}\n\n"
        f"Bằng chứng:\n{context}\n\n"
        "Trả lời:"
    )

