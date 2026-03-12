from app.core.provider_registry import ProviderRegistry, ProviderRuntimeStats
from app.models.search import SearchRequest
from app.models.vehicle import VehicleListing
from app.providers.base.base_provider import BaseProvider
from app.providers.base.models import ProviderInfo
from app.services.provider_selector import select_providers


class FakeProvider(BaseProvider):
    def __init__(self, provider_id: str, *, configured: bool = True, enabled: bool = True) -> None:
        self._configured = configured
        self.info = ProviderInfo(
            id=provider_id,
            name=provider_id,
            provider_type="html_scraper",
            market="IT",
            enabled=enabled,
            supports_filters=["brand", "model"],
        )

    def is_configured(self) -> bool:
        return self._configured

    async def search(self, _request: SearchRequest) -> list[VehicleListing]:
        return []


def test_provider_selector_filters_by_sources_and_configuration() -> None:
    registry = ProviderRegistry()
    registry._providers = {  # type: ignore[attr-defined]
        "subito": FakeProvider("subito", configured=True),
        "ebay": FakeProvider("ebay", configured=False),
    }
    registry._stats = {  # type: ignore[attr-defined]
        provider_id: ProviderRuntimeStats() for provider_id in registry._providers
    }

    selected = select_providers(SearchRequest(brand="BMW", sources=["subito", "ebay"]), registry)
    assert [provider.info.id for provider in selected] == ["subito"]
