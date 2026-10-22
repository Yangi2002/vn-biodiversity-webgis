"""Scientific-literature clients for DOI and life-sciences metadata."""

from __future__ import annotations

import html
import re
import time
from collections.abc import Iterable, Sequence
from datetime import UTC, datetime
from typing import Any, Protocol, Self
from urllib.parse import urlencode

from biodiversity_ai.assistant.contracts import ScientificPublication
from biodiversity_ai.assistant.corpus.normalization import normalize_lookup_key

_HTML_TAG = re.compile(r"<[^>]+>")


class LiteratureProvider(Protocol):
    """Common contract implemented by scientific-literature providers."""

    provider_name: str

    def search(self, query: str, *, limit: int = 5) -> tuple[ScientificPublication, ...]: ...


class HttpResponse(Protocol):
    status_code: int

    def raise_for_status(self) -> None: ...

    def json(self) -> object: ...


class HttpClient(Protocol):
    def get(self, url: str, *, params: dict[str, str]) -> HttpResponse: ...

    def close(self) -> None: ...


class CrossrefLiteratureClient:
    """Searches DOI and publisher-deposited metadata through Crossref."""

    provider_name = "Crossref"

    def __init__(
        self,
        *,
        base_url: str = "https://api.crossref.org",
        mailto: str | None = None,
        timeout_seconds: float = 20.0,
        max_retries: int = 2,
        client: HttpClient | None = None,
    ) -> None:
        self._base_url = base_url.rstrip("/")
        self._mailto = mailto.strip() if mailto else None
        self._max_retries = max_retries
        self._owns_client = client is None
        headers = {"User-Agent": "VN-Biodiversity-WebGIS-AI/0.1"}
        self._client = client or _create_httpx_client(timeout_seconds, headers=headers)

    def close(self) -> None:
        if self._owns_client:
            self._client.close()

    def __enter__(self) -> Self:
        return self

    def __exit__(self, *_: object) -> None:
        self.close()

    def search(self, query: str, *, limit: int = 5) -> tuple[ScientificPublication, ...]:
        normalized_query = _required_query(query)
        _validate_limit(limit)
        endpoint = f"{self._base_url}/works"
        params = {
            "query.bibliographic": normalized_query,
            "rows": str(limit),
        }
        if self._mailto:
            params["mailto"] = self._mailto

        payload = self._get_json(endpoint, params=params)
        items = payload.get("message", {}).get("items", [])
        if not isinstance(items, list):
            raise TypeError("Crossref response does not contain a works list.")
        retrieval_url = f"{endpoint}?{urlencode(params)}"
        return tuple(
            publication
            for item in items
            if isinstance(item, dict)
            and (publication := _crossref_publication(item, normalized_query, retrieval_url))
            is not None
        )

    def _get_json(self, url: str, *, params: dict[str, str]) -> dict[str, Any]:
        return _get_json_with_retry(self._client, url, params, self._max_retries)


