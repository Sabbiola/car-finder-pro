import pytest

from app.core.provider_registry import ProviderRegistry, ProviderRuntimeStats
from app.models.search import SearchRequest
from app.models.vehicle import VehicleListing
from app.providers.base.base_provider import BaseProvider
from app.providers.base.models import ProviderHealth, ProviderInfo


class MetricsProvider(BaseProvider):
    info = ProviderInfo(
        id="metrics",
        name="metrics",
        provider_type="official_api",
        market="IT",
        enabled=True,
        configured=True,
        supports_filters=["brand"],
    )

    async def search(self, _request: SearchRequest) -> list[VehicleListing]:
        return []

    async def health(self) -> ProviderHealth:
        return ProviderHealth(
            provider=self.info.id,
            enabled=True,
            configured=True,
            latency_ms=10,
            error_rate=0.0,
        )


@pytest.mark.asyncio
async def test_provider_registry_health_accumulates_runtime_metrics() -> None:
    registry = ProviderRegistry()
    registry._providers = {"metrics": MetricsProvider()}  # type: ignore[attr-defined]
    registry._stats = {"metrics": ProviderRuntimeStats()}  # type: ignore[attr-defined]

    registry.record_success("metrics", 120)
    registry.record_failure("metrics", 60, "boom")
    health = await registry.health()
    entry = health[0]
    assert entry.total_calls == 2
    assert entry.failed_calls == 1
    assert entry.latency_ms == 90
    assert entry.error_rate == 0.5
    assert entry.last_error == "boom"

    registry.record_success("metrics", 30)
    health_after_recovery = await registry.health()
    recovered = health_after_recovery[0]
    assert recovered.total_calls == 3
    assert recovered.failed_calls == 1
    assert recovered.last_error is None
