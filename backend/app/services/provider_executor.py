"""Isolated provider-execution helpers used by SearchOrchestrator.

Separates the mechanics of running a single provider (circuit-breaker, timeout,
error handling, normalization) from the top-level orchestration logic.
"""

from __future__ import annotations

import asyncio
import re
from time import perf_counter

from app.core.observability import log_event
from app.core.provider_registry import ProviderRegistry
from app.core.settings import get_settings
from app.models.search import BACKEND_POST_FILTERS, ProviderErrorDetail, SearchRequest
from app.models.vehicle import VehicleListing
from app.normalizers.vehicle_normalizer import normalize_listing


def select_eligible_providers(
    request: SearchRequest,
    selected: list,
) -> tuple[list, list[ProviderErrorDetail]]:
    """Filter *selected* providers to those that support all non-post-filter active keys."""
    active_filters = request.active_filter_keys()
    if not active_filters or not selected:
        return selected, []

    provider_required_filters = active_filters - set(BACKEND_POST_FILTERS)
    if not provider_required_filters:
        return selected, []

    eligible: list = []
    excluded_errors: list[ProviderErrorDetail] = []
    for provider in selected:
        missing = sorted(provider_required_filters - set(provider.info.supports_filters))
        if not missing:
            eligible.append(provider)
            continue
        excluded_errors.append(
            ProviderErrorDetail(
                provider=provider.info.id,
                code="provider_excluded_unsupported_filter",
                message=f"Excluded by active filters: {', '.join(missing)}",
                retryable=False,
            )
        )
    return eligible, excluded_errors


def no_provider_error(request: SearchRequest, *, had_selected_providers: bool) -> ProviderErrorDetail:
    if had_selected_providers:
        active = sorted(
            {f for f in request.active_filter_keys() if f not in BACKEND_POST_FILTERS}
        )
        suffix = f" for active filters: {', '.join(active)}" if active else ""
        return ProviderErrorDetail(
            provider=None,
            code="no_provider_eligible_for_filters",
            message=f"No eligible providers{suffix}",
            retryable=False,
        )
    return ProviderErrorDetail(
        provider=None,
        code="no_provider",
        message="No eligible providers for this request",
        retryable=False,
    )


def config_errors_for_request(
    request: SearchRequest, registry: ProviderRegistry
) -> list[ProviderErrorDetail]:
    if not request.sources:
        return []
    errors: list[ProviderErrorDetail] = []
    for source in request.sources:
        provider = registry.get(source)
        if provider is None:
            continue
        if provider.info.enabled and not provider.is_configured():
            errors.append(
                ProviderErrorDetail(
                    provider=source,
                    code="provider_not_configured",
                    message="Provider is not configured",
                    retryable=False,
                )
            )
    return errors


async def run_provider(
    provider,
    request: SearchRequest,
    registry: ProviderRegistry,
) -> tuple[str, list[VehicleListing], ProviderErrorDetail | None]:
    """Execute one provider search with circuit-breaker, timeout, and normalization."""
    settings = get_settings()
    provider_id = provider.info.id

    if registry.is_circuit_open(provider_id):
        log_event("provider_circuit_open_skipped", provider=provider_id)
        return (
            provider_id,
            [],
            ProviderErrorDetail(
                provider=provider_id,
                code="provider_circuit_open",
                message="Circuit breaker open — provider temporarily skipped",
                retryable=True,
            ),
        )

    started_at = perf_counter()
    log_event("provider_search_started", provider=provider_id)
    try:
        results = await asyncio.wait_for(
            provider.search(request), timeout=settings.provider_timeout_seconds
        )
        normalized = [normalize_listing(r, provider_id) for r in results]
        latency_ms = int((perf_counter() - started_at) * 1000)
        registry.record_success(provider_id, latency_ms)
        log_event(
            "provider_search_completed",
            provider=provider_id,
            duration_ms=latency_ms,
            status="success",
            result_count=len(normalized),
        )
        return provider_id, normalized, None

    except asyncio.TimeoutError:
        latency_ms = int((perf_counter() - started_at) * 1000)
        error_message = f"Timed out after {settings.provider_timeout_seconds}s"
        registry.record_failure(provider_id, latency_ms, error_message)
        log_event(
            "provider_search_completed",
            provider=provider_id,
            duration_ms=latency_ms,
            status="timeout",
            result_count=0,
            error=error_message,
        )
        return (
            provider_id,
            [],
            ProviderErrorDetail(
                provider=provider_id,
                code="provider_timeout",
                message=error_message,
                retryable=True,
            ),
        )

    except Exception as exc:  # noqa: BLE001
        latency_ms = int((perf_counter() - started_at) * 1000)
        internal_error = str(exc)
        safe_message = f"Provider error ({type(exc).__name__})"
        registry.record_failure(provider_id, latency_ms, internal_error)
        log_event(
            "provider_search_completed",
            provider=provider_id,
            duration_ms=latency_ms,
            status="error",
            result_count=0,
            error=internal_error,
        )
        return (
            provider_id,
            [],
            ProviderErrorDetail(
                provider=provider_id,
                code="provider_failure",
                message=safe_message,
                retryable=False,
            ),
        )
