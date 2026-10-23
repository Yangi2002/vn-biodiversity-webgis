"""Versioned embedding artifacts bound to ordered corpus document IDs."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any


@dataclass(frozen=True, slots=True)
class EmbeddingArtifact:
    model_name: str
    dataset_corpus_hash: str
    document_ids: tuple[str, ...]
    vectors: Any

    @property
    def dimension(self) -> int:
        return int(self.vectors.shape[1])


def write_embedding_artifact(
    directory: Path,
    *,
    model_name: str,
    dataset_corpus_hash: str,
    document_ids: tuple[str, ...],
    vectors: object,
) -> Path:
    np = _numpy()
    matrix = np.asarray(vectors, dtype=np.float32)
    if matrix.ndim != 2 or matrix.shape[0] != len(document_ids):
        raise ValueError("Embedding matrix must have one row per document ID.")
    directory.mkdir(parents=True, exist_ok=False)
    np.save(directory / "vectors.npy", matrix, allow_pickle=False)
    (directory / "manifest.json").write_text(
        json.dumps(
            {
                "model_name": model_name,
                "dataset_corpus_hash": dataset_corpus_hash,
                "document_ids": document_ids,
                "rows": int(matrix.shape[0]),
                "dimension": int(matrix.shape[1]),
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    return directory


def load_embedding_artifact(directory: Path) -> EmbeddingArtifact:
    np = _numpy()
    manifest = json.loads((directory / "manifest.json").read_text(encoding="utf-8"))
    vectors = np.load(directory / "vectors.npy", allow_pickle=False, mmap_mode="r")
    document_ids = tuple(str(item) for item in manifest["document_ids"])
    if vectors.shape[0] != len(document_ids):
        raise ValueError("Embedding artifact manifest and matrix row count differ.")
    return EmbeddingArtifact(
        model_name=str(manifest["model_name"]),
        dataset_corpus_hash=str(manifest["dataset_corpus_hash"]),
        document_ids=document_ids,
        vectors=vectors,
    )


def _numpy() -> Any:
    try:
        import numpy as np
    except ImportError as error:
        raise RuntimeError("Embedding artifacts require the optional 'rag' dependencies.") from error
    return np

