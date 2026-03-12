from collections.abc import Sequence

import pytest

from app.core.provider_registry import ProviderRegistry, ProviderRuntimeStats
from app.models.search import SearchRequest
from app.models.vehicle import VehicleListing
from app.providers.base.base_provider import BaseProvider
from app.providers.base.models import ProviderInfo
from app.services.search_orchestrator import SearchOrchestrator


class FakeProvider(BaseProvider):
    def __init__(
        self,
        provider_id: str,
        *,
        results: Sequence[VehicleListing] | None = None,
        error: Exception | None = None,
        enabled: bool = True,
    ) -> None:
        self.info = ProviderInfo(
            id=provider_id,
            name=provider_id,
            provider_type="html_scraper",
            market="IT",
            enabled=enabled,
            supports_filters=["brand", "model"],
        )
        self._results = list(results or [])
        self._error = error

    async def search(self, _request: SearchRequest) -> list[VehicleListing]:
        if self._error is not None:
            raise self._error
        return self._results


def _listing(provider: str, title: str, url: str, price: int) -> VehicleListing:
    return VehicleListing(
        provider=provider,
        market="IT",
        title=title,
        url=url,
        make="BMW",
        model="320d",
        year=2020,
        price_amount=price,
    )


def _build_registry() -> ProviderRegistry:
    registry = ProviderRegistry()
    registry._providers = {  # type: ignore[attr-defined]
        "autoscout24": FakeProvider(
            "autoscout24",
            results=[
                _listing("autoscout24", "A", "https://example.com/a", 20000),
                _listing("autoscout24", "A duplicate", "https://example.com/a", 20000),
            ],
        ),
        "subito": FakeProvider(
            "subito",
            error=RuntimeError("provider down"),
        ),
    }
    registry._stats = {  # type: ignore[attr-defined]
        provider_id: ProviderRuntimeStats() for provider_id in registry._providers
    }
    return registry


@pytest.mark.asyncio
async def test_run_search_handles_partial_failures_and_dedup() -> None:
    registry = _build_registry()
    orchestrator = SearchOrchestrator(registry=registry)

    response = await orchestrator.run_search(
        SearchRequest(brand="BMW", model="320d", sources=["autoscout24", "subito"])
    )

    assert response.total_results == 1
    assert len(response.listings) == 1
    assert response.providers_used == ["autoscout24", "subito"]
    assert response.provider_errors == ["subito: provider down"]
    assert response.listings[0].deal_score is not None
    assert response.listings[0].reason_codes

    health = await registry.health()
    by_provider = {entry.provider: entry for entry in health}
    assert by_provider["autoscout24"].error_rate == 0.0
    assert by_provider["subito"].error_rate == 1.0


@pytest.mark.asyncio
async def test_stream_search_emits_error_and_complete() -> None:
    registry = _build_registry()
    orchestrator = SearchOrchestrator(registry=registry)

    events = [event async for event in orchestrator.stream_search(SearchRequest(brand="BMW", model="320d"))]
    event_names = [event["event"] for event in events]

    assert event_names.count("progress") >= 2
    assert "result" in event_names
    assert "error" in event_names
    assert event_names[-1] == "complete"
