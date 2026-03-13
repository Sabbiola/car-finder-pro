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


_EURO_TOKEN = r"(?:\u20ac|EUR|\u00e2\u201a\u00ac|\u00c3\u00a2\u00e2\u20ac\u0161\u00c2\u00ac)"
_EURO_PATTERN = re.compile(
    rf"{_EURO_TOKEN}\s*([\d.]+)|([\d.]+)\s*{_EURO_TOKEN}",
    re.I,
)


def _extract_price(text: str) -> int | None:
    match = _EURO_PATTERN.search(text)
    if not match:
        return None
    raw = match.group(1) or match.group(2) or ""
    return parse_price(raw)


def parse_brumbrum_markdown(markdown: str, brand: str | None, model: str | None) -> list[VehicleListing]:
    listings: list[VehicleListing] = []
    seen_urls: set[str] = set()

    model_pattern = re.compile((model or "").replace(" ", r"\s*"), re.I) if model else None
    lines = markdown.splitlines()

    for index, line in enumerate(lines):
        link_match = re.search(
            r"\[([^\]]+)\]\((https://www\.brumbrum\.it/(?:auto|usato|catalogo)/[^\s)]+)\)",
            line,
            re.I,
        )
        if not link_match:
            continue

        title = re.sub(r"\s+", " ", link_match.group(1)).strip()
        source_url = link_match.group(2)
        if source_url in seen_urls:
            continue

        context_lines = lines[max(0, index - 5) : min(len(lines), index + 25)]
        context = "\n".join(context_lines)
        if model_pattern and not (model_pattern.search(title) or model_pattern.search(context)):
            continue

        price = _extract_price(context)
        if not price:
            continue

        seen_urls.add(source_url)
        year_match = re.search(r"\b(20\d{2})\b", context)
        year = int(year_match.group(1)) if year_match else None

        km_match = re.search(r"\b(\d{1,3}(?:\.\d{3})*)\s*(?:km|chilometri)\b", context, re.I)
        km = parse_km(km_match.group(1)) if km_match else None

        image_match = re.search(r"!\[[^\]]*\]\((https://[^\s)]*brumbrum[^\s)]*)\)", context, re.I)
        image_url = image_match.group(1) if image_match else None

        listings.append(
            VehicleListing(
                provider="brumbrum",
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
                fuel_type=detect_fuel(context),
                transmission=detect_transmission(context),
                body_style=detect_body_type(title),
                seller_type=None,
                city=None,
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
