from __future__ import annotations

import re

from app.core.observability import log_event
from app.models.vehicle import VehicleListing


def _is_autoscout_listing_url(url: str | None) -> bool:
    if not url:
        return False
    normalized = url.lower()
    return "autoscout24." in normalized and "/annunci/" in normalized


def _is_automobile_listing_url(url: str | None) -> bool:
    if not url:
        return False
    normalized = url.lower()
    if "automobile.it" not in normalized:
        return False
    return bool(re.search(r"/\d{6,}$", url.rstrip("/")))


def needs_autoscout_enrichment(listing: VehicleListing) -> bool:
    return any(
        [
            not listing.description,
            not listing.power,
            not listing.doors,
            not listing.emission_class,
            not listing.seller_type,
            len(listing.images) <= 1,
        ]
    )


def needs_automobile_enrichment(listing: VehicleListing) -> bool:
    return any(
        [
            not listing.description,
            not listing.transmission,
            not listing.color,
            not listing.doors,
        ]
    )


def merge_enriched_listing(base: VehicleListing, enriched: VehicleListing) -> VehicleListing:
    """Return a copy of *base* with missing fields filled in from *enriched*.

    Scalar fields: keep existing value when already set; fall back to enriched.
    Description: always prefer the longer text (detail page carries the full version).
    Images: prefer the larger set.
    raw_payload: use enriched when base has none.
    """
    merged = base.model_copy(deep=True)
    for field in (
        "power",
        "doors",
        "seats",
        "emission_class",
        "condition",
        "color",
        "seller_type",
        "seller_name",
        "seller_url",
        "fuel_type",
        "transmission",
        "body_style",
        "city",
    ):
        if getattr(merged, field) in (None, "", 0):
            setattr(merged, field, getattr(enriched, field))

    if enriched.description and (
        not merged.description or len(enriched.description) > len(merged.description)
    ):
        merged.description = enriched.description

    if not merged.make:
        merged.make = enriched.make
    if not merged.model:
        merged.model = enriched.model
    if not merged.year:
        merged.year = enriched.year
    if not merged.mileage_value:
        merged.mileage_value = enriched.mileage_value
    if not merged.url:
        merged.url = enriched.url
    if len(merged.images) <= 1 and len(enriched.images) > len(merged.images):
        merged.images = enriched.images
    if enriched.raw_payload and not merged.raw_payload:
        merged.raw_payload = enriched.raw_payload
    return merged


def filter_similar_listings(
    base: VehicleListing,
    candidates: list[VehicleListing],
    *,
    max_results: int = 6,
    price_tolerance: float = 0.20,
    year_tolerance: int = 2,
) -> list[VehicleListing]:
    """Return up to *max_results* listings that are genuinely similar to *base*.

    Priority: same fuel + year within ±2 + price within ±20%.
    Falls back to price-only filter if not enough matches.
    """
    base_price = base.price_amount
    base_year = base.year
    base_fuel = (base.fuel_type or "").lower().strip()

    def score(item: VehicleListing) -> int:
        if item.id == base.id:
            return -1
        s = 0
        if base_fuel and (item.fuel_type or "").lower().strip() == base_fuel:
            s += 2
        if base_year and item.year and abs(item.year - base_year) <= year_tolerance:
            s += 2
        if base_price and item.price_amount:
            diff = abs(item.price_amount - base_price) / base_price
            if diff <= price_tolerance:
                s += 1
        return s

    scored = [(item, score(item)) for item in candidates]
    scored = [(item, s) for item, s in scored if s >= 0]
    scored.sort(key=lambda pair: pair[1], reverse=True)

    result = [item for item, s in scored if s >= 3][:max_results]
    if len(result) < max_results:
        fallback = [item for item, s in scored if s >= 1 and item not in result]
        result += fallback[: max_results - len(result)]
    if len(result) < max_results:
        remainder = [item for item, _s in scored if item.id != base.id and item not in result]
        result += remainder[: max_results - len(result)]
    return result[:max_results]


async def try_fetch_autoscout_detail(source_url: str) -> VehicleListing | None:
    from app.providers.autoscout24.parser import parse_autoscout_detail_markdown
    from app.providers.common.scrapingbee import fetch_markdown

    try:
        markdown = await fetch_markdown(source_url, wait_ms=6000, premium_proxy=True)
    except Exception as exc:  # noqa: BLE001
        log_event("listing_detail_autoscout_fetch_failed", source_url=source_url, error=str(exc))
        return None
    return parse_autoscout_detail_markdown(markdown, source_url=source_url)


async def try_fetch_automobile_detail(source_url: str) -> VehicleListing | None:
    from app.providers.automobile.provider import AutomobileProvider

    provider = AutomobileProvider()
    try:
        result = await provider.fetch_detail(source_url)
    except Exception as exc:  # noqa: BLE001
        log_event("listing_detail_automobile_fetch_failed", source_url=source_url, error=str(exc))
        return None
    return result
