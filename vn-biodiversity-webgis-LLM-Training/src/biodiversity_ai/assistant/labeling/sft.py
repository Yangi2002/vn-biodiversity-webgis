"""Prepare source-grounded SFT examples for explicit human review."""

from __future__ import annotations

import json
import re
import hashlib
from collections import Counter, defaultdict, deque
from pathlib import Path

from biodiversity_ai.assistant.contracts import CorpusDocument, DatasetPartition, LabeledExample
from biodiversity_ai.assistant.corpus.dataset_io import load_dataset_slice


SYSTEM_MESSAGE = (
    "Bạn là trợ lý tri thức đa dạng sinh học Việt Nam. Chỉ trả lời dựa trên "
    "bằng chứng được cung cấp. Nếu không đủ bằng chứng, hãy nói rõ không đủ "
    "dữ liệu. Dẫn nguồn bằng ký hiệu [1], [2] cho từng thông tin liên quan."
)


def prepare_sft_review(
    dataset_directory: Path,
    output: Path,
    *,
    partition: DatasetPartition = DatasetPartition.TRAIN,
    limit: int | None = None,
    balanced: bool = False,
) -> dict[str, int]:
    if partition == DatasetPartition.TEST:
        raise ValueError("The test partition must remain sealed during SFT preparation.")
    if limit is not None and limit < 1:
        raise ValueError("limit must be positive.")
    if output.resolve().is_relative_to(dataset_directory.resolve()):
        raise ValueError("SFT review output must not modify the locked dataset.")
    dataset = load_dataset_slice(dataset_directory, partition)
    documents = {document.document_id: document for document in dataset.documents}
    if len(documents) != len(dataset.documents):
        raise ValueError("Duplicate document IDs in dataset partition.")
    rows: list[dict[str, object]] = []
    missing = 0
    examples = (
        _balanced_examples(dataset.examples, documents, limit)
        if balanced else dataset.examples[:limit]
    )
    for example in examples:
        missing_ids = [
            document_id for document_id in example.relevant_document_ids
            if document_id not in documents
        ]
        if missing_ids:
            missing += 1
            continue
        evidence = [
            {
                "number": index,
                "document_id": document_id,
                "title": documents[document_id].title,
                "content": documents[document_id].content,
                "source_name": documents[document_id].source_name,
                "source_url": documents[document_id].source_url,
            }
            for index, document_id in enumerate(example.relevant_document_ids, start=1)
        ]
        draft = _extractive_draft(evidence, example.should_abstain)
        rows.append({
            "example_id": example.example_id,
            "partition": partition.value,
            "question": example.question,
            "intent": example.intent.value,
            "entity_ids": list(example.entity_ids),
            "should_abstain": example.should_abstain,
            "evidence": evidence,
            "expected_facts_for_review": list(example.expected_facts),
            "expected_citations_for_review": list(example.expected_citations),
            "draft_answer_for_review": draft,
            "approved_answer": "",
            "approved": False,
        })
    _write_jsonl(output, rows)
    return {"prepared": len(rows), "missing_document_examples": missing}


def _balanced_examples(
    examples: tuple[LabeledExample, ...],
    documents: dict[str, CorpusDocument],
    limit: int | None,
) -> tuple[LabeledExample, ...]:
    groups: dict[str, deque[LabeledExample]] = {}
    by_intent: dict[str, list[LabeledExample]] = defaultdict(list)
    for example in examples:
        if example.intent.value == "scientific_literature":
            continue
        if "đang cập nhật" in example.question.casefold():
            continue
        if not example.relevant_document_ids:
            continue
        sources = [documents.get(document_id) for document_id in example.relevant_document_ids]
        if any(
            source is None or not source.source_url or len(source.content.strip()) < 80
            or "đang cập nhật" in source.title.casefold()
            for source in sources
        ):
            continue
        by_intent[example.intent.value].append(example)
    for intent, items in by_intent.items():
        groups[intent] = deque(sorted(
            items,
            key=lambda item: hashlib.sha256(item.example_id.encode()).hexdigest(),
        ))
    selected: list[LabeledExample] = []
    seen_entities: set[tuple[str, str]] = set()
    # One example per entity and intent in the first pass spreads coverage.
    for unique_only in (True, False):
        while groups and (limit is None or len(selected) < limit):
            progress = False
            for intent in sorted(tuple(groups)):
                queue = groups[intent]
                if unique_only:
                    eligible = next((
                        item for item in queue
                        if (intent, item.entity_ids[0] if item.entity_ids else item.example_id)
                        not in seen_entities
                    ), None)
                    if eligible is None:
                        continue
                    queue.remove(eligible)
                else:
                    eligible = queue.popleft()
                selected.append(eligible)
                seen_entities.add((intent, eligible.entity_ids[0] if eligible.entity_ids else eligible.example_id))
                progress = True
                if not queue:
                    del groups[intent]
                if limit is not None and len(selected) >= limit:
                    break
            if not progress:
                break
    return tuple(selected)


