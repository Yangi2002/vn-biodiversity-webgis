"""Cross-encoder reranking for retrieved biodiversity evidence."""

from __future__ import annotations

from collections.abc import Sequence

from biodiversity_ai.assistant.contracts import RetrievalHit


class CrossEncoderReranker:
    def __init__(
        self,
        model_name: str,
        *,
        batch_size: int = 16,
        device: str | None = None,
    ) -> None:
        self.model_name = model_name
        self.batch_size = batch_size
        self.device = device
        self._model: object | None = None

    def rerank(
        self,
        query: str,
        hits: Sequence[RetrievalHit],
        *,
        limit: int,
    ) -> tuple[RetrievalHit, ...]:
        if limit < 1:
            raise ValueError("limit must be positive.")
        if not hits:
            return ()
        pairs = [
            (query, f"{hit.document.title}\n{hit.document.content}") for hit in hits
        ]
        scores = self._load_model().predict(  # type: ignore[attr-defined]
            pairs,
            batch_size=self.batch_size,
            show_progress_bar=False,
        )
        ranked = sorted(
            zip(hits, scores, strict=True),
            key=lambda item: (-float(item[1]), item[0].document.document_id),
        )[:limit]
        return tuple(
            RetrievalHit(document=hit.document, score=float(score), rank=rank)
            for rank, (hit, score) in enumerate(ranked, start=1)
        )

    def rerank_many(
        self,
        queries: Sequence[str],
        hit_groups: Sequence[Sequence[RetrievalHit]],
        *,
        limit: int,
        show_progress_bar: bool = True,
    ) -> tuple[tuple[RetrievalHit, ...], ...]:
        """Score all query-document pairs in one batched model pass."""

        if limit < 1:
            raise ValueError("limit must be positive.")
        if len(queries) != len(hit_groups):
            raise ValueError("queries and hit_groups must have the same length.")

        pairs: list[tuple[str, str]] = []
        offsets: list[tuple[int, int]] = []
        for query, hits in zip(queries, hit_groups, strict=True):
            start = len(pairs)
            pairs.extend(
                (query, f"{hit.document.title}\n{hit.document.content}")
                for hit in hits
            )
            offsets.append((start, len(pairs)))

        if not pairs:
            return tuple(() for _ in queries)

        scores = self._load_model().predict(  # type: ignore[attr-defined]
            pairs,
            batch_size=self.batch_size,
            show_progress_bar=show_progress_bar,
        )
        results: list[tuple[RetrievalHit, ...]] = []
        for hits, (start, end) in zip(hit_groups, offsets, strict=True):
            ranked = sorted(
                zip(hits, scores[start:end], strict=True),
                key=lambda item: (-float(item[1]), item[0].document.document_id),
            )[:limit]
            results.append(
                tuple(
                    RetrievalHit(document=hit.document, score=float(score), rank=rank)
                    for rank, (hit, score) in enumerate(ranked, start=1)
                )
            )
        return tuple(results)

    def _load_model(self) -> object:
        if self._model is None:
            try:
                from sentence_transformers import CrossEncoder
            except ImportError as error:
                raise RuntimeError(
                    "Reranking requires the optional 'rag' dependencies."
                ) from error
            self._model = CrossEncoder(self.model_name, device=self.device)
        return self._model

