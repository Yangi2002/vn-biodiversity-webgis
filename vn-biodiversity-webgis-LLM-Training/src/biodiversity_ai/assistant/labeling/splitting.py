"""Leak-resistant entity-grouped dataset splitting."""

from __future__ import annotations

import hashlib
from collections import defaultdict
from collections.abc import Sequence

from biodiversity_ai.assistant.contracts import (
    CorpusDocument,
    DatasetPartition,
    DatasetSlice,
    DatasetSplits,
    LabeledExample,
)
from biodiversity_ai.assistant.corpus.normalization import normalize_lookup_key


def split_by_entity(
    documents: Sequence[CorpusDocument],
    examples: Sequence[LabeledExample],
    *,
    seed: str = "vn-biodiversity-v1",
    train_ratio: float = 0.70,
    validation_ratio: float = 0.15,
) -> DatasetSplits:
    """Assign every entity and its documents/examples to exactly one partition."""

    if not 0 < train_ratio < 1 or not 0 < validation_ratio < 1:
        raise ValueError("train_ratio and validation_ratio must be between 0 and 1.")
    if train_ratio + validation_ratio >= 1:
        raise ValueError("train_ratio + validation_ratio must be less than 1.")

    groups = _entity_groups(documents, examples)
    ordered_groups = sorted(
        groups,
        key=lambda group: _seeded_hash(seed, "|".join(group)),
    )
    group_assignments = _partition_assignments(
        ["|".join(group) for group in ordered_groups],
        train_ratio,
        validation_ratio,
    )
    assignments = {
        entity_id: group_assignments["|".join(group)]
        for group in ordered_groups
        for entity_id in group
    }

    documents_by_partition: dict[DatasetPartition, list[CorpusDocument]] = defaultdict(list)
    for document in documents:
        documents_by_partition[assignments[document.entity_id]].append(document)

    examples_by_partition: dict[DatasetPartition, list[LabeledExample]] = defaultdict(list)
    for example in examples:
        if example.entity_ids:
            partition = assignments[example.entity_ids[0]]
            if any(assignments[entity_id] is not partition for entity_id in example.entity_ids):
                raise ValueError("A multi-entity example crosses dataset partitions.")
        else:
            partition = _partition_for_value(seed, example.example_id, train_ratio, validation_ratio)
        examples_by_partition[partition].append(example)

    return DatasetSplits(
        train=_slice(DatasetPartition.TRAIN, documents_by_partition, examples_by_partition),
        validation=_slice(
            DatasetPartition.VALIDATION,
            documents_by_partition,
            examples_by_partition,
        ),
        test=_slice(DatasetPartition.TEST, documents_by_partition, examples_by_partition),
    )


def _entity_groups(
    documents: Sequence[CorpusDocument],
    examples: Sequence[LabeledExample],
) -> tuple[tuple[str, ...], ...]:
    """Keep entities sharing exact content or questions in one partition."""

    entity_ids = {document.entity_id for document in documents}
    entity_ids.update(entity_id for example in examples for entity_id in example.entity_ids)
    parents = {entity_id: entity_id for entity_id in entity_ids}

    def find(entity_id: str) -> str:
        root = entity_id
        while parents[root] != root:
            root = parents[root]
        while parents[entity_id] != entity_id:
            parent = parents[entity_id]
            parents[entity_id] = root
            entity_id = parent
        return root

    def union(left: str, right: str) -> None:
        left_root = find(left)
        right_root = find(right)
        if left_root != right_root:
            parents[max(left_root, right_root)] = min(left_root, right_root)

    first_by_content: dict[str, str] = {}
    for document in documents:
        previous = first_by_content.setdefault(document.content_hash, document.entity_id)
        union(previous, document.entity_id)

    first_by_question: dict[str, str] = {}
    for example in examples:
        if not example.entity_ids:
            continue
        primary = example.entity_ids[0]
        for entity_id in example.entity_ids[1:]:
            union(primary, entity_id)
        question = normalize_lookup_key(example.question)
        previous = first_by_question.setdefault(question, primary)
        union(previous, primary)

    members: dict[str, list[str]] = defaultdict(list)
    for entity_id in sorted(entity_ids):
        members[find(entity_id)].append(entity_id)
    return tuple(tuple(group) for group in members.values())


def _partition_assignments(
    entity_ids: Sequence[str],
    train_ratio: float,
    validation_ratio: float,
) -> dict[str, DatasetPartition]:
    count = len(entity_ids)
    if count == 0:
        return {}
    train_count = int(count * train_ratio)
    validation_count = int(count * validation_ratio)
    if count >= 3:
        train_count = max(1, min(train_count, count - 2))
        validation_count = max(1, min(validation_count, count - train_count - 1))
    assignments: dict[str, DatasetPartition] = {}
    for index, entity_id in enumerate(entity_ids):
        if index < train_count:
            partition = DatasetPartition.TRAIN
        elif index < train_count + validation_count:
            partition = DatasetPartition.VALIDATION
        else:
            partition = DatasetPartition.TEST
        assignments[entity_id] = partition
    return assignments


def _partition_for_value(
    seed: str,
    value: str,
    train_ratio: float,
    validation_ratio: float,
) -> DatasetPartition:
    score = int(_seeded_hash(seed, value)[:12], 16) / float(16**12)
    if score < train_ratio:
        return DatasetPartition.TRAIN
    if score < train_ratio + validation_ratio:
        return DatasetPartition.VALIDATION
    return DatasetPartition.TEST


def _seeded_hash(seed: str, value: str) -> str:
    return hashlib.sha256(f"{seed}:{value}".encode()).hexdigest()


def _slice(
    partition: DatasetPartition,
    documents: dict[DatasetPartition, list[CorpusDocument]],
    examples: dict[DatasetPartition, list[LabeledExample]],
) -> DatasetSlice:
    return DatasetSlice(
        partition=partition,
        documents=tuple(documents[partition]),
        examples=tuple(examples[partition]),
    )