def _extractive_draft(evidence: list[dict[str, object]], should_abstain: bool) -> str:
    if should_abstain or not evidence:
        return "Không đủ dữ liệu trong bằng chứng được cung cấp để trả lời."
    content = str(evidence[0]["content"])
    paragraphs = [part.strip() for part in content.splitlines() if part.strip()]
    body = paragraphs[1] if len(paragraphs) > 1 else paragraphs[0]
    sentences = re.split(r"(?<=[.!?])\s+", body)
    draft = " ".join(sentences[:2]).strip()
    if len(draft) > 480:
        draft = draft[:480].rsplit(" ", 1)[0] + "…"
    return f"{draft} [1]" if draft else ""


def export_approved_sft(review_file: Path, output: Path) -> dict[str, int]:
    if review_file.resolve() == output.resolve():
        raise ValueError("Review input and SFT output must differ.")
    rows: list[dict[str, object]] = []
    rejected = 0
    seen_ids: set[str] = set()
    with review_file.open(encoding="utf-8") as source:
        for line_number, line in enumerate(source, start=1):
            if not line.strip():
                continue
            record = json.loads(line)
            if record.get("partition") not in ("train", "validation"):
                raise ValueError(f"Invalid SFT partition at line {line_number}.")
            example_id = str(record["example_id"])
            if example_id in seen_ids:
                raise ValueError(f"Duplicate example ID: {example_id}.")
            seen_ids.add(example_id)
            if record.get("approved") is not True:
                rejected += 1
                continue
            answer = str(record.get("approved_answer", "")).strip()
            if not answer:
                raise ValueError(f"Approved example {example_id} has no answer.")
            evidence = record["evidence"]
            if not isinstance(evidence, list):
                raise ValueError(f"Invalid evidence for {example_id}.")
            if not evidence and not record.get("should_abstain"):
                raise ValueError(f"No evidence for non-abstention example {example_id}.")
            references = {int(number) for number in re.findall(r"\[(\d+)\]", answer)}
            allowed = {int(item["number"]) for item in evidence}
            if references - allowed:
                raise ValueError(f"Approved answer {example_id} cites unknown evidence.")
            if not record.get("should_abstain") and not references:
                raise ValueError(f"Approved answer {example_id} lacks an evidence citation.")
            context = "\n\n".join(
                f"[{item['number']}] {item['title']}\n"
                f"Nguồn: {item['source_url'] or item['source_name']}\n"
                f"Nội dung: {item['content']}"
                for item in evidence
            )
            rows.append({
                "example_id": example_id,
                "partition": record["partition"],
                "messages": [
                    {"role": "system", "content": SYSTEM_MESSAGE},
                    {"role": "user", "content": f"Câu hỏi: {record['question']}\n\nBằng chứng:\n{context}"},
                    {"role": "assistant", "content": answer},
                ],
            })
    _write_jsonl(output, rows)
    return {"exported": len(rows), "not_approved": rejected}


def review_source_snapshots(review_file: Path, output: Path) -> dict[str, int]:
    """Approve only exact, complete excerpts; do not imply live URL verification."""
    if review_file.resolve() == output.resolve():
        raise ValueError("Input and output must differ.")
    rows: list[dict[str, object]] = []
    approved = 0
    with review_file.open(encoding="utf-8") as source:
        for line in source:
            if not line.strip():
                continue
            row = json.loads(line)
            if row.get("partition") not in ("train", "validation"):
                raise ValueError("Only train or validation can be reviewed.")
            evidence = row.get("evidence", [])
            draft = str(row.get("draft_answer_for_review", ""))
            if row.get("intent") == "species_value" and len(evidence) == 1:
                draft = _value_draft(str(evidence[0].get("content", "")))
            reason = _snapshot_review_reason(row, evidence, draft)
            row["draft_answer_for_review"] = draft
            row["approved_answer"] = draft if reason is None else ""
            row["approved"] = reason is None
            row["approval_basis"] = "automated_source_snapshot" if reason is None else None
            row["external_source_verified"] = False
            row["review_note"] = reason or "Trích đoạn khớp bản chụp nguồn; chưa kiểm tra URL trực tiếp."
            approved += reason is None
            rows.append(row)
    _write_jsonl(output, rows)
    return {"reviewed": len(rows), "snapshot_approved": approved,
            "needs_review": len(rows) - approved}


