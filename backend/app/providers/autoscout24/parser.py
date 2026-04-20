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

AUTOSCOUT_IMAGE_PATTERN = re.compile(
    r"!\[[^\]]*\]\((https://prod\.pictures\.autoscout24\.net/listing-images/([a-f0-9\-]{36})[^\s)]*)\)",
    re.I,
)
AUTOSCOUT_IMAGE_URL_PATTERN = re.compile(
    r"(https://prod\.pictures\.autoscout24\.net/listing-images/[^\s)\"']+)",
    re.I,
)


def _first_non_empty(*values: str | None) -> str | None:
    for value in values:
        if value and value.strip():
            return value.strip()
    return None

def _extract_brand_model(title: str) -> tuple[str | None, str | None]:
    parts = re.sub(r"\s+", " ", title).strip().split(" ")
    if len(parts) < 2:
        return None, None
    return parts[0], parts[1]


def _extract_heading_from_pre_context(pre_context: str) -> str | None:
    lines = [line.strip() for line in pre_context.splitlines() if line.strip()]
    if not lines:
        return None
    ignored = {"salva", "confronta"}
    for candidate in reversed(lines):
        low = candidate.lower()
        if low in ignored:
            continue
        if re.fullmatch(r"[-=]{3,}", candidate):
            continue
        if candidate.startswith("[+") or candidate.startswith("http"):
            continue
        if re.search(r"\d", candidate) and len(candidate) < 5:
            continue
        if len(candidate) < 5 or len(candidate) > 140:
            continue
        return candidate
    return None

def _looks_like_noise_heading(value: str | None) -> bool:
    if not value:
        return True
    text = value.strip().lower()
    if not text:
        return True
    if re.fullmatch(r"[\d.\s]+km", text):
        return True
    if re.fullmatch(r"€?\s*[\d.\s]+", text):
        return True
    if re.fullmatch(r"\d{1,2}/\d{4}", text):
        return True
    return False


def _extract_power(text: str) -> str | None:
    cv_match = re.search(r"\b(\d{2,4})\s*cv\b", text, re.I)
    if cv_match:
        return f"{cv_match.group(1)} CV"

    kw_match = re.search(r"\b(\d{2,3})\s*kW\b", text, re.I)
    if not kw_match:
        return None
    kw = int(kw_match.group(1))
    cv = round(kw * 1.35962)
    return f"{cv} CV"


def _extract_doors(text: str) -> int | None:
    doors_match = re.search(r"\b([2-7])\s*porte?\b", text, re.I)
    if doors_match:
        return int(doors_match.group(1))
    return None


def _extract_seats(text: str) -> int | None:
    seats_match = re.search(r"\bposti?\s*[:\-]?\s*([2-9])\b", text, re.I)
    if seats_match:
        return int(seats_match.group(1))
    return None


def _extract_emission_class(text: str) -> str | None:
    match = re.search(r"\bclasse emissioni\s*(euro\s*\d[a-zA-Z\-]*)", text, re.I)
    if match:
        raw = match.group(1).strip()
        # Normalise "euro" prefix to "Euro" but keep sub-class suffix as-is (6e, 6d, 6d-TEMP)
        return re.sub(r"(?i)^euro\s*", "Euro ", raw).replace("  ", " ")
    match = re.search(r"\b(euro\s*\d[a-zA-Z\-]*)\b", text, re.I)
    if match:
        raw = match.group(1).strip()
        return re.sub(r"(?i)^euro\s*", "Euro ", raw).replace("  ", " ")
    return None


def _extract_seller_type(text: str) -> str | None:
    if re.search(r"\brivenditore\b|\bdealer\b|\bconcessionari[ao]\b", text, re.I):
        return "dealer"
    if re.search(r"\bprivato\b", text, re.I):
        return "private"
    return None


def _extract_condition(text: str) -> str | None:
    if re.search(r"\bnuov[oa]\b", text, re.I):
        return "new"
    if re.search(r"\busat[oa]\b", text, re.I):
        return "used"
    return None


def _extract_color(text: str) -> str | None:
    # Prefer "Colore specifico" (AutoScout detail pages) over generic "Colore"
    specific = re.search(r"\bcolore specifico\s*[:\-]?\s*(?:\n\s*)?([^\n\r]{2,40})", text, re.I)
    if specific:
        val = re.sub(r"\s+", " ", specific.group(1)).strip()
        if val and val.lower() not in ("e interni",):
            return val
    # Fallback: generic "Colore" but skip section headers like "## Colore e interni"
    match = re.search(r"(?<!#\s)(?<!##\s)\bcolore\s*[:\-]\s*([^\n\r]{2,40})", text, re.I)
    if match:
        val = re.sub(r"\s+", " ", match.group(1)).strip()
        if val and val.lower() not in ("e interni", "interni"):
            return val
    return None


