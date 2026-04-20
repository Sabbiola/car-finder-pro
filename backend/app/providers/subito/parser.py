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

_HEADING_PATTERN = re.compile(r"^###\s*(.+)$", re.M)
_SUBITO_LISTING_URL_PATTERN = re.compile(r"(https://www\.subito\.it/(?:auto|auto-usate)/[^\s)\]\">]+)", re.I)
_SUBITO_IMAGE_PATTERN = re.compile(r"!\[[^\]]*\]\((https://images\.sbito\.it[^\s)]+)\)", re.I)


def parse_subito_markdown(markdown: str, brand: str | None, model: str | None) -> list[VehicleListing]:
    listings: list[VehicleListing] = []
    dedup: set[str] = set()
    model_pattern = re.compile((model or "").replace(" ", r"\s*"), re.I) if model else None
    heading_matches = list(_HEADING_PATTERN.finditer(markdown))

    for index, heading in enumerate(heading_matches):
        title = re.sub(r"\s+", " ", heading.group(1)).replace("...", "").strip()
        section_start = heading.start()
        section_end = heading_matches[index + 1].start() if index + 1 < len(heading_matches) else len(markdown)
        section = markdown[section_start:section_end]

        if model_pattern and not (model_pattern.search(title) or model_pattern.search(section)):
            continue

        price = extract_euro_price(section)
        if not price:
            continue

        context_window_start = max(0, section_start - 320)
        context_window = markdown[context_window_start:section_end]

        source_url = None
        url_match = _SUBITO_LISTING_URL_PATTERN.search(section) or _SUBITO_LISTING_URL_PATTERN.search(context_window)
        if url_match:
            source_url = url_match.group(1).rstrip(')>"')
        if not source_url:
            slug = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
            source_url = f"https://www.subito.it/auto/{slug}-{abs(hash(title)) % 100000000}.htm"

        image_url = None
        image_match = _SUBITO_IMAGE_PATTERN.search(context_window)
        if image_match:
            image_url = image_match.group(1)

        year = None
        year_match = re.search(r"(?:Usato|Nuovo)?\s*(\d{2}/(20\d{2}))", section, re.I)
        if year_match:
            year = int(year_match.group(2))
        if not year:
            fallback_year_match = re.search(r"\b(20[0-2]\d)\b", section)
            if fallback_year_match:
                year = int(fallback_year_match.group(1))

        km = None
        km_match = re.search(r"\b(\d{1,3}(?:[.\s]\d{3})*)\s*[Kk][Mm]\b", section)
        if km_match:
            km = parse_km(km_match.group(1).replace(" ", "."))

        location = None
        loc_match = re.search(r"\n([A-Za-z\u00c0-\u00ff]+(?:\s[A-Za-z\u00c0-\u00ff]+)*)\s*\(([A-Z]{2})\)", section)
        if loc_match:
            location = f"{loc_match.group(1)}, {loc_match.group(2)}"

        dedup_key = f"{title.lower()}|{price}|{location or ''}"
        if dedup_key in dedup:
            continue
        dedup.add(dedup_key)

        seller_type = "dealer" if re.search(r"\bRivenditore\b", section, re.I) else "private"

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
                fuel_type=detect_fuel(section),
                transmission=detect_transmission(section),
                body_style=detect_body_type(title),
                seller_type=seller_type,
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
