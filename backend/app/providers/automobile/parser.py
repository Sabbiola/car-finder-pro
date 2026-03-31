import re
from datetime import datetime, timezone

from app.models.vehicle import VehicleListing
from app.providers.common.text_utils import (
    detect_body_type,
    detect_fuel,
    detect_transmission,
    extract_euro_price,
    parse_km,
)

_MONTH_YEAR_PATTERN = re.compile(
    r"(?:gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)\s+(\d{4})",
    re.I,
)
_RELATIVE_SOURCE_URL_PATTERN = re.compile(r"\]\((/[^\s)]+)\s+\"[^\"]+\"\)")
_IMAGE_PATTERN = re.compile(r"!\[[^\]]*\]\((https?://[^\s)]+\.(?:jpg|jpeg|png|webp)[^\s)]*)\)", re.I)
_TITLE_PATTERN = re.compile(r"^\[!\[([^\]]{5,180})\]\(", re.M)
_HEADING_TITLE_PATTERN = re.compile(r"^###\s+(.+)$", re.M)


def _extract_price(text: str) -> int | None:
    return extract_euro_price(text)


def _extract_year(text: str) -> int | None:
    month_match = _MONTH_YEAR_PATTERN.search(text)
    if month_match:
        return int(month_match.group(1))
    year_match = re.search(r"\b(20[0-2]\d)\b", text)
    if year_match:
        return int(year_match.group(1))
    return None


def _extract_km(text: str) -> int | None:
    km_match = re.search(r"\b(\d{1,3}(?:\.\d{3})*)\s*km\b", text, re.I)
    if not km_match:
        return None
    return parse_km(km_match.group(1))


def parse_automobile_markdown(markdown: str, brand: str | None, model: str | None) -> list[VehicleListing]:
    listings: list[VehicleListing] = []
    seen_source_urls: set[str] = set()
    dedup_keys: set[str] = set()

    model_pattern = re.compile((model or "").replace(" ", r"\s*"), re.I) if model else None
    sections = [section for section in re.split(r"(?=\[!\[)", markdown) if len(section) > 40]

    for section in sections:
        title_match = _TITLE_PATTERN.search(section)
        if title_match:
            title = re.sub(r"\s+", " ", title_match.group(1)).strip()
        else:
            heading_match = _HEADING_TITLE_PATTERN.search(section)
            if not heading_match:
                continue
            title = re.sub(r"\s+", " ", heading_match.group(1)).strip()

        if model_pattern and not (model_pattern.search(title) or model_pattern.search(section)):
            continue

        price = _extract_price(section)
        if not price:
            continue

        source_url = None
        source_match = _RELATIVE_SOURCE_URL_PATTERN.search(section)
        if source_match:
            source_url = f"https://www.automobile.it{source_match.group(1)}"
        if source_url and source_url in seen_source_urls:
            continue

        year = _extract_year(section)
        km = _extract_km(section)

        dedup_key = f"{title.lower()}|{price}|{km or ''}"
        if dedup_key in dedup_keys:
            continue
        dedup_keys.add(dedup_key)
        if source_url:
            seen_source_urls.add(source_url)

        image_match = _IMAGE_PATTERN.search(section)
        image_url = image_match.group(1) if image_match else None

        seller_type = "dealer" if re.search(r"\bRivenditore\b", section, re.I) else None

        listings.append(
            VehicleListing(
                provider="automobile",
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
                fuel_type=detect_fuel(section),
                transmission=detect_transmission(section),
                body_style=detect_body_type(title),
                seller_type=seller_type,
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
