from datetime import datetime, timezone
import re

from app.models.vehicle import VehicleListing
from app.ranking.reason_codes import DUPLICATE_CLUSTER_MERGED


def _safe_lower(value: str | None) -> str:
    if not value:
        return ""
    compact = re.sub(r"[^a-z0-9]+", "", value.lower())
    return compact


def _bucket(value: int | None, size: int) -> int:
    if value is None or value < 0:
        return -1
    return value // size


def _fuzzy_key(listing: VehicleListing) -> str:
    return "|".join(
        [
            _safe_lower(listing.make),
            _safe_lower(listing.model),
            str(_bucket(listing.year, 2)),
            str(_bucket(listing.price_amount, 2000)),
            str(_bucket(listing.mileage_value, 25000)),
            _safe_lower(listing.city),
        ]
    )


def _to_datetime(value: datetime | None) -> datetime:
    if value is None:
        return datetime.fromtimestamp(0, tz=timezone.utc)
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


def _completeness_score(listing: VehicleListing) -> int:
    fields = [
        listing.year,
        listing.mileage_value,
        listing.make,
        listing.model,
        listing.city,
        listing.fuel_type,
        listing.transmission,
        listing.body_style,
    ]
    base = sum(1 for field in fields if field not in (None, ""))
    if listing.images:
        base += 1
    if listing.url:
        base += 1
    return base


def _merge_cluster(cluster: list[VehicleListing]) -> VehicleListing:
    # Deterministic winner policy: has URL > richer data > freshest scrape timestamp.
    winner = sorted(
        cluster,
        key=lambda item: (
            1 if item.url else 0,
            _completeness_score(item),
            _to_datetime(item.scraped_at),
        ),
        reverse=True,
    )[0]
    merged = winner.model_copy(deep=True)

    all_images: list[str] = []
    for listing in cluster:
        all_images.extend(listing.images)
    merged.images = list(dict.fromkeys(all_images))

    for listing in cluster:
        if not merged.description and listing.description:
            merged.description = listing.description
        if merged.year is None and listing.year is not None:
            merged.year = listing.year
        if merged.mileage_value is None and listing.mileage_value is not None:
            merged.mileage_value = listing.mileage_value
        if not merged.city and listing.city:
            merged.city = listing.city
        if not merged.region and listing.region:
            merged.region = listing.region
        if not merged.country and listing.country:
            merged.country = listing.country

    if len(cluster) > 1 and DUPLICATE_CLUSTER_MERGED not in merged.reason_codes:
        merged.reason_codes.append(DUPLICATE_CLUSTER_MERGED)
    return merged


def deduplicate_listings(listings: list[VehicleListing]) -> list[VehicleListing]:
    if not listings:
        return []

    by_url: dict[str, list[VehicleListing]] = {}
    without_url: list[VehicleListing] = []
    for listing in listings:
        if listing.url:
            by_url.setdefault(listing.url, []).append(listing)
        else:
            without_url.append(listing)

    url_merged = [_merge_cluster(cluster) for cluster in by_url.values()]
    candidates = url_merged + without_url

    by_fuzzy: dict[str, list[VehicleListing]] = {}
    for listing in candidates:
        by_fuzzy.setdefault(_fuzzy_key(listing), []).append(listing)

    return [_merge_cluster(cluster) for cluster in by_fuzzy.values()]