def _snapshot_review_reason(
    row: dict[str, object], evidence: list[dict[str, object]], draft: str
) -> str | None:
    if len(evidence) != 1 or not evidence[0].get("source_url"):
        return "Thiếu một bằng chứng nguồn rõ ràng."
    if not draft.endswith(" [1]") or "…" in draft or len(draft) < 65:
        return "Bản nháp quá ngắn hoặc bị cắt dở."
    text = draft[:-4]
    content = str(evidence[0]["content"])
    if " ".join(text.split()) not in " ".join(content.split()):
        return "Bản nháp không khớp nguyên văn bản chụp nguồn."
    if any(fragment in text.casefold() for fragment in (
        "footer", "quang cao", "webadmin", "đang cập nhật", "chưa có số liệu",
        "tài liệu tham khảo", "nguồn ảnh", "http://", "https://",
    )):
        return "Bản nháp chứa nội dung giao diện hoặc chưa có dữ liệu."
    if row.get("intent") == "species_conservation":
        return "Cần kiểm tra riêng cả tình trạng và biện pháp bảo tồn."
    if row.get("intent") == "species_value" and not re.search(
        r"\b(dùng|sử dụng|làm|giá trị|nguồn gen|thực phẩm|lấy gỗ|ăn được|"
        r"trồng làm|nghiên cứu|bảo tồn)\b", text.casefold()
    ):
        return "Chỉ mô tả đặc điểm, chưa trả lời giá trị hoặc công dụng."
    if row.get("intent") == "species_description" and len(text) < 120:
        return "Mô tả quá sơ lược."
    return None


def _value_draft(content: str) -> str:
    body = content.split("\n", 1)[-1].strip()
    sentences = re.split(r"(?<=[.!?])\s+", body)
    use_pattern = re.compile(
        r"\b(dùng|sử dụng|làm|giá trị|nguồn gen|thực phẩm|lấy gỗ|ăn được|"
        r"trồng làm|nghiên cứu|bảo tồn)\b", re.IGNORECASE
    )
    candidates = [
        sentence.strip() for sentence in sentences
        if use_pattern.search(sentence)
        and 40 <= len(sentence.strip()) <= 460
        and sentence.strip().endswith((".", "!", "?"))
    ]
    return f"{candidates[0]} [1]" if candidates else ""


