"""Configurable sentence-transformer embeddings for multilingual retrieval."""

from __future__ import annotations

from collections.abc import Sequence
from typing import Protocol


class TextEmbedder(Protocol):
    model_name: str

    def encode_documents(self, texts: Sequence[str]) -> object: ...

    def encode_queries(self, texts: Sequence[str]) -> object: ...


class SentenceTransformerEmbedder:
    """Lazy adapter so importing the project does not download or load a model."""

    def __init__(
        self,
        model_name: str,
        *,
        batch_size: int = 16,
        device: str | None = None,
        query_prefix: str = "",
        document_prefix: str = "",
    ) -> None:
        if batch_size < 1:
            raise ValueError("batch_size must be positive.")
        self.model_name = model_name
        self.batch_size = batch_size
        self.device = device
        self.query_prefix = query_prefix
        self.document_prefix = document_prefix
        self._model: object | None = None

    def encode_documents(self, texts: Sequence[str]) -> object:
        return self._encode(texts, self.document_prefix)

    def encode_queries(self, texts: Sequence[str]) -> object:
        return self._encode(texts, self.query_prefix)

    def _encode(self, texts: Sequence[str], prefix: str) -> object:
        model = self._load_model()
        values = [f"{prefix}{text}" for text in texts]
        return model.encode(  # type: ignore[attr-defined]
            values,
            batch_size=self.batch_size,
            convert_to_numpy=True,
            normalize_embeddings=True,
            show_progress_bar=len(values) > self.batch_size,
        )

    def _load_model(self) -> object:
        if self._model is None:
            try:
                from sentence_transformers import SentenceTransformer
            except ImportError as error:
                raise RuntimeError(
                    "Embedding requires the optional 'rag' dependencies."
                ) from error
            self._model = SentenceTransformer(self.model_name, device=self.device)
        return self._model

