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


def _split_blocks(markdown: str) -> list[str]:
    blocks: list[str] = []
    current = ""
    for line in markdown.splitlines():
        if re.match(r"^!\[.*\]\(https://(?:images|static)\.sbito\.it", line):
            if len(current) > 50:
                blocks.append(current)
            current = line
        else:
            current += "\n" + line
    if len(current) > 50:
        blocks.append(current)
    return blocks


def parse_subito_markdown(markdown: str, brand: str | None, model: str | None) -> list[VehicleListing]:
    listings: list[VehicleListing] = []
    dedup: set[str] = set()
    model_pattern = re.compile((model or "").replace(" ", r"\s*"), re.I) if model else None

    for block in _split_blocks(markdown):
        title_match = re.search(r"^###\s*(.+)$", block, re.M)
        if not title_match:
            continue
        title = re.sub(r"\s+", " ", title_match.group(1)).replace("...", "").strip()
        if model_pattern and not model_pattern.search(title):
            continue

        price_match = re.search(r"([\d.]+)\s*€", block, re.I)
        if not price_match:
            continue
        price = parse_price(price_match.group(1))
        if not price:
            continue

        key = f"{title.lower()}|{price}"
        if key in dedup:
            continue
        dedup.add(key)

        source_url = None
        url_match = re.search(
            r"(https://www\.subito\.it/(?:auto|auto-usate)/[^\s)\]\">]+)",
            block,
            re.I,
        )
        if url_match:
            source_url = url_match.group(1).rstrip(')>"')

        image_url = None
        image_match = re.search(
            r"!\[.*?\]\((https://(?:images|static)\.sbito\.it[^\s)]+)\)",
            block,
            re.I,
        )
        if image_match:
            image_url = image_match.group(1)

        year = None
        year_match = re.search(r"\b\d{2}/(20\d{2})\b", block)
        if year_match:
            year = int(year_match.group(1))

        km = None
        km_match = re.search(r"\b(\d{1,3}(?:\.\d{3})*)\s*[Kk][Mm]\b", block)
        if km_match:
            km = parse_km(km_match.group(1))

        location = None
        loc_match = re.search(r"\n([A-Za-zÀ-ÿ]+(?:\s[A-Za-zÀ-ÿ]+)*)\s*\(([A-Z]{2})\)", block)
        if loc_match:
            location = f"{loc_match.group(1)}, {loc_match.group(2)}"

        listings.append(
            VehicleListing(
                provider="subito",
                market="IT",
                url=source_url,
                title=title,
                description=None,
                price_amount=price,
                price_currency="EUR",
                year=year,
                make=brand,
                model=model,
                trim=None,
                mileage_value=km,
                mileage_unit="km",
                fuel_type=detect_fuel(block),
                transmission=detect_transmission(block),
                body_style=detect_body_type(title),
                seller_type="private",
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
