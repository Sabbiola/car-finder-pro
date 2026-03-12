from statistics import median

from app.models.vehicle import VehicleListing
from app.ranking.reason_codes import (
    DATA_COMPLETENESS_LOW,
    DATA_COMPLETENESS_MEDIUM,
    DATA_CONSISTENCY_GOOD,
    DATA_CONSISTENCY_WARNING,
    PRICE_ABOVE_MARKET,
    PRICE_BELOW_MARKET,
    PRICE_IN_MARKET_RANGE,
    PRICE_SIGNIFICANTLY_ABOVE_MARKET,
    PRICE_SIGNIFICANTLY_BELOW_MARKET,
)


def _year_range_bucket(year: int | None) -> int:
    if year is None:
        return -1
    return (year // 5) * 5


def _benchmark_key(listing: VehicleListing) -> tuple[str, str, int]:
    return (
        (listing.make or "").strip().lower(),
        (listing.model or "").strip().lower(),
        _year_range_bucket(listing.year),
    )


def _is_consistent(listing: VehicleListing) -> bool:
    if listing.year is not None and (listing.year < 1990 or listing.year > 2100):
        return False
    if listing.mileage_value is not None and (listing.mileage_value < 0 or listing.mileage_value > 600_000):
        return False
    if listing.price_amount < 500 or listing.price_amount > 1_000_000:
        return False
    return True


def _missing_critical_count(listing: VehicleListing) -> int:
    count = 0
    if listing.year is None:
        count += 1
    if listing.mileage_value is None:
        count += 1
    if not listing.images:
        count += 1
    return count


def _append_unique(target: list[str], code: str) -> None:
    if code not in target:
        target.append(code)


def apply_basic_scoring(listings: list[VehicleListing]) -> list[VehicleListing]:
    if not listings:
        return listings

    by_cluster: dict[tuple[str, str, int], list[int]] = {}
    global_prices: list[int] = []
    for listing in listings:
        if listing.price_amount > 0:
            key = _benchmark_key(listing)
            by_cluster.setdefault(key, []).append(listing.price_amount)
            global_prices.append(listing.price_amount)

    global_benchmark = float(median(global_prices)) if global_prices else 1.0

    scored: list[VehicleListing] = []
    for listing in listings:
        item = listing.model_copy(deep=True)
        prices = by_cluster.get(_benchmark_key(item), [])
        cluster_benchmark = float(median(prices)) if prices else global_benchmark
        ratio = item.price_amount / cluster_benchmark if cluster_benchmark > 0 else 1.0

        score = 50.0
        reasons = list(item.reason_codes)

        if ratio <= 0.80:
            score += 30
            _append_unique(reasons, PRICE_SIGNIFICANTLY_BELOW_MARKET)
        elif ratio <= 0.92:
            score += 15
            _append_unique(reasons, PRICE_BELOW_MARKET)
        elif ratio <= 1.08:
            score += 5
            _append_unique(reasons, PRICE_IN_MARKET_RANGE)
        elif ratio <= 1.20:
            score -= 10
            _append_unique(reasons, PRICE_ABOVE_MARKET)
        else:
            score -= 20
            _append_unique(reasons, PRICE_SIGNIFICANTLY_ABOVE_MARKET)

        missing_critical = _missing_critical_count(item)
        if missing_critical >= 2:
            score -= 16
            _append_unique(reasons, DATA_COMPLETENESS_LOW)
        elif missing_critical == 1:
            score -= 8
            _append_unique(reasons, DATA_COMPLETENESS_MEDIUM)

        if _is_consistent(item):
            score += 8
            _append_unique(reasons, DATA_CONSISTENCY_GOOD)
        else:
            score -= 10
            _append_unique(reasons, DATA_CONSISTENCY_WARNING)

        item.deal_score = round(max(0.0, min(100.0, score)), 2)
        item.reason_codes = reasons
        scored.append(item)

    return sorted(scored, key=lambda listing: (listing.deal_score or 0.0, -listing.price_amount), reverse=True)
