import re
from datetime import datetime, timezone

from app.models.vehicle import VehicleListing
from app.providers.common.text_utils import (
    detect_body_type,
    detect_fuel,
    detect_transmission,
    parse_km,
    parse_price,
)

AUTOSCOUT_IMAGE_PATTERN = re.compile(
    r"!\[[^\]]*\]\((https://prod\.pictures\.autoscout24\.net/listing-images/([a-f0-9\-]{36})[^\s)]*)\)",
    re.I,
)


def _extract_brand_model(title: str) -> tuple[str | None, str | None]:
    parts = re.sub(r"\s+", " ", title).strip().split(" ")
    if len(parts) < 2:
        return None, None
    return parts[0], parts[1]


def parse_autoscout_markdown(markdown: str, brand: str | None, model: str | None) -> list[VehicleListing]:
    listings: list[VehicleListing] = []
    seen: set[str] = set()
    brand_prefix = (brand or "").lower()[:5]
    blocks = AUTOSCOUT_IMAGE_PATTERN.split(markdown)

    for i in range(1, len(blocks), 3):
        image_url = blocks[i]
        image_uuid = blocks[i + 1]
        context = blocks[i + 2] if i + 2 < len(blocks) else ""

        if image_uuid in seen:
            continue
        if brand_prefix and brand_prefix not in context.lower():
            continue

        seen.add(image_uuid)
        image_url = re.sub(r"/\d+x\d+(\.\w+)$", r"/800x600\1", image_url)

        # Price appears as "€ 12.345" or "12.345 €".
        price_match = re.search(r"(?:€\s*([\d.]+)|([\d.]+)\s*€)", context, re.I)
        if not price_match:
            continue
        price_raw = price_match.group(1) or price_match.group(2) or ""
        price = parse_price(price_raw)
        if not price:
            continue

        title = ""
        link_title = re.search(r"\[([^\]]{5,120})\]\(https://www\.autoscout24\.it/annunci/", context, re.I)
        if link_title:
            title = link_title.group(1).replace("**", "").strip()
        if not title:
            bold_title = re.search(r"\*\*([^*]{5,120})\*\*", context)
            if bold_title:
                title = bold_title.group(1).strip()
        if not title and brand and model:
            title = f"{brand} {model}"
        if not title:
            continue

        source_match = re.search(r"(https://www\.autoscout24\.it/annunci/[^\s)>\"']+)", context, re.I)
        if source_match:
            source_url = source_match.group(1).rstrip(')>"')
        else:
            slug = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
            source_url = f"https://www.autoscout24.it/annunci/{slug}-{image_uuid}"

        year = None
        date_match = re.search(r"\b\d{1,2}/(20\d{2})\b", context)
        if date_match:
            year = int(date_match.group(1))
        if not year:
            year_match = re.search(r"\b(20[0-2]\d)\b", context)
            if year_match:
                year = int(year_match.group(1))

        km = None
        km_match = re.search(r"([\d.]+)\s*km\b", context, re.I)
        if km_match:
            km = parse_km(km_match.group(1))

        location = None
        loc_match = re.search(r"IT-\d+\s+(.+?)(?:\n|$)", context, re.M)
        if loc_match:
            location = loc_match.group(1).strip()

        found_make, found_model = _extract_brand_model(title)
        listing_make = brand or found_make
        listing_model = model or found_model

        listings.append(
            VehicleListing(
                provider="autoscout24",
                market="IT",
                url=source_url,
                title=title,
                description=None,
                price_amount=price,
                price_currency="EUR",
                year=year,
                make=listing_make,
                model=listing_model,
                trim=None,
                mileage_value=km,
                mileage_unit="km",
                fuel_type=detect_fuel(context),
                transmission=detect_transmission(context),
                body_style=detect_body_type(title),
                seller_type=None,
                city=location,
                region=None,
                country="IT",
                posted_at=None,
                images=[image_url] if image_url else [],
                raw_payload=None,
                reason_codes=[],
                scraped_at=datetime.now(timezone.utc),
            )
        )

    return listings
