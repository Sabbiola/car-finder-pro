from app.core.provider_registry import ProviderRegistry
from app.models.search import SearchRequest
from app.services.provider_selector import select_providers


def test_provider_selector_filters_by_sources() -> None:
    registry = ProviderRegistry()
    request = SearchRequest(brand="BMW", sources=["subito"])
    selected = select_providers(request, registry)
    assert [provider.info.id for provider in selected] == ["subito"]

