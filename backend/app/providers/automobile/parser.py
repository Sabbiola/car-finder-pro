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


_MONTH_YEAR_PATTERN = re.compile(
    r"(?:gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)\s+(\d{4})",
    re.I,
)
_EURO_TOKEN = r"(?:\u20ac|EUR|\u00e2\u201a\u00ac|\u00c3\u00a2\u00e2\u20ac\u0161\u00c2\u00ac)"
_EURO_PATTERN = re.compile(
    rf"{_EURO_TOKEN}\s*([\d.]+)|([\d.]+)\s*{_EURO_TOKEN}",
    re.I,
)
_MODEL_FALLBACK_WINDOW = 500


def _extract_price(text: str) -> int | None:
    price_match = _EURO_PATTERN.search(text)
    if not price_match:
        return None
    raw = price_match.group(1) or price_match.group(2) or ""
    return parse_price(raw)


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


def _extract_title(text: str, fallback_brand: str | None, fallback_model: str | None) -> str | None:
    heading_match = re.search(r"^###?\s*([^\n]+)$", text, re.M)
    if heading_match:
        return re.sub(r"\s+", " ", heading_match.group(1)).strip()
    bold_match = re.search(r"\*\*([^*]{5,120})\*\*", text)
    if bold_match:
        return re.sub(r"\s+", " ", bold_match.group(1)).strip()
    if fallback_brand and fallback_model:
        return f"{fallback_brand} {fallback_model}"
    return None


def parse_automobile_markdown(markdown: str, brand: str | None, model: str | None) -> list[VehicleListing]:
    listings: list[VehicleListing] = []
    seen_source_urls: set[str] = set()
    dedup_keys: set[str] = set()

    model_pattern = re.compile((model or "").replace(" ", r"\s*"), re.I) if model else None
    sections = [section for section in re.split(r"(?=\[!\[)", markdown) if len(section) > 40]

    for section in sections:
        if model_pattern and not model_pattern.search(section):
            continue

        source_url_match = re.search(
            r"\[!\[[^\]]*\]\([^)]*\)\]\((https?://[^\s)]*automobile\.it[^\s)]+)\)",
            section,
            re.I,
        )
        source_url = source_url_match.group(1).rstrip(')">') if source_url_match else None
        if source_url and source_url in seen_source_urls:
            continue

        price = _extract_price(section)
        if not price:
            continue

        year = _extract_year(section)
        km = _extract_km(section)
        title = _extract_title(section, brand, model)
        if not title:
            continue

        dedup_key = f"{title.lower()}|{price}|{km or ''}"
        if dedup_key in dedup_keys:
            continue
        dedup_keys.add(dedup_key)
        if source_url:
            seen_source_urls.add(source_url)

        image_match = re.search(r"!\[.*?\]\((https?://[^\s)]+\.(?:jpg|jpeg|png|webp)[^\s)]*)\)", section, re.I)
        image_url = image_match.group(1) if image_match else None

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

    if listings:
        return listings

    if not model_pattern:
        return listings

    url_regex = re.compile(r"https?://(?:www\.)?automobile\.it/annunci/[^\s)\"]{10,}", re.I)
    for match in url_regex.finditer(markdown):
        source_url = match.group(0).rstrip(')">')
        if source_url in seen_source_urls:
            continue
        start = max(0, match.start() - 100)
        end = min(len(markdown), match.start() + _MODEL_FALLBACK_WINDOW)
        context = markdown[start:end]
        if not model_pattern.search(context):
            continue
        price = _extract_price(context)
        if not price:
            continue
        title = _extract_title(context, brand, model)
        if not title:
            continue

        year = _extract_year(context)
        km = _extract_km(context)
        image_match = re.search(r"!\[.*?\]\((https?://[^\s)]+\.(?:jpg|jpeg|png|webp)[^\s)]*)\)", context, re.I)
        image_url = image_match.group(1) if image_match else None

        seen_source_urls.add(source_url)
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