def build_sft_gap_examples(
    review_file: Path,
    output: Path,
    *,
    conservation_limit: int = 80,
    abstention_limit: int = 50,
) -> dict[str, int]:
    """Add conservative source-backed conservation and irrelevant-evidence examples."""
    with review_file.open(encoding="utf-8") as source:
        candidates = [json.loads(line) for line in source if line.strip()]
    partitions = {row.get("partition") for row in candidates}
    if len(partitions) != 1 or partitions.pop() not in ("train", "validation"):
        raise ValueError("Gap examples must come from one train/validation partition.")
    if conservation_limit < 0 or abstention_limit < 0:
        raise ValueError("Example limits must be non-negative.")
    conservation: list[dict[str, object]] = []
    for row in candidates:
        if row.get("intent") != "species_conservation" or len(conservation) >= conservation_limit:
            continue
        evidence = row.get("evidence", [])
        if len(evidence) != 1 or not evidence[0].get("source_url"):
            continue
        answer = _conservation_draft(str(evidence[0]["content"]))
        if not answer:
            continue
        revised = dict(row)
        revised.update(
            approved_answer=answer,
            approved=True,
            approval_basis="automated_two_fact_snapshot",
            external_source_verified=False,
            review_note="Tình trạng và biện pháp đều lấy từ bản chụp nguồn; cần rà khoa học.",
        )
        conservation.append(revised)

    supported = [
        row for row in candidates
        if row.get("intent") != "species_conservation"
        and row.get("entity_ids") and len(row.get("evidence", [])) == 1
        and row["evidence"][0].get("source_url")
    ]
    abstentions: list[dict[str, object]] = []
    for index, row in enumerate(supported):
        if len(abstentions) >= abstention_limit:
            break
        other = supported[(index + len(supported) // 2) % len(supported)]
        if row["entity_ids"][0] == other["entity_ids"][0]:
            continue
        other_content = str(other["evidence"][0]["content"]).casefold()
        if any(term in other_content for term in (
            str(row["evidence"][0]["title"]).split(" - ")[0].casefold(),
            str(row["entity_ids"][0]).casefold(),
        )):
            continue
        abstentions.append({
            "example_id": f"{row['example_id']}-no-evidence",
            "partition": row["partition"],
            "question": row["question"],
            "intent": "unsupported",
            "entity_ids": row["entity_ids"],
            "should_abstain": True,
            "evidence": other["evidence"],
            "expected_facts_for_review": [],
            "expected_citations_for_review": [],
            "draft_answer_for_review": "Không đủ dữ liệu trong bằng chứng được cung cấp để trả lời.",
            "approved_answer": "Không đủ dữ liệu trong bằng chứng được cung cấp để trả lời.",
            "approved": True,
            "approval_basis": "synthetic_irrelevant_evidence",
            "external_source_verified": False,
            "review_note": "Bằng chứng thuộc thực thể khác; kiểm tra trước khi huấn luyện.",
        })
    _write_jsonl(output, conservation + abstentions)
    return {"conservation": len(conservation), "abstention": len(abstentions)}


def combine_sft_reviews(base_file: Path, gaps_file: Path, output: Path) -> dict[str, int]:
    """Combine reviewed examples and gaps without changing the locked dataset."""
    rows: list[dict[str, object]] = []
    seen_ids: set[str] = set()
    partitions: set[str] = set()
    for source_file in (base_file, gaps_file):
        with source_file.open(encoding="utf-8") as source:
            for line in source:
                if not line.strip():
                    continue
                row = json.loads(line)
                example_id = str(row["example_id"])
                if example_id in seen_ids:
                    raise ValueError(f"Duplicate example ID: {example_id}")
                seen_ids.add(example_id)
                partitions.add(str(row["partition"]))
                rows.append(row)
    if len(partitions) != 1 or not partitions.issubset({"train", "validation"}):
        raise ValueError("Cannot combine different SFT partitions.")
    _write_jsonl(output, rows)
    return {"combined": len(rows), "approved": sum(row.get("approved") is True for row in rows)}


def export_sft_review_queue(review_file: Path, output: Path) -> dict[str, int]:
    """Copy only held examples to a small file for manual inspection."""
    if review_file.resolve() == output.resolve():
        raise ValueError("Review input and queue output must differ.")
    pending: list[dict[str, object]] = []
    with review_file.open(encoding="utf-8") as source:
        for line in source:
            if line.strip():
                row = json.loads(line)
                if row.get("approved") is not True:
                    pending.append(row)
    _write_jsonl(output, pending)
    return {"pending": len(pending)}


def _conservation_draft(content: str) -> str:
    body = content.split("\n", 1)[-1]
    sentences = [sentence.strip() for sentence in re.split(r"(?<=[.!?])\s+", body)]
    status = next((sentence for sentence in sentences if
        re.search(r"suy giảm|đe dọa|hiếm|nguy cấp|sinh cảnh.*(mất|thu hẹp|suy thoái)",
                  sentence, re.IGNORECASE)
        and 30 <= len(sentence) <= 320 and sentence.endswith(".")), None)
    measure = next((sentence for sentence in sentences if
        re.search(r"cần (bảo vệ|điều tra|ngăn chặn|kiểm soát|thu thập)|"
                  r"không chặt phá|ngăn chặn|bảo vệ sinh cảnh|đề nghị biện pháp",
                  sentence, re.IGNORECASE)
        and 30 <= len(sentence) <= 320 and sentence.endswith(".")), None)
    if not status or not measure or status == measure:
        return ""
    return f"Tình trạng: {status} Biện pháp: {measure} [1]"


def curate_sft_training(
    train_file: Path,
    validation_file: Path,
    output: Path,
    report_file: Path,
    *,
    empty_evidence_limit: int = 25,
    wrong_facet_limit: int = 25,
) -> dict[str, object]:
    """Prepare a reviewable train revision without touching validation or source data."""
    if min(empty_evidence_limit, wrong_facet_limit) < 0:
        raise ValueError("Negative example limits must be non-negative.")
    if len({path.resolve() for path in (train_file, validation_file, output, report_file)}) != 4:
        raise ValueError("Input and output paths must be distinct.")
    if output.exists() or report_file.exists():
        raise FileExistsError("Refusing to overwrite an existing SFT artifact.")
    train = _read_review_rows(train_file, "train")
    validation = _read_review_rows(validation_file, "validation")
    train_entities = {str(entity) for row in train for entity in row.get("entity_ids", [])}
    validation_entities = {str(entity) for row in validation for entity in row.get("entity_ids", [])}
    if train_entities & validation_entities:
        raise ValueError("Train and validation share entity IDs.")

    cleaned = [_clean_sft_row(row) for row in train]
    conservation_bodies = Counter(
        _normalized_text(str(row["evidence"][0]["content"]).split("\n", 1)[-1])
        for row in cleaned
        if row.get("intent") == "species_conservation" and row.get("evidence")
    )
    reasons: Counter[str] = Counter()
    for row in cleaned:
        issues = _sft_review_issues(row, conservation_bodies)
        if issues:
            row["approved"] = False
            row["curation_issues"] = issues
            reasons.update(issues)
        else:
            row["curation_issues"] = []
        row["human_reviewed"] = False

    positives = [
        row for row in cleaned
        if row.get("approved") is True and not row.get("should_abstain")
        and row.get("entity_ids")
    ]
    chosen = sorted(positives, key=lambda row: hashlib.sha256(
        str(row["example_id"]).encode("utf-8")
    ).hexdigest())
    empty_examples: list[dict[str, object]] = []
    for row in chosen[:empty_evidence_limit]:
        empty_examples.append(_abstention_example(
            row, "no_evidence", [], approved=True,
            note="Không có tài liệu truy xuất; mẫu âm tổng hợp cần rà trước khi train.",
        ))

    by_entity: dict[str, dict[str, dict[str, object]]] = defaultdict(dict)
    for row in positives:
        by_entity[str(row["entity_ids"][0])].setdefault(str(row["intent"]), row)
    wrong_facet_examples: list[dict[str, object]] = []
    for entity_id in sorted(by_entity):
        group = by_entity[entity_id]
        identification = group.get("species_identification")
        distribution = group.get("species_distribution")
        if not identification or not distribution:
            continue
        evidence = distribution.get("evidence", [])
        if len(evidence) != 1:
            continue
        body = str(evidence[0]["content"]).split("\n", 1)[-1]
        if re.search(
            r"\b(đặc điểm|màu|thân|cánh|vỏ|đuôi|mỏ|kích thước|hình dạng|"
            r"lông|sừng|vảy|dài|cao|râu|chân|bụng)\b",
            body, re.IGNORECASE,
        ):
            continue
        target_fact = _normalized_text(str(identification["approved_answer"]).rsplit("[1]", 1)[0])
        if target_fact in _normalized_text(str(evidence[0]["content"])):
            continue
        wrong_facet_examples.append(_abstention_example(
            identification, "same_species_wrong_facet", evidence, approved=True,
            note="Tài liệu đúng loài nhưng không nêu đặc điểm nhận dạng; mẫu tổng hợp, cần người dùng rà.",
        ))
        if len(wrong_facet_examples) >= wrong_facet_limit:
            break

    if len(empty_examples) < empty_evidence_limit or len(wrong_facet_examples) < wrong_facet_limit:
        raise ValueError("Not enough clean train examples for requested negative limits.")
    combined = cleaned + empty_examples + wrong_facet_examples
    ids = [str(row["example_id"]) for row in combined]
    if len(ids) != len(set(ids)):
        raise ValueError("Curated SFT example IDs are not unique.")
    report: dict[str, object] = {
        "input_train": len(train),
        "validation_unchanged": len(validation),
        "train_validation_entity_overlap": 0,
        "curated_train": len(combined),
        "automatically_approved": sum(row.get("approved") is True for row in combined),
        "pending_human_review": sum(row.get("approved") is not True for row in combined),
        "added_no_evidence": len(empty_examples),
        "added_same_species_wrong_facet": len(wrong_facet_examples),
        "existing_cross_species": sum(row.get("approval_basis") == "synthetic_irrelevant_evidence" for row in cleaned),
        "issue_counts": dict(sorted(reasons.items())),
        "pending_examples": [
            {"example_id": row["example_id"], "question": row["question"],
             "issues": row["curation_issues"]}
            for row in combined if row.get("approved") is not True
        ],
        "warning": "Approval is automated source-snapshot screening, not scientific verification.",
    }
    _write_jsonl(output, combined)
    report_file.parent.mkdir(parents=True, exist_ok=True)
    report_file.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    return {key: value for key, value in report.items() if key != "pending_examples"}


def _read_review_rows(path: Path, partition: str) -> list[dict[str, object]]:
    with path.open(encoding="utf-8") as source:
        rows = [json.loads(line) for line in source if line.strip()]
    if not rows or any(row.get("partition") != partition for row in rows):
        raise ValueError(f"Expected only {partition} examples: {path}")
    return rows


def _clean_sft_row(row: dict[str, object]) -> dict[str, object]:
    revised = dict(row)
    revised["evidence"] = []
    for item in row.get("evidence", []):
        evidence = dict(item)
        content = str(evidence["content"])
        for marker in ("Documentation and reference sources", "Tin mới cập nhật", "WebAdmin"):
            position = content.casefold().find(marker.casefold())
            if position >= 0:
                content = content[:position].rstrip(" .;,\n")
        evidence["content"] = content.strip()
        revised["evidence"].append(evidence)
    return revised


def _sft_review_issues(row: dict[str, object], conservation_bodies: Counter[str]) -> list[str]:
    if row.get("should_abstain"):
        if row.get("approval_basis") == "synthetic_irrelevant_evidence":
            title = str(row["evidence"][0]["title"]).split(" - ")[0].casefold()
            if title in str(row["question"]).casefold():
                return ["negative_evidence_mentions_target"]
        return []
    evidence = row.get("evidence", [])
    if len(evidence) != 1 or not evidence[0].get("source_url"):
        return ["missing_single_source"]
    content = str(evidence[0]["content"])
    answer = str(row.get("approved_answer", ""))
    issues: list[str] = []
    species = str(evidence[0]["title"]).split(" - ")[0]
    if species.casefold() not in str(row["question"]).casefold():
        issues.append("question_source_entity_mismatch")
    if not content or not answer.endswith(" [1]"):
        issues.append("missing_content_or_citation")
    if row.get("intent") == "species_conservation":
        parts = re.fullmatch(r"Tình trạng:\s*(.*?)\s+Biện pháp:\s*(.*?)\s+\[1\]", answer, re.DOTALL)
        if not parts or any(_normalized_text(part) not in _normalized_text(content) for part in parts.groups()):
            issues.append("conservation_answer_not_grounded")
        status_codes = set(re.findall(r"(?<![A-Za-z])(?:EX|EW|CR|EN|VU|NT|LC|DD|NE)(?![A-Za-z])", content))
        if len(status_codes) > 1:
            issues.append("conflicting_status_codes")
        body = _normalized_text(content.split("\n", 1)[-1])
        if conservation_bodies[body] >= 3:
            issues.append("reused_conservation_text")
        if re.search(r"Sách Đỏ.*?\b(?:19\d\d|20\d\d)\b", answer, re.IGNORECASE):
            issues.append("historical_status_needs_review")
    elif answer.endswith(" [1]") and _normalized_text(answer[:-4]) not in _normalized_text(content):
        issues.append("answer_not_in_source_snapshot")
    return issues


def _abstention_example(
    row: dict[str, object], kind: str, evidence: list[dict[str, object]], *,
    approved: bool, note: str,
) -> dict[str, object]:
    answer = "Không đủ dữ liệu trong bằng chứng được cung cấp để trả lời."
    return {
        "example_id": f"{row['example_id']}-{kind}",
        "partition": "train",
        "question": row["question"],
        "intent": "unsupported",
        "entity_ids": row["entity_ids"],
        "should_abstain": True,
        "evidence": evidence,
        "expected_facts_for_review": [],
        "expected_citations_for_review": [],
        "draft_answer_for_review": answer,
        "approved_answer": answer,
        "approved": approved,
        "approval_basis": f"synthetic_{kind}",
        "external_source_verified": False,
        "human_reviewed": False,
        "curation_issues": [] if approved else ["same_species_insufficient_needs_review"],
        "review_note": note,
    }


def _normalized_text(value: str) -> str:
    return " ".join(value.casefold().split())


def _write_jsonl(path: Path, rows: list[dict[str, object]]) -> None:
    if path.exists():
        raise FileExistsError(f"Refusing to overwrite existing file: {path}")
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("x", encoding="utf-8", newline="\n") as destination:
        for row in rows:
            destination.write(json.dumps(row, ensure_ascii=False) + "\n")
