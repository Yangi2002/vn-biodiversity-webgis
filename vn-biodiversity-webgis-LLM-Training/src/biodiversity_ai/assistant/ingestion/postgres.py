"""Read-only extraction from the operational PostgreSQL database."""

from __future__ import annotations

import os
import re
from collections.abc import Iterator
from dataclasses import dataclass
from typing import Any
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from biodiversity_ai.assistant.contracts import RawSpeciesRecord, SpeciesKey

SPECIES_SOURCE_TABLES = (
    "animal_db_vn",
    "plant_db_vn",
    "insect_db_vn",
    "fungi_db_vn",
    "algae_db_vn",
    "protista_db_vn",
)

_SCHEMA_PATTERN = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")


@dataclass(frozen=True, slots=True)
class PostgresSettings:
    """Connection settings loaded from environment variables, never hard-coded."""

    dsn: str
    schema: str = "public"
    batch_size: int = 500

    @classmethod
    def from_env(cls) -> PostgresSettings:
        raw_dsn = os.getenv("BIODIVERSITY_DATABASE_URL") or os.getenv("DATABASE_URL")
        if not raw_dsn:
            raise RuntimeError(
                "BIODIVERSITY_DATABASE_URL or DATABASE_URL must be configured."
            )

        dsn, schema_from_dsn = _split_prisma_schema(raw_dsn)
        schema = os.getenv("BIODIVERSITY_DATABASE_SCHEMA", schema_from_dsn or "public")
        if not _SCHEMA_PATTERN.fullmatch(schema):
            raise ValueError("BIODIVERSITY_DATABASE_SCHEMA is not a valid identifier.")

        batch_size = int(os.getenv("BIODIVERSITY_EXTRACT_BATCH_SIZE", "500"))
        if batch_size < 1:
            raise ValueError("BIODIVERSITY_EXTRACT_BATCH_SIZE must be positive.")
        return cls(dsn=dsn, schema=schema, batch_size=batch_size)


class PostgresSpeciesExtractor:
    """Streams source rows without writing to PostgreSQL or the datasets folder."""

    def __init__(self, settings: PostgresSettings) -> None:
        self._settings = settings

    def iter_species(
        self,
        source_table: str,
        *,
        limit: int | None = None,
    ) -> Iterator[RawSpeciesRecord]:
        try:
            import psycopg
            from psycopg import sql
            from psycopg.rows import dict_row
        except ImportError as error:
            raise RuntimeError(
                "PostgreSQL extraction requires the project dependency psycopg."
            ) from error

        self._validate_source_table(source_table)
        if limit is not None and limit < 1:
            raise ValueError("limit must be positive when provided.")

        table = sql.Identifier(self._settings.schema, source_table)
        taxonomy_table = sql.Identifier(self._settings.schema, "gbif_taxonomy_cache")
        statement = sql.SQL(
            """
            SELECT
                to_jsonb(species_row) AS species_values,
                CASE
                    WHEN taxonomy.source_table IS NULL THEN NULL
                    ELSE to_jsonb(taxonomy) - 'gbif_raw'
                END AS gbif_taxonomy
            FROM {table} AS species_row
            LEFT JOIN {taxonomy_table} AS taxonomy
                ON taxonomy.source_table = %s
               AND taxonomy.species_id = species_row.species_id
            ORDER BY species_row.species_id
            """
        ).format(table=table, taxonomy_table=taxonomy_table)
        params: list[Any] = [source_table]

        if limit is not None:
            statement += sql.SQL(" LIMIT %s")
            params.append(limit)

        with psycopg.connect(self._settings.dsn, row_factory=dict_row) as connection:
            connection.execute("SET TRANSACTION READ ONLY")
            cursor_name = f"assistant_species_{source_table}"
            with connection.cursor(name=cursor_name) as cursor:
                cursor.execute(statement, params)
                while rows := cursor.fetchmany(self._settings.batch_size):
                    for row in rows:
                        values = dict(row["species_values"])
                        yield RawSpeciesRecord(
                            key=SpeciesKey(
                                source_table=source_table,
                                species_id=str(values["species_id"]),
                            ),
                            values=values,
                            gbif_taxonomy=(
                                dict(row["gbif_taxonomy"])
                                if row["gbif_taxonomy"] is not None
                                else None
                            ),
                        )

    def iter_all_species(self, *, limit_per_table: int | None = None) -> Iterator[RawSpeciesRecord]:
        for source_table in SPECIES_SOURCE_TABLES:
            yield from self.iter_species(source_table, limit=limit_per_table)

    @staticmethod
    def _validate_source_table(source_table: str) -> None:
        if source_table not in SPECIES_SOURCE_TABLES:
            allowed = ", ".join(SPECIES_SOURCE_TABLES)
            raise ValueError(f"Unsupported species source table. Expected one of: {allowed}.")


def _split_prisma_schema(dsn: str) -> tuple[str, str | None]:
    """Remove Prisma's schema query parameter before passing the DSN to libpq."""

    parsed = urlsplit(dsn)
    if parsed.scheme not in {"postgres", "postgresql"}:
        return dsn, None

    schema: str | None = None
    query: list[tuple[str, str]] = []
    for key, value in parse_qsl(parsed.query, keep_blank_values=True):
        if key == "schema":
            schema = value or None
        else:
            query.append((key, value))
    normalized_dsn = urlunsplit(
        (parsed.scheme, parsed.netloc, parsed.path, urlencode(query), parsed.fragment)
    )
    return normalized_dsn, schema
