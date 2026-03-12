import asyncio
from collections import defaultdict
from datetime import datetime, timezone
from time import perf_counter
from typing import AsyncIterator

from app.core.observability import log_event
from app.core.settings import get_settings
from app.core.provider_registry import ProviderRegistry
from app.dedup.deduplicator import deduplicate_listings
from app.models.events import CompleteEvent, ErrorEvent, ProgressEvent, ResultEvent
from app.models.search import SearchRequest, SearchResponse
from app.models.vehicle import VehicleListing
from app.normalizers.vehicle_normalizer import normalize_listing
from app.ranking.scoring import apply_basic_scoring
from app.services.provider_selector import select_providers


class SearchOrchestrator:
    def __init__(self, registry: ProviderRegistry) -> None:
        self.registry = registry
        self.settings = get_settings()

    async def _run_provider(self, provider, request: SearchRequest) -> tuple[str, list[VehicleListing], str | None]:
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
            return provider_id, [], error_message
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
            return provider_id, [], error_message

    def _requested_provider_config_errors(self, request: SearchRequest) -> list[str]:
        if not request.sources:
            return []
        errors: list[str] = []
        for source in request.sources:
            provider = self.registry.get(source)
            if provider is None:
                continue
            if provider.info.enabled and not provider.is_configured():
                errors.append(f"{source}: provider_not_configured")
        return errors

    async def run_search(self, request: SearchRequest) -> SearchResponse:
        selected = select_providers(request, self.registry)
        provider_errors: list[str] = self._requested_provider_config_errors(request)
        if not selected:
            return SearchResponse(
                total_results=0,
                listings=[],
                providers_used=[],
                provider_errors=provider_errors + ["No eligible providers for this request"],
            )

        log_event("search_started", mode="sync", provider_count=len(selected))
        collected: list[VehicleListing] = []
        semaphore = asyncio.Semaphore(self.settings.max_provider_concurrency)

        async def guarded(provider):
            async with semaphore:
                return await self._run_provider(provider, request)

        tasks = [asyncio.create_task(guarded(provider)) for provider in selected]
        for task in asyncio.as_completed(tasks):
            provider_id, normalized, error = await task
            if error:
                provider_errors.append(f"{provider_id}: {error}")
                continue
            collected.extend(normalized)

        deduped = deduplicate_listings(collected)
        ranked = apply_basic_scoring(deduped)
        log_event(
            "search_completed",
            mode="sync",
            total_results=len(ranked),
            provider_errors=len(provider_errors),
        )

        return SearchResponse(
            total_results=len(ranked),
            listings=ranked,
            providers_used=[provider.info.id for provider in selected],
            provider_errors=provider_errors,
        )

    async def stream_search(self, request: SearchRequest) -> AsyncIterator[dict]:
        started_at = datetime.now(timezone.utc)
        selected = select_providers(request, self.registry)
        provider_config_errors = self._requested_provider_config_errors(request)
        provider_error_count = len(provider_config_errors)

        for error_message in provider_config_errors:
            provider_id = error_message.split(":", maxsplit=1)[0]
            yield ErrorEvent(
                provider=provider_id,
                code="provider_not_configured",
                message=error_message,
                retryable=False,
            ).model_dump(mode="json")

        if not selected:
            yield ErrorEvent(
                provider=None,
                code="no_provider",
                message="No eligible providers for this request",
                retryable=False,
            ).model_dump(mode="json")
            yield CompleteEvent(total_results=0, provider_summary={}, duration_ms=0).model_dump(mode="json")
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
            provider_id, normalized, error = await done
            try:
                if error:
                    raise RuntimeError(error)
                provider_summary[provider_id] += len(normalized)
                collected.extend(normalized)

                for listing in apply_basic_scoring(normalized):
                    yield ResultEvent(listing=listing).model_dump(mode="json")

                yield ProgressEvent(
                    provider=provider_id,
                    status="completed",
                    fetched_count=len(normalized),
                ).model_dump(mode="json")
            except Exception as exc:  # noqa: BLE001
                provider_error_count += 1
                yield ErrorEvent(
                    provider=provider_id,
                    code="provider_failure",
                    message=str(exc),
                    retryable=False,
                ).model_dump(mode="json")
                yield ProgressEvent(
                    provider=provider_id,
                    status="failed",
                    message=str(exc),
                ).model_dump(mode="json")

        final = apply_basic_scoring(deduplicate_listings(collected))
        duration_ms = int((datetime.now(timezone.utc) - started_at).total_seconds() * 1000)
        log_event(
            "search_completed",
            mode="stream",
            total_results=len(final),
            provider_errors=provider_error_count,
            duration_ms=duration_ms,
        )
        yield CompleteEvent(
            total_results=len(final),
            provider_summary=dict(provider_summary),
            duration_ms=duration_ms,
        ).model_dump(mode="json")
