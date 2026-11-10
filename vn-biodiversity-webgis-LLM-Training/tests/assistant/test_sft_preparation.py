"""Checks for the opt-in SFT labeling workflow."""

from __future__ import annotations

import json

import pytest

from biodiversity_ai.assistant.contracts import DatasetPartition
from biodiversity_ai.assistant.labeling.sft import (
    export_approved_sft,
    prepare_sft_review,
    review_source_snapshots,
)


def _write_dataset(root):
    partition = root / "train"
    partition.mkdir(parents=True)
    document = {
        "document_id": "doc-1", "entity_id": "species-1", "entity_type": "species",
        "section": "identification", "title": "Loài A", "content": "Loài A sống trong rừng.",
        "source_name": "Nguồn A", "source_url": "https://example.org/a", "content_hash": "hash-1",
    }
    example = {
        "example_id": "qa-1", "question": "Loài A sống ở đâu?",
        "intent": "species_distribution", "entity_ids": ["species-1"],
        "relevant_document_ids": ["doc-1"], "expected_facts": [document["content"]],
        "expected_citations": [document["source_url"]], "should_abstain": False,
    }
    (partition / "documents.jsonl").write_text(
        json.dumps(document, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    (partition / "examples.jsonl").write_text(
        json.dumps(example, ensure_ascii=False) + "\n", encoding="utf-8"
    )


def test_sft_requires_review_and_preserves_evidence(tmp_path):
    dataset = tmp_path / "dataset"
    _write_dataset(dataset)
    review = tmp_path / "review.jsonl"
    summary = prepare_sft_review(dataset, review)
    assert summary == {"prepared": 1, "missing_document_examples": 0}
    row = json.loads(review.read_text(encoding="utf-8"))
    assert row["approved"] is False
    assert row["approved_answer"] == ""
    assert row["evidence"][0]["document_id"] == "doc-1"

    row["approved"] = True
    row["approved_answer"] = "Loài A sống trong rừng [1]."
    review.write_text(json.dumps(row, ensure_ascii=False) + "\n", encoding="utf-8")
    output = tmp_path / "sft.jsonl"
    assert export_approved_sft(review, output)["exported"] == 1
    messages = json.loads(output.read_text(encoding="utf-8"))["messages"]
    assert [message["role"] for message in messages] == ["system", "user", "assistant"]
    assert "Loài A sống trong rừng." in messages[1]["content"]
    assert messages[2]["content"] == row["approved_answer"]


def test_sft_rejects_test_partition_and_invalid_citation(tmp_path):
    with pytest.raises(ValueError, match="test partition"):
        prepare_sft_review(tmp_path, tmp_path / "review.jsonl", partition=DatasetPartition.TEST)
    review = tmp_path / "review.jsonl"
    row = {
        "example_id": "qa-1", "partition": "train", "question": "Câu hỏi?",
        "evidence": [{"number": 1, "title": "Nguồn", "source_url": None,
                      "source_name": "Nguồn", "content": "Nội dung"}],
        "approved": True, "approved_answer": "Thông tin [2].", "should_abstain": False,
    }
    review.write_text(json.dumps(row, ensure_ascii=False) + "\n", encoding="utf-8")
    with pytest.raises(ValueError, match="unknown evidence"):
        export_approved_sft(review, tmp_path / "sft.jsonl")


def test_value_review_selects_use_instead_of_wood_description(tmp_path):
    review = tmp_path / "value-review.jsonl"
    record = {
        "example_id": "qa-value", "partition": "validation",
        "question": "Tông dù có công dụng gì?", "intent": "species_value",
        "draft_answer_for_review": "Gỗ có vân thẳng, màu nâu đỏ. [1]",
        "evidence": [{
            "number": 1, "title": "Tông dù", "source_url": "https://example.org/tong-du",
            "source_name": "Example", "content": (
                "Tông dù\nGỗ có dác màu nâu vàng, lõi màu nâu đỏ, vân thẳng. "
                "Gỗ có thể dùng trong xây dựng, đóng bàn ghế, làm tàu thuyền và nhạc cụ."
            ),
        }],
    }
    review.write_text(json.dumps(record, ensure_ascii=False) + "\n", encoding="utf-8")
    output = tmp_path / "reviewed.jsonl"
    assert review_source_snapshots(review, output)["snapshot_approved"] == 1
    result = json.loads(output.read_text(encoding="utf-8"))
    assert "đóng bàn ghế" in result["approved_answer"]
    assert "dác màu" not in result["approved_answer"]
    assert result["external_source_verified"] is False
