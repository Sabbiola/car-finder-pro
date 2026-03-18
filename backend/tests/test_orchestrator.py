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
        configured: bool = True,
    ) -> None:
        self._configured = configured
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

    def is_configured(self) -> bool:
        return self._configured

    async def search(self, _request: SearchRequest) -> list[VehicleListing]:
        if self._error is not None:
            raise self._error
        return self._results


class StubAnalysisService:
    def __init__(self, analysis_max_concurrency: int = 4) -> None:
        self.analysis_max_concurrency = analysis_max_concurrency

    async def analyze_listing(self, listing: VehicleListing, **_kwargs) -> VehicleListing:
        return listing


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
    assert by_provider["autoscout24"].total_calls == 1
    assert by_provider["subito"].error_rate == 1.0
    assert by_provider["subito"].failed_calls == 1
    assert by_provider["subito"].last_error == "provider down"


@pytest.mark.asyncio
async def test_run_search_adds_provider_not_configured_error_for_requested_source() -> None:
    registry = ProviderRegistry()
    registry._providers = {  # type: ignore[attr-defined]
        "ebay": FakeProvider("ebay", configured=False),
    }
    registry._stats = {"ebay": ProviderRuntimeStats()}  # type: ignore[attr-defined]
    orchestrator = SearchOrchestrator(registry=registry)

    response = await orchestrator.run_search(SearchRequest(brand="BMW", sources=["ebay"]))

    assert response.total_results == 0
    assert response.providers_used == []
    assert "ebay: provider_not_configured" in response.provider_errors
    assert "No eligible providers for this request" in response.provider_errors
    assert any(detail.code == "provider_not_configured" for detail in response.provider_error_details)
    assert any(detail.code == "no_provider" for detail in response.provider_error_details)


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
    assert "final_result_keys" in events[-1]


@pytest.mark.asyncio
async def test_stream_search_emits_provider_not_configured_for_requested_source() -> None:
    registry = ProviderRegistry()
    registry._providers = {  # type: ignore[attr-defined]
        "ebay": FakeProvider("ebay", configured=False),
    }
    registry._stats = {"ebay": ProviderRuntimeStats()}  # type: ignore[attr-defined]
    orchestrator = SearchOrchestrator(registry=registry)

    events = [event async for event in orchestrator.stream_search(SearchRequest(brand="BMW", sources=["ebay"]))]
    assert events[0]["event"] == "error"
    assert events[0]["code"] == "provider_not_configured"
    assert events[1]["event"] == "error"
    assert events[1]["code"] == "no_provider"
    assert events[-1]["event"] == "complete"


@pytest.mark.asyncio
async def test_stream_search_emits_results_before_provider_completed_progress() -> None:
    registry = ProviderRegistry()
    registry._providers = {  # type: ignore[attr-defined]
        "autoscout24": FakeProvider(
            "autoscout24",
            results=[
                _listing("autoscout24", "A", "https://example.com/a", 20000),
                _listing("autoscout24", "B", "https://example.com/b", 21000),
                _listing("autoscout24", "C", "https://example.com/c", 22000),
            ],
        ),
    }
    registry._stats = {"autoscout24": ProviderRuntimeStats()}  # type: ignore[attr-defined]
    orchestrator = SearchOrchestrator(
        registry=registry,
        analysis_service=StubAnalysisService(analysis_max_concurrency=4),
    )

    events = [event async for event in orchestrator.stream_search(SearchRequest(brand="BMW"))]
    completed_index = next(
        index
        for index, event in enumerate(events)
        if event["event"] == "progress"
        and event.get("provider") == "autoscout24"
        and event.get("status") == "completed"
    )
    result_indices = [
        index
        for index, event in enumerate(events)
        if event["event"] == "result"
        and event.get("listing", {}).get("provider") == "autoscout24"
    ]

    assert len(result_indices) == 3
    assert all(index < completed_index for index in result_indices)


@pytest.mark.asyncio
async def test_run_search_excludes_provider_for_unsupported_active_filter() -> None:
    registry = ProviderRegistry()
    registry._providers = {  # type: ignore[attr-defined]
        "subito": FakeProvider("subito", results=[]),
    }
    registry._stats = {"subito": ProviderRuntimeStats()}  # type: ignore[attr-defined]
    orchestrator = SearchOrchestrator(registry=registry)

    response = await orchestrator.run_search(
        SearchRequest(brand="BMW", body_styles=["SUV"], sources=["subito"])
    )

    assert any(
        detail.code == "provider_excluded_unsupported_filter"
        and detail.provider == "subito"
        for detail in response.provider_error_details
    )
    assert any(detail.code == "no_provider_eligible_for_filters" for detail in response.provider_error_details)


@pytest.mark.asyncio
async def test_run_search_applies_extended_post_filters() -> None:
    listing = _listing("autoscout24", "BMW 320d", "https://example.com/colored", 22000).model_copy(
        update={
            "color": "Nero",
            "doors": 4,
            "emission_class": "Euro 6",
            "seller_type": "dealer",
            "is_new": False,
        }
    )
    registry = ProviderRegistry()
    registry._providers = {  # type: ignore[attr-defined]
        "autoscout24": FakeProvider("autoscout24", results=[listing]),
    }
    registry._stats = {"autoscout24": ProviderRuntimeStats()}  # type: ignore[attr-defined]
    orchestrator = SearchOrchestrator(registry=registry)

    matching = await orchestrator.run_search(
        SearchRequest(
            brand="BMW",
            color="nero",
            doors=4,
            emission_class="Euro6",
            seller_type="dealer",
            is_new=False,
        )
    )
    non_matching = await orchestrator.run_search(
        SearchRequest(
            brand="BMW",
            color="Bianco",
            doors=2,
            seller_type="private",
        )
    )

    assert matching.total_results == 1
    assert non_matching.total_results == 0