def _extract_seller_name(text: str) -> str | None:
    """Extract seller/dealer name from the Venditore section."""
    # Pattern: ## Venditore\n\nRivenditore\n\n<Seller Name>
    match = re.search(
        r"##\s*Venditore\s*\n+\s*(?:Rivenditore|Privato)\s*\n+\s*([^\n#]{3,80})",
        text,
        re.I,
    )
    if match:
        name = match.group(1).strip()
        if name and not name.startswith("*") and not name.startswith("["):
            return name
    # Fallback: "Contatta venditore" followed by dealer name
    match = re.search(r"Contatta venditore.*?\n+\s*([A-Z][^\n]{2,80})\s*\n", text)
    if match:
        name = match.group(1).strip()
        if not name.startswith("http") and not name.startswith("["):
            return name
    return None


def _extract_seller_url(text: str) -> str | None:
    """Extract seller profile URL from the markdown."""
    match = re.search(r"\[Pagina del rivenditore\]\((https://[^\s)]+)\)", text, re.I)
    if match:
        return match.group(1).split("#")[0]
    match = re.search(r"(https://www\.autoscout24\.\w+/concessionari/[^\s)\"'#]+)", text, re.I)
    if match:
        return match.group(1)
    return None


def _extract_description(text: str) -> str | None:
    marker = re.search(r"##\s*Descrizione del veicolo\s*(.+?)(?:\n##\s+|\Z)", text, re.I | re.S)
    if not marker:
        return None
    block = marker.group(1)
    clean_lines = [re.sub(r"\s+", " ", line).strip() for line in block.splitlines()]
    cleaned = [line for line in clean_lines if line and not line.startswith("* * *")]
    if not cleaned:
        return None
    description = "\n".join(cleaned[:20]).strip()
    return description if len(description) >= 10 else None


def _extract_labeled_value(text: str, label: str) -> str | None:
    pattern = re.compile(
        rf"\b{re.escape(label)}\b\s*[:\-]?\s*(?:\n\s*)?([^\n\r]{{1,120}})",
        re.I,
    )
    match = pattern.search(text)
    if not match:
        return None
    value = re.sub(r"\s+", " ", match.group(1)).strip()
    if not value:
        return None
    low = value.lower()
    if low.startswith("##") or low.startswith("###"):
        return None
    return value


def _extract_equipment_items(text: str) -> list[str]:
    section_match = re.search(r"##\s*Equipaggiamento\s*(.+?)(?:\n##\s+|\Z)", text, re.I | re.S)
    if not section_match:
        return []
    lines = [re.sub(r"\s+", " ", line).strip() for line in section_match.group(1).splitlines()]
    ignored = {
        "",
        "Di meno",
        "Di Più",
    }
    items: list[str] = []
    for line in lines:
        if line in ignored:
            continue
        if line.startswith("#"):
            continue
        if line.lower().startswith("intrattenimento"):
            continue
        if line.lower().startswith("sicurezza"):
            continue
        if line.lower().startswith("extra"):
            continue
        if line.lower().startswith("salva"):
            continue
        if len(line) < 2 or len(line) > 80:
            continue
        if line not in items:
            items.append(line)
    return items[:40]


def _extract_autoscout_specs(markdown: str) -> dict[str, str]:
    labels = [
        "Carrozzeria",
        "Tipo di veicolo",
        "Posti",
        "Porte",
        "Chilometraggio",
        "Anno",
        "Revisione",
        "Proprietari",
        "Veicolo non fumatori",
        "Potenza",
        "Tipo di cambio",
        "Cilindrata",
        "Classe emissioni",
        "Contrassegno ambientale",
        "Carburante",
        "Colore",
        "Colore specifico",
        "Materiale",
        "Venditore",
    ]
    specs: dict[str, str] = {}
    for label in labels:
        value = _extract_labeled_value(markdown, label)
        if value:
            specs[label] = value
    return specs


def _extract_title_from_detail(markdown: str) -> str | None:
    title_match = re.search(r"^\s*([A-Z][^\n]{2,60})\n\s*([^\n]{2,80})\s*$", markdown, re.M)
    if title_match:
        return f"{title_match.group(1).strip()} {title_match.group(2).strip()}"
    h1_match = re.search(r"^#\s+(.+)$", markdown, re.M)
    if h1_match:
        return h1_match.group(1).strip()
    return None


def _extract_location(text: str) -> str | None:
    location_match = re.search(r"^\s*([A-Z][^,\n]{1,50}\s*-\s*[A-Z]{2})\s*$", text, re.M)
    if location_match:
        return location_match.group(1).strip()
    de_location_match = re.search(r"\b\d{5}\s+([A-Za-z\-\s]+,\s*[A-Z]{2})", text)
    if de_location_match:
        return de_location_match.group(1).strip()
    return None


