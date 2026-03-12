from app.models.vehicle import VehicleListing
from app.ranking.scoring import apply_basic_scoring


def test_scoring_assigns_reason_codes() -> None:
    listings = [
        VehicleListing(provider="autoscout24", title="Low", price_amount=10000),
        VehicleListing(provider="autoscout24", title="High", price_amount=20000),
    ]

    scored = apply_basic_scoring(listings)
    assert len(scored) == 2
    assert scored[0].deal_score is not None
    assert scored[0].reason_codes

