from dataclasses import dataclass, field
from datetime import datetime, timezone

from app.core.observability import log_event
from app.core.settings import get_settings
from app.providers.automobile import AutomobileProvider
from app.providers.autoscout24 import AutoScout24Provider
from app.providers.base.base_provider import BaseProvider
from app.providers.base.models import ProviderHealth, ProviderInfo
from app.providers.brumbrum import BrumBrumProvider
from app.providers.ebay import EbayProvider
from app.providers.subito import SubitoProvider


@dataclass
class ProviderRuntimeStats:
    total_calls: int = 0
    failed_calls: int = 0
    total_latency_ms: int = 0
    last_success: datetime | None = None
    last_error: str | None = None
    consecutive_failures: int = 0
    circuit_open_since: datetime | None = field(default=None)


class ProviderRegistry:
    def __init__(self) -> None:
        settings = get_settings()
        disabled = set(settings.disabled_provider_list)
        self._providers: dict[str, BaseProvider] = {
            "autoscout24": AutoScout24Provider(),
            "subito": SubitoProvider(),
            "ebay": EbayProvider(),
            "automobile": AutomobileProvider(),
            "brumbrum": BrumBrumProvider(),
        }
        for provider_id in disabled:
            provider = self._providers.get(provider_id)
            if provider is not None:
                provider.info.enabled = False
        self._stats: dict[str, ProviderRuntimeStats] = {
            provider_id: ProviderRuntimeStats() for provider_id in self._providers
        }

    def all(self) -> list[BaseProvider]:
        return list(self._providers.values())

    def get(self, provider_id: str) -> BaseProvider | None:
        return self._providers.get(provider_id)

    def catalog(self) -> list[ProviderInfo]:
        return [
            provider.info.model_copy(update={"configured": provider.is_configured()})
            for provider in self.all()
        ]

    def is_circuit_open(self, provider_id: str) -> bool:
        """Return True if the circuit breaker for this provider is open (skip calls).

        After the reset window the circuit transitions to half-open: the next call
        is allowed through.  If it succeeds the circuit closes; if it fails again
        it re-trips immediately.
        """
        stats = self._stats.get(provider_id)
        if stats is None or stats.circuit_open_since is None:
            return False
        settings = get_settings()
        elapsed = (datetime.now(timezone.utc) - stats.circuit_open_since).total_seconds()
        if elapsed >= settings.circuit_breaker_reset_seconds:
            # Transition to half-open: allow one probe request.
            log_event("circuit_breaker_half_open", provider=provider_id, elapsed_s=int(elapsed))
            stats.circuit_open_since = None
            stats.consecutive_failures = 0
            return False
        return True

    def record_success(self, provider_id: str, latency_ms: int) -> None:
        stats = self._stats.setdefault(provider_id, ProviderRuntimeStats())
        stats.total_calls += 1
        stats.total_latency_ms += max(latency_ms, 0)
        stats.last_success = datetime.now(timezone.utc)
        stats.last_error = None
        stats.consecutive_failures = 0
        stats.circuit_open_since = None

    def record_failure(self, provider_id: str, latency_ms: int, error_message: str) -> None:
        stats = self._stats.setdefault(provider_id, ProviderRuntimeStats())
        stats.total_calls += 1
        stats.failed_calls += 1
        stats.total_latency_ms += max(latency_ms, 0)
        stats.last_error = error_message
        stats.consecutive_failures += 1
        settings = get_settings()
        if (
            stats.consecutive_failures >= settings.circuit_breaker_threshold
            and stats.circuit_open_since is None
        ):
            stats.circuit_open_since = datetime.now(timezone.utc)
            log_event(
                "circuit_breaker_tripped",
                provider=provider_id,
                consecutive_failures=stats.consecutive_failures,
                reset_seconds=settings.circuit_breaker_reset_seconds,
            )

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
                        "configured": provider.is_configured(),
                        "latency_ms": latency_ms,
                        "error_rate": round(error_rate, 4),
                        "last_success": stats.last_success or base.last_success,
                        "total_calls": stats.total_calls,
                        "failed_calls": stats.failed_calls,
                        "last_error": stats.last_error,
                        "circuit_open": stats.circuit_open_since is not None,
                        "consecutive_failures": stats.consecutive_failures,
                    }
                )
            )
        return checks
