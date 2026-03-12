from app.models.search import SearchRequest
from app.providers.subito.provider import SubitoProvider


def test_subito_urls_without_query_use_question_separator() -> None:
    request = SearchRequest(sources=["subito"])
    urls = SubitoProvider._build_urls(request)

    assert urls[0].startswith("https://www.subito.it/annunci-italia/vendita/auto/")
    assert "?o=2" not in urls[0]
    assert urls[1].endswith("?o=2")


def test_subito_urls_with_query_use_ampersand_separator() -> None:
    request = SearchRequest(query="test", sources=["subito"])
    urls = SubitoProvider._build_urls(request)
    assert urls[1].endswith("&o=2")
    assert urls[2].endswith("&o=3")
