from __future__ import annotations

import hmac

from fastapi import APIRouter, Header, HTTPException
from starlette.responses import PlainTextResponse

from app.core.listing_cache import get_listing_session_cache
from app.core.metrics import get_runtime_metrics
from app.core.settings import get_settings

router = APIRouter()

_CONTENT_TYPE = "text/plain; version=0.0.4; charset=utf-8"


def _verify_metrics_token(x_ops_token: str | None) -> None:
    settings = get_settings()
    required = (getattr(settings, "ops_token", None) or "").strip()
    provided = (x_ops_token or "").strip()
    if required and not hmac.compare_digest(provided, required):
        raise HTTPException(status_code=403, detail="Invalid or missing ops token")


def _line(name: str, labels: dict[str, str] | None, value: float | int, *, type_: str = "gauge") -> str:
    label_str = ""
    if labels:
        pairs = ",".join(f'{k}="{v}"' for k, v in labels.items())
        label_str = f"{{{pairs}}}"
    return f"{name}{label_str} {value}"


def _build_prometheus_output() -> str:
    snap = get_runtime_metrics().snapshot()
    cache_size = get_listing_session_cache().size

    lines: list[str] = []

    def emit(name: str, help_: str, type_: str, metrics: list[tuple[dict[str, str] | None, float | int]]) -> None:
        lines.append(f"# HELP {name} {help_}")
        lines.append(f"# TYPE {name} {type_}")
        for labels, value in metrics:
            if value is not None:
                lines.append(_line(name, labels, value, type_=type_))

    # Search
    search_data = snap.get("search", {})
    for mode in ("sync", "stream"):
        s = search_data.get(mode, {}) if isinstance(search_data, dict) else {}
        if not isinstance(s, dict):
            continue
        lbl = {"mode": mode}
        emit("carfinder_search_requests_total", "Total search requests by mode", "counter", [(lbl, s.get("total", 0))])
        emit("carfinder_search_errors_total", "Errored search requests by mode", "counter", [(lbl, s.get("errored", 0))])
        if s.get("p95_ms") is not None:
            emit("carfinder_search_duration_p95_ms", "p95 search latency ms by mode", "gauge", [(lbl, s["p95_ms"])])
        if s.get("p50_ms") is not None:
            emit("carfinder_search_duration_p50_ms", "p50 search latency ms by mode", "gauge", [(lbl, s["p50_ms"])])

    # HTTP
    http_data = snap.get("http", {})
    if isinstance(http_data, dict):
        all_paths = list(http_data.keys())
        http_total = [({"path": p}, http_data[p].get("total", 0)) for p in all_paths]
        http_failed = [({"path": p}, http_data[p].get("failed", 0)) for p in all_paths]
        http_p95 = [({"path": p}, http_data[p]["p95_ms"]) for p in all_paths if http_data[p].get("p95_ms") is not None]
        if http_total:
            emit("carfinder_http_requests_total", "Total HTTP requests by path", "counter", http_total)
        if http_failed:
            emit("carfinder_http_failures_total", "HTTP 5xx responses by path", "counter", http_failed)
        if http_p95:
            emit("carfinder_http_duration_p95_ms", "p95 HTTP latency ms by path", "gauge", http_p95)

    # Analysis cache
    analysis_data = snap.get("analysis", {})
    if isinstance(analysis_data, dict):
        emit("carfinder_analysis_cache_hits_total", "Analysis cache hits", "counter",
             [(None, analysis_data.get("cache_hits", 0))])
        emit("carfinder_analysis_cache_misses_total", "Analysis cache misses", "counter",
             [(None, analysis_data.get("cache_misses", 0))])
        emit("carfinder_analysis_repository_calls_total", "Repository calls during analysis", "counter",
             [(None, analysis_data.get("repository_calls_count", 0))])

    # Stream completion
    stream_data = snap.get("stream_completion", {})
    if isinstance(stream_data, dict):
        emit("carfinder_stream_started_total", "Total streams started", "counter",
             [(None, stream_data.get("started", 0))])
        emit("carfinder_stream_completed_total", "Total streams completed", "counter",
             [(None, stream_data.get("completed", 0))])

    # Alerts processor
    ap_data = snap.get("alerts_processor", {})
    if isinstance(ap_data, dict):
        emit("carfinder_alerts_processor_runs_total", "Alert processor runs", "counter",
             [(None, ap_data.get("runs", 0))])
        emit("carfinder_alerts_triggered_total", "Alerts triggered", "counter",
             [(None, ap_data.get("triggered_total", 0))])
        emit("carfinder_alerts_notified_total", "Alerts notified", "counter",
             [(None, ap_data.get("notified_total", 0))])
        emit("carfinder_alerts_failed_total", "Alerts failed to notify", "counter",
             [(None, ap_data.get("failed_total", 0))])

    # Listing session cache
    emit("carfinder_listing_cache_size", "In-memory listing session cache size", "gauge",
         [(None, cache_size)])

    return "\n".join(lines) + "\n"


@router.get("/metrics", response_class=PlainTextResponse, include_in_schema=False)
async def prometheus_metrics(
    x_ops_token: str | None = Header(default=None),
) -> PlainTextResponse:
    _verify_metrics_token(x_ops_token)
    body = _build_prometheus_output()
    return PlainTextResponse(content=body, media_type=_CONTENT_TYPE)
