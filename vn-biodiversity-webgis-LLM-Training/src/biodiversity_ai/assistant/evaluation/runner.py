"""Offline validation and final-test evaluation for the retrieval baseline."""

from __future__ import annotations

import re
from collections.abc import Sequence

from biodiversity_ai.assistant.contracts import (
    DatasetSlice,
    EvaluationReport,
    LabeledExample,
)
from biodiversity_ai.assistant.corpus.normalization import normalize_lookup_key
from biodiversity_ai.assistant.retrieval import Bm25Retriever, ExtractiveBaselineAssistant

_TOKEN = re.compile(r"[a-z0-9]+")


def evaluate_baseline(
    dataset_slice: DatasetSlice,
    *,
    retrieval_limit: int = 5,
    minimum_score: float = 0.0,
    example_limit: int | None = None,
) -> EvaluationReport:
    """Evaluate one locked partition without mutating its documents or labels."""

    if example_limit is not None and example_limit < 1:
        raise ValueError("example_limit must be positive when provided.")
    examples = (
        tuple(sorted(dataset_slice.examples, key=lambda example: example.example_id))[
            :example_limit
        ]
        if example_limit is not None
        else dataset_slice.examples
    )
    if not examples:
        return EvaluationReport(
            partition=dataset_slice.partition,
            evaluated_examples=0,
            recall_at_k=0.0,
            mean_reciprocal_rank=0.0,
            citation_precision=0.0,
            factual_token_recall=0.0,
            abstention_accuracy=0.0,
        )

    assistant = ExtractiveBaselineAssistant(
        Bm25Retriever(dataset_slice.documents),
        minimum_score=minimum_score,
    )
    recalls: list[float] = []
    reciprocal_ranks: list[float] = []
    citation_precisions: list[float] = []
    factual_recalls: list[float] = []
    abstentions: list[float] = []

    for example in examples:
        answer = assistant.answer(example.question, limit=retrieval_limit)
        hit_ids = [hit.document.document_id for hit in answer.hits]
        relevant = set(example.relevant_document_ids)
        recalls.append(_retrieval_recall(hit_ids, relevant))
        reciprocal_ranks.append(_reciprocal_rank(hit_ids, relevant))
        citation_precisions.append(
            _citation_precision(answer.citations, set(example.expected_citations))
        )
        factual_recalls.append(_factual_recall(answer.answer, example))
        abstentions.append(float(answer.abstained is example.should_abstain))

    return EvaluationReport(
        partition=dataset_slice.partition,
        evaluated_examples=len(examples),
        recall_at_k=_mean(recalls),
        mean_reciprocal_rank=_mean(reciprocal_ranks),
        citation_precision=_mean(citation_precisions),
        factual_token_recall=_mean(factual_recalls),
        abstention_accuracy=_mean(abstentions),
    )


def _retrieval_recall(hit_ids: Sequence[str], relevant: set[str]) -> float:
    if not relevant:
        return 1.0 if not hit_ids else 0.0
    return len(set(hit_ids) & relevant) / len(relevant)


def _reciprocal_rank(hit_ids: Sequence[str], relevant: set[str]) -> float:
    for rank, document_id in enumerate(hit_ids, start=1):
        if document_id in relevant:
            return 1.0 / rank
    return 0.0


def _citation_precision(citations: Sequence[str], expected: set[str]) -> float:
    if not citations:
        return 1.0 if not expected else 0.0
    return len(set(citations) & expected) / len(set(citations))


def _factual_recall(answer: str | None, example: LabeledExample) -> float:
    if not example.expected_facts:
        return 1.0 if answer is None else 0.0
    answer_tokens = _tokens(answer or "")
    expected_tokens = _tokens(" ".join(example.expected_facts))
    if not expected_tokens:
        return 1.0
    return len(answer_tokens & expected_tokens) / len(expected_tokens)


def _tokens(value: str) -> set[str]:
    return set(_TOKEN.findall(normalize_lookup_key(value)))


def _mean(values: Sequence[float]) -> float:
    return sum(values) / len(values) if values else 0.0

