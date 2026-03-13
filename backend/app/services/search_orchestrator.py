import asyncio
from collections import defaultdict
from datetime import datetime, timezone
from time import perf_counter
from typing import AsyncIterator

from app.core.observability import log_event
from app.core.provider_registry import ProviderRegistry
from app.core.settings import get_settings
from app.core.metrics import get_runtime_metrics
from app.dedup.deduplicator import deduplicate_listings
from app.models.events import CompleteEvent, ErrorEvent, ProgressEvent, ResultEvent
from app.models.search import BACKEND_POST_FILTERS, ProviderErrorDetail, SearchRequest, SearchResponse
from app.models.vehicle import VehicleListing
from app.normalizers.vehicle_normalizer import normalize_listing
from app.ranking.scoring import apply_basic_scoring
from app.services.analysis_service import AnalysisService
from app.services.provider_selector import select_providers
from app.services.supabase_market_repository import SupabaseMarketRepository


class SearchOrchestrator:
    def __init__(self, registry: ProviderRegistry, analysis_service: AnalysisService | None = None) -> None:
        self.registry = registry
        self.settings = get_settings()
        self.analysis_service = analysis_service or AnalysisService(repository=SupabaseMarketRepository())

    @staticmethod
    def _result_key(listing: VehicleListing) -> str:
        if listing.url:
            return listing.url
        return f"{listing.provider}|{listing.title}|{listing.price_amount}|{listing.year or ''}"

    @staticmethod
    def _format_provider_error(detail: ProviderErrorDetail) -> str:
        if detail.provider and detail.code == "provider_not_configured":
            return f"{detail.provider}: provider_not_configured"
        if detail.provider:
            return f"{detail.provider}: {detail.message}"
        return detail.message

    @staticmethod
    def _passes_post_filters(listing: VehicleListing, request: SearchRequest) -> bool:
        if request.private_only and (listing.seller_type or "").strip().lower() != "private":
            return False

        if request.transmission:
            listing_transmission = (listing.transmission or "").strip().lower()
            if listing_transmission != request.transmission.strip().lower():
                return False

        if request.mileage_min is not None:
            if listing.mileage_value is None or listing.mileage_value < request.mileage_min:
                return False

        if request.trim:
            listing_trim_context = " ".join([listing.trim or "", listing.title or ""]).strip().lower()
            if request.trim.strip().lower() not in listing_trim_context:
                return False

        return True

    def _post_filter_listings(self, listings: list[VehicleListing], request: SearchRequest) -> list[VehicleListing]:
        if not listings:
            return listings
        return [listing for listing in listings if self._passes_post_filters(listing, request)]

    def _unsupported_filter_errors(self, request: SearchRequest, selected) -> list[ProviderErrorDetail]:
        active_filters = request.active_filter_keys()
        if not active_filters or not selected:
            return []

        supported_union = set(BACKEND_POST_FILTERS)
        for provider in selected:
            supported_union.update(provider.info.supports_filters)

        unsupported = sorted(active_filters - supported_union)
        if not unsupported:
            return []

        return [
            ProviderErrorDetail(
                provider=None,
                code="unsupported_filter",
                message=f"Unsupported filters for selected sources: {', '.join(unsupported)}",
                retryable=False,
            )
        ]

    async def _run_provider(
        self, provider, request: SearchRequest
    ) -> tuple[str, list[VehicleListing], ProviderErrorDetail | None]:
        started_at = perf_counter()
        provider_id = provider.info.id
        log_event("provider_search_started", provider=provider_id)
        try:
            timeout = self.settings.provider_timeout_seconds
            results = await asyncio.wait_for(provider.search(request), timeout=timeout)
            normalized = [normalize_listing(result, provider.info.id) for result in results]
            latency_ms = int((perf_counter() - started_at) * 1000)
            self.registry.record_success(provider_id, latency_ms)
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
            error_message = f"Timed out after {self.settings.provider_timeout_seconds}s"
            self.registry.record_failure(provider_id, latency_ms, error_message)
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
            error_message = str(exc)
            self.registry.record_failure(provider_id, latency_ms, error_message)
            log_event(
                "provider_search_completed",
                provider=provider_id,
                duration_ms=latency_ms,
                status="error",
                result_count=0,
                error=error_message,
            )
            return (
                provider_id,
                [],
                ProviderErrorDetail(
                    provider=provider_id,
                    code="provider_failure",
                    message=error_message,
                    retryable=False,
                ),
            )

    def _requested_provider_config_errors(self, request: SearchRequest) -> list[ProviderErrorDetail]:
        if not request.sources:
            return []
        errors: list[ProviderErrorDetail] = []
        for source in request.sources:
            provider = self.registry.get(source)
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

    async def run_search(self, request: SearchRequest) -> SearchResponse:
        search_started = perf_counter()
        selected = select_providers(request, self.registry)
        provider_error_details = self._requested_provider_config_errors(request) + self._unsupported_filter_errors(
            request, selected
        )
        if not selected:
            provider_error_details.append(
                ProviderErrorDetail(
                    provider=None,
                    code="no_provider",
                    message="No eligible providers for this request",
                    retryable=False,
                )
            )
            get_runtime_metrics().record_search(mode="sync", duration_ms=0, had_errors=True)
            return SearchResponse(
                total_results=0,
                listings=[],
                providers_used=[],
                provider_errors=[self._format_provider_error(detail) for detail in provider_error_details],
                provider_error_details=provider_error_details,
            )

        log_event("search_started", mode="sync", provider_count=len(selected))
        collected: list[VehicleListing] = []
        semaphore = asyncio.Semaphore(self.settings.max_provider_concurrency)

        async def guarded(provider):
            async with semaphore:
                return await self._run_provider(provider, request)

        tasks = [asyncio.create_task(guarded(provider)) for provider in selected]
        for task in asyncio.as_completed(tasks):
            _provider_id, normalized, error_detail = await task
            if error_detail:
                provider_error_details.append(error_detail)
                continue
            collected.extend(normalized)

        deduped = deduplicate_listings(collected)
        ranked = apply_basic_scoring(deduped)
        ranked = self._post_filter_listings(ranked, request)
        ranked = await self.analysis_service.enrich_search_results(ranked)
        log_event(
            "search_completed",
            mode="sync",
            total_results=len(ranked),
            provider_errors=len(provider_error_details),
        )
        get_runtime_metrics().record_search(
            mode="sync",
            duration_ms=int((perf_counter() - search_started) * 1000),
            had_errors=bool(provider_error_details),
        )

        return SearchResponse(
            total_results=len(ranked),
            listings=ranked,
            providers_used=[provider.info.id for provider in selected],
            provider_errors=[self._format_provider_error(detail) for detail in provider_error_details],
            provider_error_details=provider_error_details,
        )

    async def stream_search(self, request: SearchRequest) -> AsyncIterator[dict]:
        started_at = datetime.now(timezone.utc)
        started_perf = perf_counter()
        selected = select_providers(request, self.registry)
        provider_errors = self._requested_provider_config_errors(request) + self._unsupported_filter_errors(
            request, selected
        )
        provider_error_count = len(provider_errors)

        for error_detail in provider_errors:
            yield ErrorEvent(
                provider=error_detail.provider,
                code=error_detail.code,
                message=error_detail.message,
                retryable=error_detail.retryable,
            ).model_dump(mode="json")

        if not selected:
            get_runtime_metrics().record_search(mode="stream", duration_ms=0, had_errors=True)
            yield ErrorEvent(
                provider=None,
                code="no_provider",
                message="No eligible providers for this request",
                retryable=False,
            ).model_dump(mode="json")
            yield CompleteEvent(
                total_results=0,
                provider_summary={},
                duration_ms=0,
                final_result_keys=[],
            ).model_dump(mode="json")
            return

        log_event("search_started", mode="stream", provider_count=len(selected))
        provider_summary: dict[str, int] = defaultdict(int)
        collected: list[VehicleListing] = []
        semaphore = asyncio.Semaphore(self.settings.max_provider_concurrency)

        for provider in selected:
            yield ProgressEvent(provider=provider.info.id, status="started").model_dump(mode="json")

        async def guarded(provider):
            async with semaphore:
                return await self._run_provider(provider, request)

        result_tasks = [asyncio.create_task(guarded(provider)) for provider in selected]
        for done in asyncio.as_completed(result_tasks):
            provider_id, normalized, error_detail = await done
            try:
                if error_detail:
                    raise RuntimeError(error_detail.message)
                provider_summary[provider_id] += len(normalized)
                collected.extend(normalized)
                scored_batch = apply_basic_scoring(normalized)
                for listing in scored_batch:
                    if not self._passes_post_filters(listing, request):
                        continue
                    await self.analysis_service.analyze_listing(
                        listing,
                        include=["deal", "trust", "negotiation"],
                        local_candidates=collected,
                        use_snapshot=False,
                    )
                    yield ResultEvent(listing=listing).model_dump(mode="json")

                yield ProgressEvent(
                    provider=provider_id,
                    status="completed",
                    fetched_count=len(normalized),
                ).model_dump(mode="json")
            except Exception as exc:  # noqa: BLE001
                provider_error_count += 1
                error_code = error_detail.code if error_detail else "provider_failure"
                yield ErrorEvent(
                    provider=provider_id,
                    code=error_code,
                    message=str(exc),
                    retryable=error_detail.retryable if error_detail else False,
                ).model_dump(mode="json")
                yield ProgressEvent(
                    provider=provider_id,
                    status="failed",
                    message=str(exc),
                ).model_dump(mode="json")

        final = apply_basic_scoring(deduplicate_listings(collected))
        final = self._post_filter_listings(final, request)
        duration_ms = int((datetime.now(timezone.utc) - started_at).total_seconds() * 1000)
        log_event(
            "search_completed",
            mode="stream",
            total_results=len(final),
            provider_errors=provider_error_count,
            duration_ms=duration_ms,
        )
        get_runtime_metrics().record_search(
            mode="stream",
            duration_ms=int((perf_counter() - started_perf) * 1000),
            had_errors=provider_error_count > 0,
        )
        yield CompleteEvent(
            total_results=len(final),
            provider_summary=dict(provider_summary),
            duration_ms=duration_ms,
            final_result_keys=[self._result_key(listing) for listing in final],
        ).model_dump(mode="json")
