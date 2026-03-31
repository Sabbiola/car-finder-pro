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
_DISCOVER_LINK_PATTERN = re.compile(r"\[Scopri di (?:pi\u00f9|pi\u00c3\u00b9)\]\((/auto/usata/[^\s)]+)\)", re.I)
_LEGACY_LISTING_LINK_PATTERN = re.compile(
    r"\[([^\]]{5,180})\]\((https://www\.brumbrum\.it/(?:auto/usata|usato)/[^\s)]+)\)",
    re.I,
)
_IMAGE_PATTERN = re.compile(
    r"!\[([^\]]+)\]\((https://files\.brumbrum\.it[^\s)]+)(?:\s+\"[^\"]+\")?\)",
    re.I,
)
_KM_YEAR_PATTERN = re.compile(r"(\d{1,3}(?:[.\s]\d{3})*)\s*km\s*-\s*(20\d{2})", re.I)


def _normalize_title(raw: str) -> str:
    title = re.sub(r"\s+", " ", raw).strip()
    title = title.replace("  ", " ")
    return title


def _extract_primary_price(context: str) -> int | None:
    # Ignore monthly financing section to avoid picking installment prices.
    base_context = re.split(r"oppure tua", context, maxsplit=1, flags=re.I)[0]
    for match in _EURO_PATTERN.finditer(base_context):
        raw = match.group(1) or match.group(2) or ""
        price = parse_price(raw)
        if price:
            return price
    return None


def _extract_image(context: str) -> str | None:
    images = [m.group(2) for m in _IMAGE_PATTERN.finditer(context)]
    return images[-1] if images else None


def _extract_title(context: str, fallback: str | None = None) -> str | None:
    image_titles = [
        _normalize_title(match.group(1))
        for match in _IMAGE_PATTERN.finditer(context)
        if match.group(1).strip() and "404" not in match.group(1)
    ]
    if image_titles:
        return image_titles[-1]

    if fallback:
        normalized = _normalize_title(fallback)
        if len(normalized) >= 5:
            return normalized

    lines = [line.strip() for line in context.splitlines() if line.strip()]
    filtered = [
        line
        for line in lines
        if not line.startswith("!")
        and not line.startswith("[")
        and "oppure tua" not in line.lower()
        and "scopri di" not in line.lower()
        and "rate" not in line.lower()
        and "tan fisso" not in line.lower()
        and "taeg" not in line.lower()
        and "prezzo di mercato" not in line.lower()
        and not re.fullmatch(rf"{_EURO_TOKEN}\s*[\d.]+", line, re.I)
    ]
    if len(filtered) >= 2:
        composite = _normalize_title(f"{filtered[-2]} {filtered[-1]}")
        if 8 <= len(composite) <= 180:
            return composite
    for line in reversed(filtered):
        normalized = _normalize_title(line)
        if len(normalized) >= 5 and len(normalized) <= 180:
            return normalized
    return None


def _append_listing(
    listings: list[VehicleListing],
    seen_urls: set[str],
    *,
    source_url: str,
    title: str,
    context: str,
    price: int,
    brand: str | None,
    model: str | None,
) -> None:
    if source_url in seen_urls:
        return
    seen_urls.add(source_url)

    km = None
    year = None
    km_year_match = _KM_YEAR_PATTERN.search(context)
    if km_year_match:
        km = parse_km(km_year_match.group(1).replace(" ", "."))
        year = int(km_year_match.group(2))
    else:
        km_match = re.search(r"(\d{1,3}(?:[.\s]\d{3})*)\s*km\b", context, re.I)
        if km_match:
            km = parse_km(km_match.group(1).replace(" ", "."))
        year_match = re.search(r"\b(20[0-2]\d)\b", context)
        if year_match:
            year = int(year_match.group(1))

    image_url = _extract_image(context)
    clean_title = _normalize_title(title)

    listings.append(
        VehicleListing(
            provider="brumbrum",
            market="IT",
            url=source_url,
            title=clean_title,
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
            body_style=detect_body_type(clean_title),
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


def parse_brumbrum_markdown(markdown: str, brand: str | None, model: str | None) -> list[VehicleListing]:
    listings: list[VehicleListing] = []
    seen_urls: set[str] = set()
    model_pattern = re.compile((model or "").replace(" ", r"\s*"), re.I) if model else None

    for match in _DISCOVER_LINK_PATTERN.finditer(markdown):
        relative_url = match.group(1)
        if not re.search(r"/[A-Z]{2}\d{5,}$", relative_url):
            continue

        start = max(0, match.start() - 900)
        context = markdown[start:match.end()]
        if model_pattern and not model_pattern.search(context):
            continue

        tail_context = context[-500:]
        price = _extract_primary_price(tail_context)
        if not price:
            continue

        title = _extract_title(tail_context)
        if not title:
            continue

        _append_listing(
            listings,
            seen_urls,
            source_url=f"https://www.brumbrum.it{relative_url}",
            title=title,
            context=tail_context,
            price=price,
            brand=brand,
            model=model,
        )

    for match in _LEGACY_LISTING_LINK_PATTERN.finditer(markdown):
        title = match.group(1)
        source_url = match.group(2)

        start = max(0, match.start() - 350)
        end = min(len(markdown), match.end() + 350)
        context = markdown[start:end]
        if model_pattern and not (model_pattern.search(title) or model_pattern.search(context)):
            continue

        price = _extract_primary_price(context)
        if not price:
            continue

        extracted_title = _extract_title(context, fallback=title)
        if not extracted_title:
            continue

        _append_listing(
            listings,
            seen_urls,
            source_url=source_url,
            title=extracted_title,
            context=context,
            price=price,
            brand=brand,
            model=model,
        )

    return listings
