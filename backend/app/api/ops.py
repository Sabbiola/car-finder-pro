from collections import Counter
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Header, HTTPException

from app.core.dependencies import get_market_repository, get_provider_registry
from app.core.observability import log_event
from app.core.metrics import get_runtime_metrics
from app.core.provider_registry import ProviderRegistry
from app.core.settings import get_settings
from app.services.supabase_market_repository import SupabaseMarketRepository


router = APIRouter()


def _verify_ops_token(x_ops_token: str | None = Header(default=None)) -> None:
    """Require a valid ops token when OPS_TOKEN env var is configured."""
    settings = get_settings()
    required_token = (getattr(settings, "ops_token", None) or "").strip()
    provided_token = (x_ops_token or "").strip()
    if required_token and provided_token != required_token:
        raise HTTPException(status_code=403, detail="Invalid or missing ops token")


def _summarize_delivery_attempts(rows: list[dict[str, object]], *, window_hours: int) -> dict[str, object]:
    if not rows:
        return {
            "window_hours": window_hours,
            "total_attempts": 0,
            "by_status": {},
            "by_channel": {},
            "failure_rate": 0.0,
            "latest_attempt_at": None,
            "recent_error_samples": [],
        }

    status_counts = Counter(str(row.get("status") or "unknown") for row in rows)
    channel_counts = Counter(str(row.get("channel") or "unknown") for row in rows)
    total_attempts = len(rows)
    failed_attempts = status_counts.get("failed", 0) + status_counts.get("retrying", 0)
    recent_error_samples = [
        str(row.get("error_message") or "")
        for row in rows
        if row.get("error_message")
    ][:10]

    return {
        "window_hours": window_hours,
        "total_attempts": total_attempts,
        "by_status": dict(status_counts),
        "by_channel": dict(channel_counts),
        "failure_rate": round((failed_attempts / total_attempts), 4) if total_attempts else 0.0,
        "latest_attempt_at": rows[0].get("created_at"),
        "recent_error_samples": recent_error_samples,
    }


async def _delivery_attempt_summary(
    repository: SupabaseMarketRepository,
    *,
    window_hours: int = 24,
    limit: int = 1000,
) -> dict[str, object]:
    since_iso = (datetime.now(timezone.utc) - timedelta(hours=window_hours)).isoformat()
    rows = await repository.fetch_alert_delivery_attempt_rows(limit=limit, since_iso=since_iso)
    return _summarize_delivery_attempts(rows, window_hours=window_hours)


@router.get("/ops/metrics")
async def ops_metrics(
    registry: ProviderRegistry = Depends(get_provider_registry),
    repository: SupabaseMarketRepository = Depends(get_market_repository),
    _auth: None = Depends(_verify_ops_token),
) -> dict[str, object]:
    runtime = get_runtime_metrics().snapshot()
    provider_health = [item.model_dump(mode="json") for item in await registry.health()]
    alert_delivery = await _delivery_attempt_summary(repository)
    log_event(
        "ops_metrics_snapshot",
        search_sync=runtime.get("search", {}).get("sync") if isinstance(runtime.get("search"), dict) else {},
        search_stream=runtime.get("search", {}).get("stream") if isinstance(runtime.get("search"), dict) else {},
        provider_count=len(provider_health),
        alert_attempts=alert_delivery.get("total_attempts"),
    )
    return {
        "runtime": runtime,
        "providers": provider_health,
        "alerts_processor": {
            "delivery_attempts_24h": alert_delivery,
        },
    }


@router.get("/ops/alerts")
async def ops_alerts(
    registry: ProviderRegistry = Depends(get_provider_registry),
    repository: SupabaseMarketRepository = Depends(get_market_repository),
    _auth: None = Depends(_verify_ops_token),
    p95_threshold_ms: int = 5000,
    error_rate_threshold: float = 0.02,
    stream_completion_threshold: float = 0.98,
    alerts_failure_rate_threshold: float = 0.2,
    alerts_retrying_threshold: int = 25,
) -> dict[str, object]:
    runtime = get_runtime_metrics().snapshot()
    provider_health = [item.model_dump(mode="json") for item in await registry.health()]
    delivery_summary = await _delivery_attempt_summary(repository)
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

    stream_completion = runtime.get("stream_completion", {})
    if isinstance(stream_completion, dict):
        completion_rate = stream_completion.get("completion_rate")
        if isinstance(completion_rate, (int, float)) and completion_rate < stream_completion_threshold:
            alerts.append(
                {
                    "code": "stream_completion_low",
                    "severity": "warning",
                    "metric": "stream_completion.completion_rate",
                    "value": round(float(completion_rate), 4),
                    "threshold": stream_completion_threshold,
                }
            )

    alerts_runtime = runtime.get("alerts_processor", {})
    if isinstance(alerts_runtime, dict):
        processor_failure_rate = alerts_runtime.get("failure_rate")
        if isinstance(processor_failure_rate, (int, float)) and processor_failure_rate > alerts_failure_rate_threshold:
            alerts.append(
                {
                    "code": "alerts_processor_failure_rate_high",
                    "severity": "warning",
                    "metric": "alerts_processor.failure_rate",
                    "value": round(float(processor_failure_rate), 4),
                    "threshold": alerts_failure_rate_threshold,
                }
            )

    delivery_failure_rate = delivery_summary.get("failure_rate")
    if isinstance(delivery_failure_rate, (int, float)) and delivery_failure_rate > alerts_failure_rate_threshold:
        alerts.append(
            {
                "code": "alerts_delivery_failure_rate_high",
                "severity": "warning",
                "metric": "alerts_processor.delivery_attempts_24h.failure_rate",
                "value": round(float(delivery_failure_rate), 4),
                "threshold": alerts_failure_rate_threshold,
            }
        )

    by_status = delivery_summary.get("by_status")
    if isinstance(by_status, dict):
        retrying_count = by_status.get("retrying")
        if isinstance(retrying_count, int) and retrying_count > alerts_retrying_threshold:
            alerts.append(
                {
                    "code": "alerts_retry_queue_high",
                    "severity": "warning",
                    "metric": "alerts_processor.delivery_attempts_24h.by_status.retrying",
                    "value": retrying_count,
                    "threshold": alerts_retrying_threshold,
                }
            )

    log_event(
        "ops_alerts_snapshot",
        alert_count=len(alerts),
        p95_threshold_ms=p95_threshold_ms,
        error_rate_threshold=error_rate_threshold,
        alerts_failure_rate_threshold=alerts_failure_rate_threshold,
    )

    return {
        "alerts": alerts,
        "alerts_processor": {"delivery_attempts_24h": delivery_summary},
        "thresholds": {
            "p95_threshold_ms": p95_threshold_ms,
            "error_rate_threshold": error_rate_threshold,
            "stream_completion_threshold": stream_completion_threshold,
            "alerts_failure_rate_threshold": alerts_failure_rate_threshold,
            "alerts_retrying_threshold": alerts_retrying_threshold,
        },
    }
