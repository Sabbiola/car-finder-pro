from app.models.vehicle import VehicleListing
from app.ranking.reason_codes import (
    DATA_COMPLETENESS_LOW,
    DATA_CONSISTENCY_WARNING,
    PRICE_SIGNIFICANTLY_ABOVE_MARKET,
    PRICE_SIGNIFICANTLY_BELOW_MARKET,
)
from app.ranking.scoring import apply_basic_scoring


def _listing(title: str, price: int) -> VehicleListing:
    return VehicleListing(
        provider="autoscout24",
        market="IT",
        title=title,
        price_amount=price,
        year=2020,
        make="BMW",
        model="320d",
        mileage_value=60000,
        images=["https://images.example.com/a.jpg"],
    )


def test_scoring_assigns_market_reason_codes() -> None:
    listings = [
        _listing("Low", 10000),
        _listing("Median", 15000),
        _listing("High", 30000),
    ]

    scored = {item.title: item for item in apply_basic_scoring(listings)}
    assert PRICE_SIGNIFICANTLY_BELOW_MARKET in scored["Low"].reason_codes
    assert PRICE_SIGNIFICANTLY_ABOVE_MARKET in scored["High"].reason_codes
    assert (scored["Low"].deal_score or 0) > (scored["High"].deal_score or 0)


def test_scoring_penalizes_missing_critical_data_and_inconsistency() -> None:
    listing = VehicleListing(
        provider="subito",
        market="IT",
        title="Broken listing",
        price_amount=12000,
        year=None,
        make="BMW",
        model="320d",
        mileage_value=900000,
        images=[],
    )
    scored = apply_basic_scoring([listing])[0]
    assert DATA_COMPLETENESS_LOW in scored.reason_codes
    assert DATA_CONSISTENCY_WARNING in scored.reason_codes
