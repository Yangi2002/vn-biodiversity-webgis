from biodiversity_ai.assistant.ingestion.postgres import _split_prisma_schema


def test_prisma_schema_is_removed_from_psycopg_dsn() -> None:
    dsn, schema = _split_prisma_schema(
        "postgresql://user:password@localhost:5432/biodiversity?schema=research&sslmode=prefer"
    )

    assert schema == "research"
    assert "schema=" not in dsn
    assert "sslmode=prefer" in dsn

