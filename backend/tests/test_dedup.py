from app.dedup.deduplicator import deduplicate_listings
from app.models.vehicle import VehicleListing


def test_deduplicate_by_url_keeps_single_item() -> None:
    listings = [
        VehicleListing(provider="autoscout24", title="A", price_amount=10000, url="https://x/1"),
        VehicleListing(provider="subito", title="B", price_amount=10000, url="https://x/1"),
    ]
    deduped = deduplicate_listings(listings)
    assert len(deduped) == 1

