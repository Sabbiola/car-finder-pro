from app.models.vehicle import VehicleListing


def normalize_listing(listing: VehicleListing, provider_id: str) -> VehicleListing:
    normalized = listing.model_copy(deep=True)
    normalized.provider = provider_id
    if normalized.country is None:
        normalized.country = "IT"
    if normalized.market is None:
        normalized.market = "IT"
    return normalized

