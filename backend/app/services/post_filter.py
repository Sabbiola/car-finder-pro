"""Post-search filter predicates applied after providers return results.

These filters cannot be expressed as provider-level query params (e.g. seller type,
condition, colour, emission class) and are therefore applied in-process.
"""

from __future__ import annotations

import re
from datetime import date

from app.models.search import SearchRequest
from app.models.vehicle import VehicleListing
from app.providers.common.text_utils import parse_power_cv


def _normalize_emission_class(value: str | None) -> str:
    return (value or "").strip().lower().replace(" ", "")


def _normalize_trim_token(value: str | None) -> str:
    return re.sub(r"[^a-z0-9]+", "", (value or "").strip().lower())


def _listing_is_new(listing: VehicleListing) -> bool | None:
    if listing.is_new is not None:
        return listing.is_new
    condition = (listing.condition or "").strip().lower()
    if condition in {"new", "nuovo", "nuova"}:
        return True
    if condition in {"used", "usato", "usata"}:
        return False
    return None


def passes_post_filters(listing: VehicleListing, request: SearchRequest) -> bool:
    """Return True if *listing* satisfies all backend-side post-filters in *request*."""
    requested_seller_type = request.normalized_seller_type
    if requested_seller_type != "all":
        listing_seller_type = (listing.seller_type or "").strip().lower()
        if listing_seller_type != requested_seller_type:
            return False

    if request.is_new is not None:
        listing_is_new = _listing_is_new(listing)
        if listing_is_new is None or listing_is_new != request.is_new:
            return False

    if request.color:
        listing_color = (listing.color or "").strip().lower()
        if listing_color != request.color.strip().lower():
            return False

    if request.doors is not None:
        if listing.doors is None or listing.doors != request.doors:
            return False

    if request.emission_class:
        if _normalize_emission_class(listing.emission_class) != _normalize_emission_class(request.emission_class):
            return False

    if request.private_only and (listing.seller_type or "").strip().lower() != "private":
        return False

    if request.transmission:
        if (listing.transmission or "").strip().lower() != request.transmission.strip().lower():
            return False

    if request.mileage_min is not None:
        if listing.mileage_value is None or listing.mileage_value < request.mileage_min:
            return False

    if request.trim:
        listing_trim_context = " ".join([listing.trim or "", listing.title or ""]).strip().lower()
        requested_trim = request.trim.strip().lower()
        if requested_trim not in listing_trim_context:
            requested_normalized = _normalize_trim_token(requested_trim)
            context_normalized = _normalize_trim_token(listing_trim_context)
            if not requested_normalized or requested_normalized not in context_normalized:
                return False

    if request.power_min_cv is not None or request.power_max_cv is not None:
        listing_cv = parse_power_cv(listing.power)
        if listing_cv is None:
            # Allow listings with no power data through when only one bound is set;
            # filter them out when both bounds are explicitly set (user wants precision).
            if request.power_min_cv is not None and request.power_max_cv is not None:
                return False
        else:
            if request.power_min_cv is not None and listing_cv < request.power_min_cv:
                return False
            if request.power_max_cv is not None and listing_cv > request.power_max_cv:
                return False

    if request.max_km_per_year is not None and listing.mileage_value is not None and listing.year:
        current_year = date.today().year
        age_years = max(1, current_year - listing.year)
        km_per_year = listing.mileage_value / age_years
        if km_per_year > request.max_km_per_year:
            return False

    return True


def apply_post_filters(
    listings: list[VehicleListing], request: SearchRequest
) -> list[VehicleListing]:
    if not listings:
        return listings
    return [item for item in listings if passes_post_filters(item, request)]
