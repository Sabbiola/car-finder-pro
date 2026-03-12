import pytest

from app.models.analysis import OwnershipProfile
from app.models.vehicle import VehicleListing
from app.services.analysis_service import AnalysisService


class FakeRepository:
    settings = type("Settings", (), {"analysis_snapshot_ttl_hours": 24})()

    def is_configured(self) -> bool:
        return False

    async def fetch_analysis_snapshot(self, _snapshot_key: str):
        return None

    async def fetch_listing_row_by_id(self, _listing_id: str):
        return None

    async def fetch_listing_row_by_source_url(self, _source_url: str):
        return None

    async def fetch_price_history(self, _listing_id: str, limit: int = 30):
        return []

    async def fetch_comparable_rows(self, **_kwargs):
        return []

    async def fetch_image_reuse_count(self, _listing_hash: str) -> int:
        return 0

    async def fetch_seller_fingerprint_stats(self, **_kwargs):
        return {"listing_count": 0, "private_count": 0, "dealer_count": 0}

    async def upsert_analysis_snapshot(self, **_kwargs):
        return None


def _listing() -> VehicleListing:
    return VehicleListing(
        provider="autoscout24",
        market="IT",
        title="BMW 320d",
        url="https://example.com/bmw-320d",
        price_amount=24500,
        year=2020,
        make="BMW",
        model="320d",
        mileage_value=68000,
        fuel_type="Diesel",
        transmission="Automatico",
        images=["https://images.example.com/1.jpg"],
        description="BMW 320d ben tenuta con tagliandi regolari e pochi proprietari.",
    )


@pytest.mark.asyncio
async def test_analysis_service_produces_all_summaries() -> None:
    service = AnalysisService(repository=FakeRepository())  # type: ignore[arg-type]
    listing = _listing()
    analysis = await service.analyze_listing(
        listing,
        include=["deal", "trust", "negotiation", "ownership"],
        local_candidates=[listing],
        ownership_profile=OwnershipProfile(),
    )

    assert analysis.deal_summary is not None
    assert analysis.trust_summary is not None
    assert analysis.negotiation_summary is not None
    assert analysis.ownership_estimate is not None
    assert analysis.listing_hash


@pytest.mark.asyncio
async def test_analysis_service_enriches_listing_in_place() -> None:
    service = AnalysisService(repository=FakeRepository())  # type: ignore[arg-type]
    listing = _listing()
    await service.enrich_search_results([listing])

    assert listing.deal_summary is not None
    assert listing.trust_summary is not None
    assert listing.negotiation_summary is not None
