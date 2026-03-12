from app.models.vehicle import VehicleListing


def apply_basic_scoring(listings: list[VehicleListing]) -> list[VehicleListing]:
    if not listings:
        return listings

    prices = [listing.price_amount for listing in listings if listing.price_amount > 0]
    if not prices:
        return listings

    benchmark = sum(prices) / len(prices)

    scored: list[VehicleListing] = []
    for listing in listings:
        item = listing.model_copy(deep=True)
        ratio = item.price_amount / benchmark if benchmark > 0 else 1.0
        score = max(0.0, min(100.0, (1.2 - ratio) * 100))

        reasons: list[str] = []
        if ratio <= 0.85:
            reasons.append("PRICE_SIGNIFICANTLY_BELOW_MARKET")
        elif ratio <= 0.95:
            reasons.append("PRICE_BELOW_MARKET")
        else:
            reasons.append("PRICE_IN_MARKET_RANGE")

        item.deal_score = round(score, 2)
        item.reason_codes = reasons
        scored.append(item)

    return scored

