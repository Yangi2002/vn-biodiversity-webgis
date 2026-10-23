"""Explicit pgvector persistence and filtered cosine retrieval."""

from __future__ import annotations

import json
from collections.abc import Iterable, Sequence
from dataclasses import dataclass

from biodiversity_ai.assistant.contracts import CorpusDocument, RetrievalHit
from biodiversity_ai.assistant.ingestion.postgres import PostgresSettings
from biodiversity_ai.llm import TextEmbedder


@dataclass(frozen=True, slots=True)
class PgVectorCollection:
    dataset_version: str
    embedding_model: str
    dimension: int


class PgVectorStore:
    """Writes only when its explicit schema/index methods are called by the CLI."""

    def __init__(self, settings: PostgresSettings, collection: PgVectorCollection) -> None:
        self._settings = settings
        self._collection = collection

    def ensure_schema(self) -> None:
        psycopg, sql, _, _ = _dependencies()
        if self._collection.dimension < 1:
            raise ValueError("Embedding dimension must be positive.")
        table = sql.Identifier(self._settings.schema, "assistant_corpus_embeddings")
        index = sql.Identifier("idx_assistant_embeddings_hnsw")
        with psycopg.connect(self._settings.dsn) as connection:
            connection.execute("CREATE EXTENSION IF NOT EXISTS vector")
            connection.execute(
                sql.SQL(
                    """
                    CREATE TABLE IF NOT EXISTS {table} (
                        dataset_version text NOT NULL,
                        embedding_model text NOT NULL,
                        partition text NOT NULL,
                        document_id text NOT NULL,
                        entity_id text NOT NULL,
                        section text NOT NULL,
                        visibility text NOT NULL,
                        title text NOT NULL,
                        content text NOT NULL,
                        source_name text NOT NULL,
                        source_url text,
                        content_hash text NOT NULL,
                        metadata jsonb NOT NULL DEFAULT '{{}}'::jsonb,
                        embedding vector({dimension}) NOT NULL,
                        PRIMARY KEY (dataset_version, embedding_model, document_id)
                    )
                    """
                ).format(
                    table=table,
                    dimension=sql.Literal(self._collection.dimension),
                )
            )
            connection.execute(
                sql.SQL(
                    "ALTER TABLE {table} ADD COLUMN IF NOT EXISTS "
                    "partition text NOT NULL DEFAULT 'train'"
                ).format(table=table)
            )
            connection.execute(
                sql.SQL(
                    "CREATE INDEX IF NOT EXISTS {index} ON {table} "
                    "USING hnsw (embedding vector_cosine_ops)"
                ).format(index=index, table=table)
            )

    def upsert(
        self,
        documents: Sequence[CorpusDocument],
        vectors: object,
        *,
        partition: str,
        batch_size: int = 200,
    ) -> int:
        psycopg, sql, register_vector, Vector = _dependencies()
        if len(documents) != len(vectors):  # type: ignore[arg-type]
            raise ValueError("Documents and vectors must have equal lengths.")
        table = sql.Identifier(self._settings.schema, "assistant_corpus_embeddings")
        statement = sql.SQL(
            """
            INSERT INTO {table} (
                dataset_version, embedding_model, partition, document_id, entity_id,
                section, visibility, title, content, source_name, source_url,
                content_hash, metadata, embedding
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb, %s
            )
            ON CONFLICT (dataset_version, embedding_model, document_id)
            DO UPDATE SET
                entity_id = EXCLUDED.entity_id,
                partition = EXCLUDED.partition,
                section = EXCLUDED.section,
                visibility = EXCLUDED.visibility,
                title = EXCLUDED.title,
                content = EXCLUDED.content,
                source_name = EXCLUDED.source_name,
                source_url = EXCLUDED.source_url,
                content_hash = EXCLUDED.content_hash,
                metadata = EXCLUDED.metadata,
                embedding = EXCLUDED.embedding
            """
        ).format(table=table)
        rows = [
            (
                self._collection.dataset_version,
                self._collection.embedding_model,
                partition,
                document.document_id,
                document.entity_id,
                document.section,
                document.visibility,
                document.title,
                document.content,
                document.source_name,
                document.source_url,
                document.content_hash,
                json.dumps(document.metadata, ensure_ascii=False),
                Vector(vector),
            )
            for document, vector in zip(documents, vectors, strict=True)  # type: ignore[arg-type]
        ]
        with psycopg.connect(self._settings.dsn) as connection:
            register_vector(connection)
            with connection.cursor() as cursor:
                for start in range(0, len(rows), batch_size):
                    cursor.executemany(statement, rows[start : start + batch_size])
        return len(rows)

    def search(
        self,
        query_vector: object,
        *,
        limit: int = 5,
        partition: str = "train",
        allowed_visibilities: Iterable[str] = ("authenticated",),
    ) -> tuple[RetrievalHit, ...]:
        psycopg, sql, register_vector, Vector = _dependencies()
        table = sql.Identifier(self._settings.schema, "assistant_corpus_embeddings")
        statement = sql.SQL(
            """
            SELECT document_id, entity_id, section, visibility, title, content,
                   source_name, source_url, content_hash, metadata,
                   1 - (embedding <=> %s) AS score
            FROM {table}
            WHERE dataset_version = %s
              AND embedding_model = %s
              AND partition = %s
              AND visibility = ANY(%s)
            ORDER BY embedding <=> %s
            LIMIT %s
            """
        ).format(table=table)
        vector = Vector(query_vector)
        params = (
            vector,
            self._collection.dataset_version,
            self._collection.embedding_model,
            partition,
            list(allowed_visibilities),
            vector,
            limit,
        )
        hits: list[RetrievalHit] = []
        with psycopg.connect(self._settings.dsn) as connection:
            register_vector(connection)
            with connection.cursor() as cursor:
                cursor.execute(statement, params)
                for rank, row in enumerate(cursor.fetchall(), start=1):
                    hits.append(
                        RetrievalHit(
                            document=CorpusDocument(
                                document_id=row[0],
                                entity_id=row[1],
                                entity_type="species",
                                section=row[2],
                                visibility=row[3],
                                title=row[4],
                                content=row[5],
                                source_name=row[6],
                                source_url=row[7],
                                content_hash=row[8],
                                metadata=row[9],
                            ),
                            score=float(row[10]),
                            rank=rank,
                        )
                    )
        return tuple(hits)


class PgVectorRetriever:
    """Dense query adapter over the persisted pgvector collection."""

    def __init__(
        self,
        store: PgVectorStore,
        embedder: TextEmbedder,
        *,
        partition: str = "train",
        allowed_visibilities: Iterable[str] = ("authenticated",),
    ) -> None:
        self._store = store
        self._embedder = embedder
        self._partition = partition
        self._allowed_visibilities = tuple(allowed_visibilities)

    def search(self, query: str, *, limit: int = 5) -> tuple[RetrievalHit, ...]:
        if limit < 1:
            raise ValueError("limit must be positive.")
        if not query.strip():
            return ()
        query_vector = self._embedder.encode_queries((query,))[0]
        return self._store.search(
            query_vector,
            limit=limit,
            partition=self._partition,
            allowed_visibilities=self._allowed_visibilities,
        )


def _dependencies() -> tuple[object, object, object, object]:
    try:
        import psycopg
        from pgvector import Vector
        from pgvector.psycopg import register_vector
        from psycopg import sql
    except ImportError as error:
        raise RuntimeError("pgvector indexing requires the optional 'rag' dependencies.") from error
    return psycopg, sql, register_vector, Vector

