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
from app.models.search import ProviderErrorDetail, SearchRequest, SearchResponse
from app.models.vehicle import VehicleListing
from app.ranking.scoring import apply_basic_scoring
from app.services.analysis_service import AnalysisService
from app.services.post_filter import apply_post_filters, passes_post_filters
from app.services.provider_executor import (
    config_errors_for_request,
    no_provider_error,
    run_provider,
    select_eligible_providers,
)
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

    async def run_search(self, request: SearchRequest) -> SearchResponse:
        search_started = perf_counter()
        selected = select_providers(request, self.registry)
        eligible, compatibility_errors = select_eligible_providers(request, selected)
        provider_error_details = config_errors_for_request(request, self.registry) + compatibility_errors

        if not eligible:
            provider_error_details.append(
                no_provider_error(request, had_selected_providers=bool(selected))
            )
            get_runtime_metrics().record_search(mode="sync", duration_ms=0, had_errors=True)
            return SearchResponse(
                total_results=0,
                listings=[],
                providers_used=[],
                provider_errors=[self._format_provider_error(d) for d in provider_error_details],
                provider_error_details=provider_error_details,
            )

        log_event("search_started", mode="sync", provider_count=len(eligible))
        collected: list[VehicleListing] = []
        semaphore = asyncio.Semaphore(self.settings.max_provider_concurrency)

        async def guarded(provider):
            async with semaphore:
                return await run_provider(provider, request, self.registry)

        tasks = [asyncio.create_task(guarded(p)) for p in eligible]
        for task in asyncio.as_completed(tasks):
            _pid, normalized, error_detail = await task
            if error_detail:
                provider_error_details.append(error_detail)
                continue
            collected.extend(normalized)

        search_stage_started = perf_counter()
        deduped = deduplicate_listings(collected)
        ranked = apply_basic_scoring(deduped)
        ranked = apply_post_filters(ranked, request)
        search_stage_ms = int((perf_counter() - search_stage_started) * 1000)

        analysis_phase_started = perf_counter()
        ranked = await self.analysis_service.enrich_search_results(ranked)
        analysis_ms = int((perf_counter() - analysis_phase_started) * 1000)

        get_runtime_metrics().record_analysis_breakdown(search_ms=search_stage_ms, analysis_ms=analysis_ms)
        get_runtime_metrics().record_search(
            mode="sync",
            duration_ms=int((perf_counter() - search_started) * 1000),
            had_errors=bool(provider_error_details),
        )
        log_event("search_completed", mode="sync", total_results=len(ranked), provider_errors=len(provider_error_details))

        return SearchResponse(
            total_results=len(ranked),
            listings=ranked,
            providers_used=[p.info.id for p in eligible],
            provider_errors=[self._format_provider_error(d) for d in provider_error_details],
            provider_error_details=provider_error_details,
        )

    async def stream_search(self, request: SearchRequest) -> AsyncIterator[dict]:
        started_at = datetime.now(timezone.utc)
        started_perf = perf_counter()
        get_runtime_metrics().record_stream_started()

        selected = select_providers(request, self.registry)
        eligible, compatibility_errors = select_eligible_providers(request, selected)
        provider_errors = config_errors_for_request(request, self.registry) + compatibility_errors
        provider_error_count = len(provider_errors)

        for error_detail in provider_errors:
            yield ErrorEvent(
                provider=error_detail.provider,
                code=error_detail.code,
                message=error_detail.message,
                retryable=error_detail.retryable,
            ).model_dump(mode="json")

        if not eligible:
            err = no_provider_error(request, had_selected_providers=bool(selected))
            provider_errors.append(err)
            get_runtime_metrics().record_search(mode="stream", duration_ms=0, had_errors=True)
            get_runtime_metrics().record_stream_completed()
            yield ErrorEvent(
                provider=err.provider, code=err.code, message=err.message, retryable=err.retryable
            ).model_dump(mode="json")
            yield CompleteEvent(
                total_results=0, provider_summary={}, duration_ms=0, final_result_keys=[]
            ).model_dump(mode="json")
            return

        log_event("search_started", mode="stream", provider_count=len(eligible))
        provider_summary: dict[str, int] = defaultdict(int)
        collected: list[VehicleListing] = []
        semaphore = asyncio.Semaphore(self.settings.max_provider_concurrency)

        for provider in eligible:
            yield ProgressEvent(provider=provider.info.id, status="started").model_dump(mode="json")

        async def guarded(provider):
            async with semaphore:
                return await run_provider(provider, request, self.registry)

        result_tasks = [asyncio.create_task(guarded(p)) for p in eligible]
        for done in asyncio.as_completed(result_tasks):
            provider_id, normalized, error_detail = await done
            try:
                if error_detail:
                    raise RuntimeError(error_detail.message)

                provider_summary[provider_id] += len(normalized)
                collected.extend(normalized)
                scored_batch = apply_basic_scoring(normalized)
                filtered_batch = [l for l in scored_batch if passes_post_filters(l, request)]

                if filtered_batch:
                    analysis_concurrency = max(
                        1,
                        int(
                            getattr(
                                self.analysis_service,
                                "analysis_max_concurrency",
                                self.settings.analysis_max_concurrency,
                            )
                        ),
                    )
                    analysis_semaphore = asyncio.Semaphore(analysis_concurrency)

                    async def enrich_one(listing: VehicleListing) -> VehicleListing:
                        async with analysis_semaphore:
                            await self.analysis_service.analyze_listing(
                                listing,
                                include=["deal", "trust", "negotiation"],
                                local_candidates=collected,
                                use_snapshot=False,
                            )
                            return listing

                    enriched_batch = await asyncio.gather(*(enrich_one(l) for l in filtered_batch))
                    for listing in enriched_batch:
                        yield ResultEvent(listing=listing).model_dump(mode="json")

                yield ProgressEvent(
                    provider=provider_id, status="completed", fetched_count=len(normalized)
                ).model_dump(mode="json")

            except Exception as exc:  # noqa: BLE001
                provider_error_count += 1
                error_code = error_detail.code if error_detail else "provider_failure"
                safe_message = f"Provider error ({type(exc).__name__})"
                log_event("provider_stream_error", provider=provider_id, error=str(exc), code=error_code)
                yield ErrorEvent(
                    provider=provider_id,
                    code=error_code,
                    message=safe_message,
                    retryable=error_detail.retryable if error_detail else False,
                ).model_dump(mode="json")
                yield ProgressEvent(provider=provider_id, status="failed", message=safe_message).model_dump(mode="json")

        final = apply_post_filters(apply_basic_scoring(deduplicate_listings(collected)), request)
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
        get_runtime_metrics().record_stream_completed()
        yield CompleteEvent(
            total_results=len(final),
            provider_summary=dict(provider_summary),
            duration_ms=duration_ms,
            final_result_keys=[self._result_key(l) for l in final],
        ).model_dump(mode="json")
