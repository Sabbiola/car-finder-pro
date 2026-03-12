from dataclasses import dataclass
from datetime import datetime, timezone

from app.providers.autoscout24 import AutoScout24Provider
from app.providers.base.base_provider import BaseProvider
from app.providers.base.models import ProviderHealth, ProviderInfo
from app.providers.subito import SubitoProvider


@dataclass
class ProviderRuntimeStats:
    total_calls: int = 0
    failed_calls: int = 0
    total_latency_ms: int = 0
    last_success: datetime | None = None


class ProviderRegistry:
    def __init__(self) -> None:
        self._providers: dict[str, BaseProvider] = {
            "autoscout24": AutoScout24Provider(),
            "subito": SubitoProvider(),
        }
        self._stats: dict[str, ProviderRuntimeStats] = {
            provider_id: ProviderRuntimeStats() for provider_id in self._providers
        }

    def all(self) -> list[BaseProvider]:
        return list(self._providers.values())

    def get(self, provider_id: str) -> BaseProvider | None:
        return self._providers.get(provider_id)

    def catalog(self) -> list[ProviderInfo]:
        return [provider.info for provider in self.all()]

    def record_success(self, provider_id: str, latency_ms: int) -> None:
        stats = self._stats.setdefault(provider_id, ProviderRuntimeStats())
        stats.total_calls += 1
        stats.total_latency_ms += max(latency_ms, 0)
        stats.last_success = datetime.now(timezone.utc)

    def record_failure(self, provider_id: str, latency_ms: int) -> None:
        stats = self._stats.setdefault(provider_id, ProviderRuntimeStats())
        stats.total_calls += 1
        stats.failed_calls += 1
        stats.total_latency_ms += max(latency_ms, 0)

    async def health(self) -> list[ProviderHealth]:
        checks: list[ProviderHealth] = []
        for provider in self.all():
            base = await provider.health()
            stats = self._stats.get(provider.info.id, ProviderRuntimeStats())
            latency_ms = (
                int(stats.total_latency_ms / stats.total_calls) if stats.total_calls > 0 else base.latency_ms
            )
            error_rate = (stats.failed_calls / stats.total_calls) if stats.total_calls > 0 else base.error_rate
            checks.append(
                base.model_copy(
                    update={
                        "latency_ms": latency_ms,
                        "error_rate": round(error_rate, 4),
                        "last_success": stats.last_success or base.last_success,
                    }
                )
            )
        return checks
