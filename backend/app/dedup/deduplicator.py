from app.models.vehicle import VehicleListing


def deduplicate_listings(listings: list[VehicleListing]) -> list[VehicleListing]:
    deduped: list[VehicleListing] = []
    seen: set[str] = set()

    for listing in listings:
        key = listing.url or (
            f"{listing.provider}|{listing.title.lower().strip()}|"
            f"{listing.price_amount}|{listing.year or 0}"
        )
        if key in seen:
            continue
        seen.add(key)
        deduped.append(listing)

    return deduped

