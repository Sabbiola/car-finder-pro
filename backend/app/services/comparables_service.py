from __future__ import annotations

from statistics import median
from typing import Any

from app.models.analysis import ConfidenceLevel
from app.models.vehicle import VehicleListing
from app.services.supabase_market_repository import SupabaseMarketRepository


class ComparablesService:
    def __init__(self, repository: SupabaseMarketRepository) -> None:
        self.repository = repository

    @staticmethod
    def _same_model(left: VehicleListing, right: VehicleListing) -> bool:
        return (left.make or "").strip().lower() == (right.make or "").strip().lower() and (
            (left.model or "").strip().lower() == (right.model or "").strip().lower()
        )

    @staticmethod
    def _within(value: int | None, target: int | None, distance: int) -> bool:
        if value is None or target is None:
            return False
        return abs(value - target) <= distance

    @staticmethod
    def _confidence(count: int) -> ConfidenceLevel:
        if count >= 15:
            return "high"
        if count >= 8:
            return "medium"
        if count >= 3:
            return "low"
        return "insufficient"

    def _local_prices(self, listing: VehicleListing, candidates: list[VehicleListing]) -> list[int]:
        prices: list[int] = []
        for candidate in candidates:
            if candidate is listing:
                continue
            if not self._same_model(listing, candidate):
                continue
            if not self._within(candidate.year, listing.year, 1):
                continue
            if not self._within(candidate.mileage_value, listing.mileage_value, 25_000):
                continue
            if candidate.price_amount > 0:
                prices.append(candidate.price_amount)
        return prices

    async def build_metrics(
        self,
        listing: VehicleListing,
        *,
        local_candidates: list[VehicleListing],
    ) -> dict[str, Any]:
        local_prices = self._local_prices(listing, local_candidates)
        if len(local_prices) >= 3:
            benchmark = int(median(local_prices))
            return {
                "benchmark_price": benchmark,
                "comparable_count": len(local_prices),
                "confidence": self._confidence(len(local_prices)),
            }

        remote_rows: list[dict[str, Any]] = []
        if self.repository.is_configured() and listing.make and listing.model:
            remote_rows = await self.repository.fetch_comparable_rows(
                brand=listing.make,
                model=listing.model,
                year_min=listing.year - 1 if listing.year is not None else None,
                year_max=listing.year + 1 if listing.year is not None else None,
                km_min=max(0, listing.mileage_value - 25_000) if listing.mileage_value is not None else None,
                km_max=listing.mileage_value + 25_000 if listing.mileage_value is not None else None,
                limit=30,
            )
            if len(remote_rows) < 3:
                remote_rows = await self.repository.fetch_comparable_rows(
                    brand=listing.make,
                    model=listing.model,
                    year_min=listing.year - 2 if listing.year is not None else None,
                    year_max=listing.year + 2 if listing.year is not None else None,
                    km_min=max(0, listing.mileage_value - 50_000) if listing.mileage_value is not None else None,
                    km_max=listing.mileage_value + 50_000 if listing.mileage_value is not None else None,
                    limit=50,
                )

        remote_prices = [int(row.get("price") or 0) for row in remote_rows if int(row.get("price") or 0) > 0]
        combined = [*local_prices, *remote_prices]
        benchmark = int(median(combined)) if combined else listing.price_amount
        return {
            "benchmark_price": benchmark,
            "comparable_count": len(combined),
            "confidence": self._confidence(len(combined)),
        }
