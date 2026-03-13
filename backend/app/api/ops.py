from fastapi import APIRouter, Depends

from app.core.dependencies import get_provider_registry
from app.core.metrics import get_runtime_metrics
from app.core.provider_registry import ProviderRegistry


router = APIRouter()


@router.get("/ops/metrics")
async def ops_metrics(registry: ProviderRegistry = Depends(get_provider_registry)) -> dict[str, object]:
    runtime = get_runtime_metrics().snapshot()
    provider_health = [item.model_dump(mode="json") for item in await registry.health()]
    return {
        "runtime": runtime,
        "providers": provider_health,
    }


@router.get("/ops/alerts")
async def ops_alerts(
    registry: ProviderRegistry = Depends(get_provider_registry),
    p95_threshold_ms: int = 5000,
    error_rate_threshold: float = 0.02,
) -> dict[str, object]:
    runtime = get_runtime_metrics().snapshot()
    provider_health = [item.model_dump(mode="json") for item in await registry.health()]
    alerts: list[dict[str, object]] = []

    search_runtime = runtime.get("search", {})
    for mode in ("sync", "stream"):
        raw_mode_data = search_runtime.get(mode, {}) if isinstance(search_runtime, dict) else {}
        mode_data = raw_mode_data if isinstance(raw_mode_data, dict) else {}
        p95 = mode_data.get("p95_ms")
        error_rate = mode_data.get("error_rate")
        if isinstance(p95, int) and p95 > p95_threshold_ms:
            alerts.append(
                {
                    "code": "search_latency_high",
                    "severity": "warning",
                    "metric": f"search.{mode}.p95_ms",
                    "value": p95,
                    "threshold": p95_threshold_ms,
                }
            )
        if isinstance(error_rate, (int, float)) and error_rate > error_rate_threshold:
            alerts.append(
                {
                    "code": "search_error_rate_high",
                    "severity": "warning",
                    "metric": f"search.{mode}.error_rate",
                    "value": round(float(error_rate), 4),
                    "threshold": error_rate_threshold,
                }
            )

    for provider in provider_health:
        provider_id = provider.get("provider")
        configured = provider.get("configured")
        enabled = provider.get("enabled")
        if enabled and configured is False:
            alerts.append(
                {
                    "code": "provider_not_configured",
                    "severity": "critical",
                    "provider": provider_id,
                }
            )
        provider_error_rate = provider.get("error_rate")
        if isinstance(provider_error_rate, (int, float)) and provider_error_rate > error_rate_threshold:
            alerts.append(
                {
                    "code": "provider_error_rate_high",
                    "severity": "warning",
                    "provider": provider_id,
                    "metric": "provider.error_rate",
                    "value": round(float(provider_error_rate), 4),
                    "threshold": error_rate_threshold,
                }
            )

    return {
        "alerts": alerts,
        "thresholds": {
            "p95_threshold_ms": p95_threshold_ms,
            "error_rate_threshold": error_rate_threshold,
        },
    }
