from typing import Any

from biodiversity_ai.assistant.corpus import validate_publications
from biodiversity_ai.assistant.ingestion.literature_apis import (
    CrossrefLiteratureClient,
    EuropePmcLiteratureClient,
    search_literature,
)


class FakeResponse:
    status_code = 200

    def __init__(self, payload: dict[str, Any]) -> None:
        self._payload = payload

    def raise_for_status(self) -> None:
        return None

    def json(self) -> object:
        return self._payload


class FakeClient:
    def __init__(self, payload: dict[str, Any]) -> None:
        self._payload = payload

    def get(self, _url: str, *, params: dict[str, str]) -> FakeResponse:
        assert params
        return FakeResponse(self._payload)

    def close(self) -> None:
        return None


def test_crossref_maps_publication_metadata() -> None:
    client = CrossrefLiteratureClient(
        client=FakeClient(
            {
                "message": {
                    "items": [
                        {
                            "DOI": "10.1000/example",
                            "title": ["Biodiversity of Vietnam"],
                            "author": [{"given": "An", "family": "Nguyen"}],
                            "container-title": ["Biodiversity Journal"],
                            "published": {"date-parts": [[2025, 5, 1]]},
                            "abstract": "<jats:p>Species evidence.</jats:p>",
                            "URL": "https://doi.org/10.1000/example",
                        }
                    ]
                }
            }
        )
    )

    publications = client.search("Vietnam biodiversity")

    assert publications[0].doi == "10.1000/example"
    assert publications[0].authors == ("An Nguyen",)
    assert publications[0].publication_year == 2025
    assert publications[0].abstract == "Species evidence."


def test_literature_search_deduplicates_crossref_and_europe_pmc_by_doi() -> None:
    crossref = CrossrefLiteratureClient(
        client=FakeClient(
            {
                "message": {
                    "items": [
                        {
                            "DOI": "10.1000/shared",
                            "title": ["Shared paper"],
                            "URL": "https://doi.org/10.1000/shared",
                        }
                    ]
                }
            }
        )
    )
    europe_pmc = EuropePmcLiteratureClient(
        client=FakeClient(
            {
                "resultList": {
                    "result": [
                        {
                            "doi": "10.1000/shared",
                            "title": "Shared paper",
                            "source": "MED",
                            "id": "1",
                        }
                    ]
                }
            }
        )
    )

    publications = search_literature("Shared species", [crossref, europe_pmc])
    report = validate_publications(publications)

    assert len(publications) == 1
    assert report.checked_records == 1
    assert report.is_valid
