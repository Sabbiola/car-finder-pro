import asyncio
from collections import defaultdict
from datetime import datetime, timezone
from time import perf_counter
from typing import AsyncIterator

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
        try:
            timeout = self.settings.provider_timeout_seconds
            results = await asyncio.wait_for(provider.search(request), timeout=timeout)
            normalized = [normalize_listing(result, provider.info.id) for result in results]
            latency_ms = int((perf_counter() - started_at) * 1000)
            self.registry.record_success(provider.info.id, latency_ms)
            return provider.info.id, normalized, None
        except asyncio.TimeoutError:
            latency_ms = int((perf_counter() - started_at) * 1000)
            self.registry.record_failure(provider.info.id, latency_ms)
            return provider.info.id, [], f"Timed out after {self.settings.provider_timeout_seconds}s"
        except Exception as exc:  # noqa: BLE001
            latency_ms = int((perf_counter() - started_at) * 1000)
            self.registry.record_failure(provider.info.id, latency_ms)
            return provider.info.id, [], str(exc)

    async def run_search(self, request: SearchRequest) -> SearchResponse:
        selected = select_providers(request, self.registry)
        if not selected:
            return SearchResponse(
                total_results=0,
                listings=[],
                providers_used=[],
                provider_errors=["No eligible providers for this request"],
            )

        collected: list[VehicleListing] = []
        provider_errors: list[str] = []
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

        return SearchResponse(
            total_results=len(ranked),
            listings=ranked,
            providers_used=[provider.info.id for provider in selected],
            provider_errors=provider_errors,
        )

    async def stream_search(self, request: SearchRequest) -> AsyncIterator[dict]:
        started_at = datetime.now(timezone.utc)
        selected = select_providers(request, self.registry)
        if not selected:
            yield ErrorEvent(
                provider=None,
                code="no_provider",
                message="No eligible providers for this request",
                retryable=False,
            ).model_dump(mode="json")
            yield CompleteEvent(total_results=0, provider_summary={}, duration_ms=0).model_dump(mode="json")
            return

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
        yield CompleteEvent(
            total_results=len(final),
            provider_summary=dict(provider_summary),
            duration_ms=duration_ms,
        ).model_dump(mode="json")
