"""Deterministic seed labels derived from retrieval documents."""

from __future__ import annotations

import hashlib
from collections.abc import Sequence

from biodiversity_ai.assistant.contracts import (
    AssistantIntent,
    CorpusDocument,
    LabeledExample,
)

_SECTION_LABELS: dict[str, tuple[AssistantIntent, str]] = {
    "identification": (
        AssistantIntent.SPECIES_IDENTIFICATION,
        "{name} có đặc điểm nhận dạng như thế nào?",
    ),
    "biology_ecology": (
        AssistantIntent.SPECIES_ECOLOGY,
        "Sinh học và sinh thái của {name} có gì đáng chú ý?",
    ),
    "distribution": (
        AssistantIntent.SPECIES_DISTRIBUTION,
        "{name} phân bố ở đâu?",
    ),
    "conservation": (
        AssistantIntent.SPECIES_CONSERVATION,
        "Tình trạng và biện pháp bảo tồn {name} là gì?",
    ),
    "value_and_use": (
        AssistantIntent.SPECIES_VALUE,
        "{name} có giá trị hoặc công dụng gì?",
    ),
    "description": (
        AssistantIntent.SPECIES_DESCRIPTION,
        "Hãy mô tả tổng quan về {name}.",
    ),
    "scientific_literature": (
        AssistantIntent.SCIENTIFIC_LITERATURE,
        "Có nghiên cứu khoa học nào cung cấp thông tin về {name}?",
    ),
}


def build_seed_labels(documents: Sequence[CorpusDocument]) -> tuple[LabeledExample, ...]:
    """Create reproducible labels that remain traceable to source documents."""

    examples: list[LabeledExample] = []
    for document in documents:
        label = _SECTION_LABELS.get(document.section)
        if label is None:
            continue
        intent, template = label
        name = (
            document.metadata.get("vietnamese_name")
            or document.metadata.get("scientific_name")
            or document.title.split(" - ", maxsplit=1)[0]
        )
        question = template.format(name=name)
        citations = (document.source_url,) if document.source_url else ()
        examples.append(
            LabeledExample(
                example_id=_example_id(document.document_id, question),
                question=question,
                intent=intent,
                entity_ids=(document.entity_id,),
                relevant_document_ids=(document.document_id,),
                expected_facts=(document.content,),
                expected_citations=citations,
            )
        )
    return tuple(examples)


def build_abstention_labels(questions: Sequence[str]) -> tuple[LabeledExample, ...]:
    """Create negative examples for questions unsupported by the corpus."""

    return tuple(
        LabeledExample(
            example_id=_example_id("unsupported", question),
            question=question.strip(),
            intent=AssistantIntent.UNSUPPORTED,
            entity_ids=(),
            relevant_document_ids=(),
            expected_facts=(),
            expected_citations=(),
            should_abstain=True,
        )
        for question in questions
        if question.strip()
    )


def _example_id(document_id: str, question: str) -> str:
    value = f"{document_id}|{' '.join(question.casefold().split())}".encode()
    return f"qa-{hashlib.sha256(value).hexdigest()[:20]}"

