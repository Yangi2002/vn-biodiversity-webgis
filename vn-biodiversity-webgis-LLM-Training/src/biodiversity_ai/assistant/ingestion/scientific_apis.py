"""Explicit scientific-API enrichment clients with source provenance."""

from __future__ import annotations

import time
from datetime import UTC, datetime
from typing import Protocol, Self
from urllib.parse import urlencode

from biodiversity_ai.assistant.contracts import ScientificEnrichment


class HttpResponse(Protocol):
    status_code: int

    def raise_for_status(self) -> None: ...

    def json(self) -> object: ...


class HttpClient(Protocol):
    def get(self, url: str, *, params: dict[str, str]) -> HttpResponse: ...

    def close(self) -> None: ...


class GbifSpeciesClient:
    """Matches scientific names against the GBIF taxonomic backbone."""

    provider_name = "GBIF"

    def __init__(
        self,
        *,
        base_url: str = "https://api.gbif.org/v1",
        timeout_seconds: float = 20.0,
        max_retries: int = 2,
        client: HttpClient | None = None,
    ) -> None:
        self._base_url = base_url.rstrip("/")
        self._max_retries = max_retries
        self._owns_client = client is None
        self._client = client or _create_httpx_client(timeout_seconds)

    def close(self) -> None:
        if self._owns_client:
            self._client.close()

    def __enter__(self) -> Self:
        return self

    def __exit__(self, *_: object) -> None:
        self.close()

    def match(self, scientific_name: str) -> ScientificEnrichment:
        query = scientific_name.strip()
        if not query:
            raise ValueError("scientific_name must not be blank.")

        endpoint = f"{self._base_url}/species/match"
        params = {"name": query, "verbose": "true"}
        payload = self._get_json(endpoint, params=params)
        taxonomy = {
            key: payload[key]
            for key in ("kingdom", "phylum", "class", "order", "family", "genus", "species")
            if payload.get(key)
        }

        return ScientificEnrichment(
            provider=self.provider_name,
            query=query,
            retrieved_at=datetime.now(UTC),
            source_url=f"{endpoint}?{urlencode(params)}",
            payload=payload,
            accepted_scientific_name=_optional_text(payload.get("scientificName")),
            canonical_name=_optional_text(payload.get("canonicalName")),
            taxonomy=taxonomy,
        )

    def _get_json(self, url: str, *, params: dict[str, str]) -> dict[str, object]:
        for attempt in range(self._max_retries + 1):
            response = self._client.get(url, params=params)
            if response.status_code != 429 and response.status_code < 500:
                response.raise_for_status()
                payload = response.json()
                if not isinstance(payload, dict):
                    raise ValueError("GBIF returned a non-object JSON response.")
                return payload
            if attempt == self._max_retries:
                response.raise_for_status()
            time.sleep(0.5 * (2**attempt))
        raise RuntimeError("GBIF request exhausted without a response.")


def _optional_text(value: object) -> str | None:
    return str(value).strip() if value is not None and str(value).strip() else None


def _create_httpx_client(timeout_seconds: float) -> HttpClient:
    try:
        import httpx
    except ImportError as error:
        raise RuntimeError(
            "Scientific API access requires the project dependency httpx."
        ) from error
    return httpx.Client(timeout=timeout_seconds)

