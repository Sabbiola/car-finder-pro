from app.providers.automobile.provider import AutomobileProvider
from app.models.search import SearchRequest
from app.providers.autoscout24.provider import AutoScout24Provider
from app.providers.brumbrum.provider import BrumBrumProvider
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


def test_subito_urls_include_trim_when_query_is_derived() -> None:
    request = SearchRequest(brand="BMW", model="320d", trim="M Sport", sources=["subito"])
    urls = SubitoProvider._build_urls(request)
    assert "BMW+320d+M+Sport" in urls[0]


def test_autoscout_query_includes_trim() -> None:
    request = SearchRequest(brand="BMW", model="320d", trim="M Sport", sources=["autoscout24"])
    urls = AutoScout24Provider._build_urls(request)
    assert "q=320d+M+Sport" in urls[0]


def test_automobile_urls_include_query_and_pagination() -> None:
    request = SearchRequest(brand="BMW", model="320d", trim="M Sport", sources=["automobile"])
    urls = AutomobileProvider._build_urls(request)
    assert "q=BMW+320d+M+Sport" in urls[0]
    assert urls[1].endswith("&p=2")


def test_brumbrum_urls_include_query_and_pagination() -> None:
    request = SearchRequest(brand="BMW", model="320d", sources=["brumbrum"])
    urls = BrumBrumProvider._build_urls(request)
    assert "q=BMW+320d" in urls[0]
    assert urls[1].endswith("&p=2")