class EuropePmcLiteratureClient:
    """Searches life-sciences articles, preprints, and open-access metadata."""

    provider_name = "Europe PMC"

    def __init__(
        self,
        *,
        base_url: str = "https://www.ebi.ac.uk/europepmc/webservices/rest",
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

    def search(self, query: str, *, limit: int = 5) -> tuple[ScientificPublication, ...]:
        normalized_query = _required_query(query)
        _validate_limit(limit)
        endpoint = f"{self._base_url}/search"
        params = {
            "query": normalized_query,
            "resultType": "core",
            "format": "json",
            "pageSize": str(limit),
        }
        payload = _get_json_with_retry(self._client, endpoint, params, self._max_retries)
        items = payload.get("resultList", {}).get("result", [])
        if not isinstance(items, list):
            raise TypeError("Europe PMC response does not contain a result list.")
        retrieval_url = f"{endpoint}?{urlencode(params)}"
        return tuple(
            publication
            for item in items
            if isinstance(item, dict)
            and (publication := _europe_pmc_publication(item, normalized_query, retrieval_url))
            is not None
        )


def search_literature(
    query: str,
    providers: Sequence[LiteratureProvider],
    *,
    limit_per_provider: int = 5,
) -> tuple[ScientificPublication, ...]:
    """Search providers explicitly and deduplicate publications by DOI or title."""

    publications = (
        publication
        for provider in providers
        for publication in provider.search(query, limit=limit_per_provider)
    )
    return _deduplicate_publications(publications)


def _crossref_publication(
    item: dict[str, Any],
    query: str,
    retrieval_url: str,
) -> ScientificPublication | None:
    title = _first_text(item.get("title"))
    if not title:
        return None
    doi = _normalize_doi(item.get("DOI"))
    source_url = f"https://doi.org/{doi}" if doi else _text(item.get("URL"))
    if not source_url:
        return None
    authors = tuple(
        name
        for author in item.get("author", [])
        if isinstance(author, dict) and (name := _author_name(author))
    )
    licenses = item.get("license", [])
    license_url = next(
        (
            _text(license_item.get("URL"))
            for license_item in licenses
            if isinstance(license_item, dict) and license_item.get("URL")
        ),
        None,
    )
    return ScientificPublication(
        provider="Crossref",
        query=query,
        retrieved_at=datetime.now(UTC),
        title=title,
        source_url=source_url,
        retrieval_url=retrieval_url,
        authors=authors,
        publication_year=_crossref_year(item),
        journal=_first_text(item.get("container-title")),
        doi=doi,
        abstract=_clean_markup(item.get("abstract")),
        license=license_url,
        payload=item,
    )


def _europe_pmc_publication(
    item: dict[str, Any],
    query: str,
    retrieval_url: str,
) -> ScientificPublication | None:
    title = _text(item.get("title"))
    if not title:
        return None
    doi = _normalize_doi(item.get("doi"))
    source = _text(item.get("source"))
    article_id = _text(item.get("id"))
    source_url = f"https://doi.org/{doi}" if doi else None
    if not source_url and source and article_id:
        source_url = f"https://europepmc.org/article/{source}/{article_id}"
    if not source_url:
        return None
    return ScientificPublication(
        provider="Europe PMC",
        query=query,
        retrieved_at=datetime.now(UTC),
        title=title,
        source_url=source_url,
        retrieval_url=retrieval_url,
        authors=_split_authors(item.get("authorString")),
        publication_year=_integer(item.get("pubYear")),
        journal=_text(item.get("journalTitle")),
        doi=doi,
        abstract=_clean_markup(item.get("abstractText")),
        license=_text(item.get("license")),
        open_access=_boolean(item.get("isOpenAccess")),
        payload=item,
    )


def _deduplicate_publications(
    publications: Iterable[ScientificPublication],
) -> tuple[ScientificPublication, ...]:
    seen: set[str] = set()
    result: list[ScientificPublication] = []
    for publication in publications:
        key = (
            f"doi:{publication.doi.casefold()}"
            if publication.doi
            else f"title:{normalize_lookup_key(publication.title)}"
        )
        if key not in seen:
            seen.add(key)
            result.append(publication)
    return tuple(result)


def _get_json_with_retry(
    client: HttpClient,
    url: str,
    params: dict[str, str],
    max_retries: int,
) -> dict[str, Any]:
    for attempt in range(max_retries + 1):
        response = client.get(url, params=params)
        if response.status_code != 429 and response.status_code < 500:
            response.raise_for_status()
            payload = response.json()
            if not isinstance(payload, dict):
                raise ValueError("Literature provider returned a non-object JSON response.")
            return payload
        if attempt == max_retries:
            response.raise_for_status()
        time.sleep(0.5 * (2**attempt))
    raise RuntimeError("Literature request exhausted without a response.")


def _crossref_year(item: dict[str, Any]) -> int | None:
    for field in ("published-print", "published-online", "published", "issued"):
        date_parts = item.get(field, {}).get("date-parts", [])
        if date_parts and isinstance(date_parts[0], list) and date_parts[0]:
            return _integer(date_parts[0][0])
    return None


def _author_name(author: dict[str, Any]) -> str | None:
    parts = [_text(author.get("given")), _text(author.get("family"))]
    name = " ".join(part for part in parts if part)
    return name or _text(author.get("name"))


def _split_authors(value: object) -> tuple[str, ...]:
    text = _text(value)
    if not text:
        return ()
    return tuple(part.strip() for part in re.split(r"\s*[,;]\s*", text) if part.strip())


def _clean_markup(value: object) -> str | None:
    text = _text(value)
    if not text:
        return None
    return re.sub(r"\s+", " ", html.unescape(_HTML_TAG.sub(" ", text))).strip() or None


def _first_text(value: object) -> str | None:
    if isinstance(value, list) and value:
        return _text(value[0])
    return _text(value)


def _normalize_doi(value: object) -> str | None:
    text = _text(value)
    if not text:
        return None
    return re.sub(r"^https?://(?:dx\.)?doi\.org/", "", text, flags=re.IGNORECASE).casefold()


def _required_query(query: str) -> str:
    normalized = re.sub(r"\s+", " ", query).strip()
    if not normalized:
        raise ValueError("query must not be blank.")
    return normalized


def _validate_limit(limit: int) -> None:
    if not 1 <= limit <= 100:
        raise ValueError("limit must be between 1 and 100.")


def _integer(value: object) -> int | None:
    try:
        return int(str(value))
    except (TypeError, ValueError):
        return None


def _boolean(value: object) -> bool | None:
    if isinstance(value, bool):
        return value
    text = _text(value)
    if text and text.casefold() in {"y", "yes", "true", "1"}:
        return True
    if text and text.casefold() in {"n", "no", "false", "0"}:
        return False
    return None


def _text(value: object) -> str | None:
    if value is None:
        return None
    text = re.sub(r"\s+", " ", str(value)).strip()
    return text or None


def _create_httpx_client(timeout_seconds: float, **kwargs: object) -> HttpClient:
    try:
        import httpx
    except ImportError as error:
        raise RuntimeError(
            "Scientific API access requires the project dependency httpx."
        ) from error
    return httpx.Client(timeout=timeout_seconds, **kwargs)
