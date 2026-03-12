from datetime import datetime, timedelta, timezone

from app.dedup.deduplicator import deduplicate_listings
from app.models.vehicle import VehicleListing
from app.ranking.reason_codes import DUPLICATE_CLUSTER_MERGED


def test_deduplicate_by_url_uses_deterministic_merge_policy() -> None:
    older = datetime.now(timezone.utc) - timedelta(days=2)
    newer = datetime.now(timezone.utc) - timedelta(days=1)

    listings = [
        VehicleListing(
            provider="autoscout24",
            title="BMW 320d",
            price_amount=20000,
            url="https://x/1",
            year=2020,
            make="BMW",
            model="320d",
            images=["https://img/1.jpg"],
            scraped_at=older,
        ),
        VehicleListing(
            provider="subito",
            title="BMW 320d",
            price_amount=20000,
            url="https://x/1",
            year=2020,
            make="BMW",
            model="320d",
            mileage_value=65000,
            city="Milano",
            images=["https://img/2.jpg"],
            scraped_at=newer,
        ),
    ]

    deduped = deduplicate_listings(listings)
    assert len(deduped) == 1
    assert deduped[0].url == "https://x/1"
    assert deduped[0].mileage_value == 65000
    assert set(deduped[0].images) == {"https://img/1.jpg", "https://img/2.jpg"}
    assert DUPLICATE_CLUSTER_MERGED in deduped[0].reason_codes


def test_deduplicate_fuzzy_cluster_merges_cross_provider_without_url() -> None:
    listings = [
        VehicleListing(
            provider="autoscout24",
            title="BMW 320d",
            price_amount=21000,
            make="BMW",
            model="320d",
            year=2020,
            mileage_value=70000,
            city="Milano",
        ),
        VehicleListing(
            provider="subito",
            title="BMW 320d Sport",
            price_amount=21900,
            make="BMW",
            model="320d",
            year=2021,
            mileage_value=71000,
            city="Milano",
        ),
    ]

    deduped = deduplicate_listings(listings)
    assert len(deduped) == 1
    assert DUPLICATE_CLUSTER_MERGED in deduped[0].reason_codes


def test_deduplicate_fuzzy_cluster_keeps_distinct_cities_separate() -> None:
    listings = [
        VehicleListing(
            provider="autoscout24",
            title="BMW 320d",
            price_amount=21000,
            make="BMW",
            model="320d",
            year=2020,
            mileage_value=70000,
            city="Milano",
        ),
        VehicleListing(
            provider="subito",
            title="BMW 320d",
            price_amount=21200,
            make="BMW",
            model="320d",
            year=2020,
            mileage_value=70500,
            city="Roma",
        ),
    ]

    deduped = deduplicate_listings(listings)
    assert len(deduped) == 2
