from __future__ import annotations

import asyncio
import hashlib
from datetime import datetime, timedelta, timezone
from time import perf_counter
from typing import Any, Iterable

from app.core.metrics import get_runtime_metrics
from app.core.settings import get_settings
from app.models.analysis_request import AnalyzeListingRequest
from app.models.analysis import ListingAnalysis, OwnershipEstimate, OwnershipProfile
from app.models.vehicle import VehicleListing
from app.services.comparables_service import ComparablesService
from app.services.deal_explainer import DealExplainer
from app.services.negotiation_service import NegotiationService
from app.services.ownership_service import OwnershipService
from app.services.supabase_market_repository import SupabaseMarketRepository, _parse_datetime
from app.services.trust_service import TrustService


class AnalysisService:
    def __init__(self, repository: SupabaseMarketRepository) -> None:
        self.repository = repository
        settings = get_settings()
        self.analysis_max_concurrency = max(1, settings.analysis_max_concurrency)
        self.comparables = ComparablesService(repository)
        self.deal_explainer = DealExplainer()
        self.trust_service = TrustService(repository)
        self.negotiation_service = NegotiationService()
        self.ownership_service = OwnershipService()

    @staticmethod
    def build_listing_hash(listing: VehicleListing) -> str:
        raw = "|".join(
            [
                listing.provider or "",
                listing.url or "",
                listing.title or "",
                str(listing.price_amount),
                str(listing.year or ""),
            ]
        )
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()

    async def _resolve_persisted_row(self, listing: VehicleListing) -> dict | None:
        if not self.repository.is_configured():
            return None
        if listing.id:
            row = await self.repository.fetch_listing_row_by_id(listing.id)
            if row:
                return row
        if listing.url:
            return await self.repository.fetch_listing_row_by_source_url(listing.url)
        return None

    @staticmethod
    def _first_seen_at(persisted_row: dict | None, price_history: list[dict]) -> datetime | None:
        if price_history:
            first = _parse_datetime(price_history[0].get("recorded_at"))
            if first is not None:
                return first
        if persisted_row:
            return _parse_datetime(persisted_row.get("created_at")) or _parse_datetime(persisted_row.get("scraped_at"))
        return None

    async def _build_enrichment_context(self, listings: list[VehicleListing]) -> dict[str, Any]:
        context: dict[str, Any] = {
            "comparables_cache": {},
            "image_reuse_by_hash": {},
            "seller_stats_by_key": {},
        }
        if not self.repository.is_configured() or not listings:
            return context

        listing_hashes: list[str] = []
        seller_inputs: list[tuple[str | None, str | None, str | None]] = []
        for listing in listings:
            listing_hash = listing.listing_hash or self.build_listing_hash(listing)
            listing.listing_hash = listing_hash
            if listing_hash:
                listing_hashes.append(listing_hash)
            seller_inputs.append((listing.seller_external_id, listing.seller_phone_hash, listing.seller_url))

        if listing_hashes:
            context["image_reuse_by_hash"] = await self.repository.fetch_image_reuse_counts(listing_hashes)
        if seller_inputs:
            context["seller_stats_by_key"] = await self.repository.fetch_seller_fingerprint_stats_bulk(seller_inputs)
        return context

    async def analyze_listing(
        self,
        listing: VehicleListing,
        *,
        include: Iterable[str],
        local_candidates: list[VehicleListing] | None = None,
        ownership_profile: OwnershipProfile | None = None,
        use_snapshot: bool = False,
        context: dict[str, Any] | None = None,
    ) -> ListingAnalysis:
        include_set = set(include)
        local_candidates = local_candidates or []
        listing_hash = listing.listing_hash or self.build_listing_hash(listing)
        listing.listing_hash = listing_hash

        snapshot_key = listing.id or listing_hash
        if use_snapshot and snapshot_key and self.repository.is_configured():
            snapshot_row = await self.repository.fetch_analysis_snapshot(snapshot_key)
            if snapshot_row and snapshot_row.get("payload"):
                return ListingAnalysis.model_validate(snapshot_row["payload"])

        persisted_row = await self._resolve_persisted_row(listing)
        if persisted_row and not listing.id:
            listing.id = persisted_row.get("id")
        price_history = (
            await self.repository.fetch_price_history(str(persisted_row.get("id")))
            if persisted_row and persisted_row.get("id") and self.repository.is_configured()
            else []
        )
        first_seen_at = self._first_seen_at(persisted_row, price_history)

        deal_summary = None
        trust_summary = None
        negotiation_summary = None
        ownership_estimate: OwnershipEstimate | None = None

        if "deal" in include_set or "negotiation" in include_set:
            comparables_cache = context.get("comparables_cache") if context else None
            metrics = await self.comparables.build_metrics(
                listing,
                local_candidates=local_candidates,
                cache=comparables_cache if isinstance(comparables_cache, dict) else None,
            )
            deal_summary = self.deal_explainer.build_summary(
                listing,
                benchmark_price=metrics["benchmark_price"],
                comparable_count=metrics["comparable_count"],
                confidence=metrics["confidence"],
                price_history=price_history,
                first_seen_at=first_seen_at,
            )
            listing.deal_summary = deal_summary

        if "trust" in include_set or "negotiation" in include_set:
            image_reuse_count_hint = None
            seller_stats_hint = None
            if context and listing_hash:
                image_reuse_by_hash = context.get("image_reuse_by_hash")
                if isinstance(image_reuse_by_hash, dict):
                    image_reuse_count_hint = image_reuse_by_hash.get(listing_hash)
                seller_stats_by_key = context.get("seller_stats_by_key")
                seller_key = self.repository.seller_stats_key(
                    seller_external_id=listing.seller_external_id,
                    seller_phone_hash=listing.seller_phone_hash,
                    seller_url=listing.seller_url,
                )
                if seller_key and isinstance(seller_stats_by_key, dict):
                    seller_stats_hint = seller_stats_by_key.get(seller_key)

            trust_summary = await self.trust_service.build_summary(
                listing,
                image_reuse_count_hint=image_reuse_count_hint,
                seller_stats_hint=seller_stats_hint,
            )
            listing.trust_summary = trust_summary

        if "negotiation" in include_set:
            negotiation_summary = self.negotiation_service.build_summary(
                listing,
                deal_summary=deal_summary or listing.deal_summary,
                trust_summary=trust_summary or listing.trust_summary,
            )
            listing.negotiation_summary = negotiation_summary

        if "ownership" in include_set:
            profile = ownership_profile or OwnershipProfile()
            ownership_estimate = self.ownership_service.build_estimate(listing, profile=profile)

        analysis = ListingAnalysis(
            listing_id=listing.id,
            listing_hash=listing_hash,
            deal_summary=deal_summary,
            trust_summary=trust_summary,
            negotiation_summary=negotiation_summary,
            ownership_estimate=ownership_estimate,
        )

        if use_snapshot and snapshot_key and self.repository.is_configured():
            expires_at = datetime.now(timezone.utc) + timedelta(hours=self.repository.settings.analysis_snapshot_ttl_hours)
            await self.repository.upsert_analysis_snapshot(
                snapshot_key=snapshot_key,
                listing_id=listing.id,
                payload=analysis.model_dump(mode="json"),
                expires_at=expires_at,
            )

        return analysis

    async def enrich_search_results(self, listings: list[VehicleListing]) -> list[VehicleListing]:
        if not listings:
            return listings
        context = await self._build_enrichment_context(listings)
        semaphore = asyncio.Semaphore(self.analysis_max_concurrency)

        async def enrich_one(listing: VehicleListing) -> VehicleListing:
            async with semaphore:
                started = perf_counter()
                await self.analyze_listing(
                    listing,
                    include=["deal", "trust", "negotiation"],
                    local_candidates=listings,
                    use_snapshot=False,
                    context=context,
                )
                get_runtime_metrics().record_analysis_breakdown(
                    search_ms=0,
                    analysis_ms=int((perf_counter() - started) * 1000),
                )
                return listing

        return await asyncio.gather(*(enrich_one(listing) for listing in listings))

    async def analyze_request(self, request: AnalyzeListingRequest) -> ListingAnalysis:
        listing = request.listing
        if listing is None and request.listing_id:
            row = await self.repository.fetch_listing_row_by_id(request.listing_id)
            if row is None:
                raise ValueError("Listing not found.")
            listing = self.repository.row_to_listing(row)
        if listing is None:
            raise ValueError("Listing payload missing.")
        return await self.analyze_listing(
            listing,
            include=request.include,
            local_candidates=[listing],
            ownership_profile=request.ownership_profile,
            use_snapshot=True,
        )