def parse_autoscout_detail_markdown(markdown: str, source_url: str) -> VehicleListing | None:
    title = _extract_title_from_detail(markdown)
    if not title:
        return None

    price = extract_euro_price(markdown)
    if not price:
        return None

    year = None
    date_match = re.search(r"\b\d{1,2}/(20\d{2})\b", markdown)
    if date_match:
        year = int(date_match.group(1))
    if not year:
        year_match = re.search(r"\b(20[0-2]\d)\b", markdown)
        if year_match:
            year = int(year_match.group(1))

    km = None
    km_match = re.search(r"([\d.]+)\s*km\b", markdown, re.I)
    if km_match:
        km = parse_km(km_match.group(1))

    make, model = _extract_brand_model(title)

    images = []
    for match in AUTOSCOUT_IMAGE_URL_PATTERN.finditer(markdown):
        url = match.group(1)
        normalized = re.sub(r"/\d+x\d+(\.\w+)$", r"/800x600\1", url)
        if normalized not in images:
            images.append(normalized)

    specs = _extract_autoscout_specs(markdown)
    equipment = _extract_equipment_items(markdown)

    transmission = _first_non_empty(
        specs.get("Tipo di cambio"),
        detect_transmission(markdown),
    )
    fuel = _first_non_empty(specs.get("Carburante"), detect_fuel(markdown))
    condition = _first_non_empty(
        _extract_condition(markdown),
        "used" if (specs.get("Tipo di veicolo") or "").lower() == "usato" else None,
        "new" if (specs.get("Tipo di veicolo") or "").lower() == "nuovo" else None,
    )
    color = _first_non_empty(
        specs.get("Colore specifico"),
        _extract_color(markdown),
        specs.get("Colore"),
    )
    emission_class = _first_non_empty(_extract_emission_class(markdown), specs.get("Classe emissioni"))
    seller_name = _extract_seller_name(markdown)
    seller_url = _extract_seller_url(markdown)

    return VehicleListing(
        provider="autoscout24",
        market="IT",
        url=source_url,
        title=title,
        description=_extract_description(markdown),
        price_amount=price,
        price_currency="EUR",
        year=year,
        make=make,
        model=model,
        trim=None,
        mileage_value=km,
        mileage_unit="km",
        fuel_type=fuel,
        transmission=transmission,
        body_style=_first_non_empty(
            specs.get("Carrozzeria"),
            detect_body_type(markdown),
            detect_body_type(title),
        ),
        condition=condition,
        color=color,
        doors=_extract_doors(markdown) or parse_km(specs.get("Porte") or ""),
        seats=_extract_seats(markdown) or parse_km(specs.get("Posti") or ""),
        power=_extract_power(markdown),
        emission_class=emission_class,
        seller_type=_first_non_empty(_extract_seller_type(markdown), _extract_seller_type(specs.get("Venditore") or "")),
        seller_name=seller_name,
        seller_url=seller_url,
        city=_extract_location(markdown),
        region=None,
        country="IT",
        posted_at=None,
        images=images,
        raw_payload={
            "autoscout": {
                "specs": specs,
                "equipment": equipment,
            }
        },
        reason_codes=[],
        scraped_at=datetime.now(timezone.utc),
    )


def parse_autoscout_markdown(markdown: str, brand: str | None, model: str | None) -> list[VehicleListing]:
    listings: list[VehicleListing] = []
    seen: set[str] = set()
    brand_prefix = (brand or "").lower()[:5]
    model_pattern = re.compile((model or "").replace(" ", r"\s*"), re.I) if model else None
    blocks = AUTOSCOUT_IMAGE_PATTERN.split(markdown)

    for i in range(1, len(blocks), 3):
        image_url = blocks[i]
        image_uuid = blocks[i + 1]
        context = blocks[i + 2] if i + 2 < len(blocks) else ""
        pre_context = blocks[i - 1] if i - 1 >= 0 else ""
        combined_context = f"{pre_context}\n{context}"

        if image_uuid in seen:
            continue
        if brand_prefix and brand_prefix not in combined_context.lower():
            continue

        seen.add(image_uuid)
        image_url = re.sub(r"/\d+x\d+(\.\w+)$", r"/800x600\1", image_url)

        price = extract_euro_price(context)
        if not price:
            continue

        title = _extract_heading_from_pre_context(pre_context) or ""
        link_title = re.search(r"\[([^\]]{5,120})\]\(https://www\.autoscout24\.it/annunci/", context, re.I)
        if link_title and (not title or _looks_like_noise_heading(title)):
            title = link_title.group(1).replace("**", "").strip()
        if not title:
            bold_title = re.search(r"\*\*([^*]{5,120})\*\*", context)
            if bold_title:
                title = bold_title.group(1).strip()
        if not title and brand and model:
            title = f"{brand} {model}"
        if not title:
            continue
        if model_pattern and not (model_pattern.search(title) or model_pattern.search(combined_context)):
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
                body_style=_first_non_empty(detect_body_type(context), detect_body_type(title)),
                condition=_extract_condition(combined_context),
                color=_extract_color(combined_context),
                doors=_extract_doors(combined_context),
                seats=_extract_seats(combined_context),
                power=_extract_power(combined_context),
                emission_class=_extract_emission_class(combined_context),
                seller_type=_extract_seller_type(combined_context),
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
