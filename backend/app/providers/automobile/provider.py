import re
from datetime import datetime, timezone
from urllib.parse import quote_plus

import httpx

from app.core.request_context import get_request_id
from app.core.settings import get_settings
from app.models.search import SearchRequest
from app.models.vehicle import VehicleListing
from app.providers.automobile.parser import parse_automobile_markdown
from app.providers.base.base_provider import BaseProvider
from app.providers.base.models import ProviderHealth, ProviderInfo
from app.providers.common.scrapingbee import fetch_markdown
from app.providers.common.text_utils import parse_km, parse_price

_BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "it-IT,it;q=0.9",
}


class AutomobileProvider(BaseProvider):
    info = ProviderInfo(
        id="automobile",
        name="Automobile.it",
        provider_type="html_scraper",
        market="IT",
        supports_filters=[
            "query",
            "brand",
            "model",
            "trim",
            "price_min",
            "price_max",
            "mileage_max",
        ],
    )

    @staticmethod
    def _build_urls(request: SearchRequest) -> list[str]:
        brand = (request.brand or "").strip().lower()
        model = (request.model or "").strip().lower()
        if brand and model:
            model_slug = re.sub(r"[^a-z0-9]+", "_", model).strip("_")
            base = f"https://www.automobile.it/{brand}-{model_slug}"
            return [base, f"{base}/page-2"]
        if brand:
            return [f"https://www.automobile.it/{brand}", f"https://www.automobile.it/{brand}/page-2"]

        query = request.query or " ".join([request.brand or "", request.model or "", request.trim or ""]).strip()
        encoded_query = quote_plus(query) if query else ""
        base = f"https://www.automobile.it/annunci?q={encoded_query}" if encoded_query else "https://www.automobile.it/annunci"
        return [base, f"{base}&page=2" if "?" in base else f"{base}?page=2"]

    def is_configured(self) -> bool:
        settings = get_settings()
        if settings.test_stub_mode:
            return True
        from app.providers.common.scrapingbee import is_scraper_configured
        return is_scraper_configured()

    @staticmethod
    def _stub_listings(request: SearchRequest) -> list[VehicleListing]:
        model_name = request.model or "320d"
        return [
            VehicleListing(
                id="44444444-4444-4444-8444-444444444444",
                provider="automobile",
                market="IT",
                url="https://stub.automobile.local/listing-1",
                title=f"BMW {model_name} Stub Automobile.it",
                description="Stub listing for test mode",
                price_amount=24700,
                year=2021,
                make=request.brand or "BMW",
                model=model_name,
                mileage_value=47000,
                fuel_type="Diesel",
                transmission="Automatico",
                body_style="Berlina",
                city="Milano",
                country="IT",
                images=["https://images.example.com/automobile-stub.jpg"],
                color="Nero",
                doors=4,
                emission_class="Euro 6",
                seller_type="dealer",
            )
        ]

    # ------------------------------------------------------------------
    # NEXT_DATA JSON path (direct / firecrawl backends)
    # ------------------------------------------------------------------

    async def _fetch_next_data_listings(self, url: str) -> list[VehicleListing]:
        """Fetch HTML and extract structured listing data from __NEXT_DATA__."""
        import json as _json

        settings = get_settings()
        timeout = httpx.Timeout(settings.request_timeout_seconds)
        req_headers = dict(_BROWSER_HEADERS)
        rid = get_request_id()
        if rid:
            req_headers["x-request-id"] = rid
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
            response = await client.get(url, headers=req_headers)
            response.raise_for_status()

        m = re.search(
            r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>',
            response.text,
            re.DOTALL,
        )
        if not m:
            return []

        try:
            data = _json.loads(m.group(1))
        except Exception:  # noqa: BLE001
            return []

        raw_listings = (
            data.get("props", {})
            .get("pageProps", {})
            .get("apiResults", {})
            .get("result", {})
            .get("resultList", [])
        )
        if not isinstance(raw_listings, list):
            return []

        results: list[VehicleListing] = []
        for item in raw_listings:
            listing = self._parse_next_item(item)
            if listing:
                results.append(listing)
        return results

    def _parse_next_item(self, item: dict) -> VehicleListing | None:
        details: dict = item.get("details") or {}

        # --- Price ---
        price_raw = item.get("formattedPrice") or ""
        price = parse_price(price_raw)
        if not price:
            return None

        # --- Title & URL ---
        title = (item.get("title") or "").strip()
        if not title:
            return None

        relative_url = item.get("url") or ""
        listing_url = f"https://www.automobile.it{relative_url}" if relative_url else ""
        if not listing_url:
            return None

        # --- Year ---
        year: int | None = None
        reg = details.get("registration") or ""
        year_match = re.search(r"\b(20\d{2}|19\d{2})\b", reg)
        if year_match:
            year = int(year_match.group(1))

        # --- KM ---
        km = parse_km(details.get("formattedKm") or "")

        # --- Fuel & emission class ---
        fuel_raw = details.get("fuelEmissions") or ""
        # e.g. "GPL - Euro 6" / "Diesel - Euro 6d" / "Benzina"
        fuel: str | None = None
        emission: str | None = None
        if fuel_raw:
            parts = [p.strip() for p in fuel_raw.split("-")]
            if parts:
                fuel_str = parts[0].strip()
                fuel_map = {
                    "benzina": "Benzina", "diesel": "Diesel",
                    "elettrica": "Elettrica", "elettrico": "Elettrica",
                    "ibrida": "Ibrida", "ibrido": "Ibrida", "hybrid": "Ibrida",
                    "gpl": "GPL", "metano": "Metano",
                }
                fuel = fuel_map.get(fuel_str.lower(), fuel_str or None)
            if len(parts) > 1:
                emission = parts[1].strip() or None

        # --- Power ---
        power: str | None = None
        power_raw = details.get("formattedPower") or ""
        cv_match = re.search(r"(\d+)\s*CV", power_raw, re.I)
        if cv_match:
            power = f"{cv_match.group(1)} CV"

        # --- Condition ---
        channel = (item.get("channel") or "").lower()
        if "usato" in channel:
            condition = "used"
        elif "nuovo" in channel:
            condition = "new"
        else:
            condition: str | None = None

        # --- Seller type ---
        seller_raw = (item.get("sellerType") or "").upper()
        seller_type = "dealer" if seller_raw == "DEALER" else "private" if seller_raw == "PRIVATE" else None

        # --- Images ---
        images: list[str] = [
            f"{img_url}?rule=ad-1280.jpeg"
            for img_url in (item.get("imageUrls") or [])
            if img_url
        ]

        # --- Make / Model from title ---
        title_parts = title.split()
        make = title_parts[0] if title_parts else None
        model_str = title_parts[1] if len(title_parts) > 1 else None

        return VehicleListing(
            provider="automobile",
            market="IT",
            url=listing_url,
            title=title,
            description=(item.get("shortDescription") or "").strip() or None,
            price_amount=price,
            price_currency="EUR",
            year=year,
            make=make,
            model=model_str,
            trim=None,
            mileage_value=km,
            mileage_unit="km",
            fuel_type=fuel,
            transmission=None,
            body_style=None,
            condition=condition,
            color=None,
            doors=None,
            seats=None,
            power=power,
            emission_class=emission,
            seller_type=seller_type,
            city=item.get("location") or None,
            region=None,
            country="IT",
            posted_at=None,
            images=images,
            raw_payload=None,
            reason_codes=[],
            scraped_at=datetime.now(timezone.utc),
        )

    # ------------------------------------------------------------------
    # Detail page scraping
    # ------------------------------------------------------------------

    async def fetch_detail(self, url: str) -> VehicleListing | None:
        """Fetch a single Automobile.it listing detail page and return a VehicleListing.

        Uses direct HTTP + __NEXT_DATA__ JSON extraction.  Returns None when the page
        cannot be fetched or does not contain recognisable vehicle data.
        """
        import json as _json

        settings = get_settings()
        timeout = httpx.Timeout(settings.request_timeout_seconds)
        req_headers = dict(_BROWSER_HEADERS)
        rid = get_request_id()
        if rid:
            req_headers["x-request-id"] = rid
        try:
            async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
                response = await client.get(url, headers=req_headers)
                response.raise_for_status()
        except Exception:  # noqa: BLE001
            return None

        # --- __NEXT_DATA__ extraction ---
        m = re.search(
            r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>',
            response.text,
            re.DOTALL,
        )
        if not m:
            return None
        try:
            data = _json.loads(m.group(1))
        except Exception:  # noqa: BLE001
            return None

        page_props: dict = data.get("props", {}).get("pageProps", {})

        # Current Automobile.it VIP structure: pageProps.result + pageProps.vehicleInformation
        result = page_props.get("result")
        vehicle_info = page_props.get("vehicleInformation")
        if isinstance(result, dict) and result.get("title"):
            return self._parse_automobile_vip(result, vehicle_info, url)

        # Fallback: older page versions use other top-level keys
        vehicle: dict | None = None
        for key in ("vehicle", "ad", "adDetail", "listing", "adData"):
            candidate = page_props.get(key)
            if isinstance(candidate, dict):
                vehicle = candidate
                break

        # Some versions nest vehicle inside apiResults.result (single object, not list)
        if vehicle is None:
            api_result = page_props.get("apiResults", {}).get("result")
            if isinstance(api_result, dict) and "title" in api_result:
                vehicle = api_result

        if not vehicle:
            return None

        return self._parse_detail_vehicle(vehicle, url)

    def _parse_automobile_vip(
        self, result: dict, vehicle_info: dict | None, url: str
    ) -> VehicleListing | None:
        """Parse the current Automobile.it VIP page structure.

        Data lives in two dicts:
        - ``result``: basic listing fields (title, price, description, images, seller…)
        - ``vehicle_info``: structured specs split into basicInfo / aesthetic / accessories
        """
        # --- Price ---
        price = parse_price(result.get("formattedPrice") or "")
        if not price:
            return None

        # --- Title ---
        title = (result.get("title") or "").strip()
        if not title:
            return None

        # --- URL ---
        raw_url = result.get("url") or ""
        listing_url = f"https://www.automobile.it{raw_url}" if raw_url.startswith("/") else raw_url or url

        # --- Images (prefer vipPictures with full-res imgBig) ---
        images: list[str] = []
        vip_pics = result.get("vipPictures") or []
        if isinstance(vip_pics, list):
            for pic in vip_pics:
                img_url = pic.get("imgBig") or pic.get("imgThumbnail") or "" if isinstance(pic, dict) else ""
                if img_url and img_url not in images:
                    images.append(img_url)
        if not images:
            for img_url in (result.get("imageUrls") or []):
                if img_url and img_url not in images:
                    images.append(img_url)

        # --- Description ---
        description = (result.get("description") or "").strip() or None

        # --- Condition / Seller ---
        channel = (result.get("channel") or "").lower()
        condition = "used" if "usat" in channel else "new" if "nuov" in channel else None
        seller_raw = (result.get("sellerType") or "").upper()
        seller_type = "dealer" if seller_raw == "DEALER" else "private" if seller_raw == "PRIVATE" else None
        dealer: dict = result.get("dealer") or {}
        seller_name = dealer.get("name") or dealer.get("companyName") or None
        seller_url_val = dealer.get("url") or dealer.get("profileUrl") or None

        # --- City ---
        city = (result.get("location") or "").strip() or None

        # --- Make / Model from title ---
        title_parts = title.split()
        make_raw = title_parts[0] if title_parts else None
        model_raw = title_parts[1] if len(title_parts) > 1 else None

        # ----------------------------------------------------------------
        # Structured specs from vehicleInformation
        # ----------------------------------------------------------------
        year: int | None = None
        km: int | None = None
        fuel_type: str | None = None
        transmission: str | None = None
        power: str | None = None
        body_style: str | None = None
        doors: int | None = None
        seats: int | None = None
        emission_class: str | None = None
        color: str | None = None
        equipment: list[str] = []

        if isinstance(vehicle_info, dict):
            # basicInfo: list of {title, values}
            basic = {
                item["title"]: item["values"]
                for item in (vehicle_info.get("basicInfo") or [])
                if isinstance(item, dict) and item.get("title") and item.get("values")
            }

            # Year from "Immatricolazione": "Febbraio 2016"
            reg_str = " ".join(basic.get("Immatricolazione") or [])
            year_m = re.search(r"\b(20\d{2}|19\d{2})\b", reg_str)
            if year_m:
                year = int(year_m.group(1))

            # KM from "Chilometri": "288.000"
            km_str = " ".join(basic.get("Chilometri") or [])
            km = parse_km(km_str) or None

            # Fuel
            fuel_vals = basic.get("Carburante") or []
            if fuel_vals:
                fuel_map = {
                    "benzina": "Benzina", "diesel": "Diesel",
                    "elettrica": "Elettrica", "elettrico": "Elettrica",
                    "ibrida": "Ibrida", "ibrido": "Ibrida", "hybrid": "Ibrida",
                    "gpl": "GPL", "metano": "Metano",
                }
                raw_f = fuel_vals[0].strip()
                fuel_type = fuel_map.get(raw_f.lower(), raw_f) or None

            # Emission class from "Emissioni" if present
            emission_vals = basic.get("Emissioni") or basic.get("Classe emissioni") or []
            if emission_vals:
                emission_class = emission_vals[0].strip() or None

            # Power from "Potenza": "66 kW (89 CV)"
            power_str = " ".join(basic.get("Potenza") or [])
            cv_m = re.search(r"\((\d+)\s*CV\)", power_str, re.I)
            if cv_m:
                power = f"{cv_m.group(1)} CV"
            else:
                kw_m = re.search(r"(\d+)\s*kW", power_str, re.I)
                if kw_m:
                    power = f"{int(kw_m.group(1))} kW"

            # Transmission from "Cambio": "Cambio manuale"
            trans_str = " ".join(basic.get("Cambio") or []).lower()
            if trans_str:
                if "autom" in trans_str:
                    transmission = "Automatico"
                elif "manuale" in trans_str or "manual" in trans_str:
                    transmission = "Manuale"
                else:
                    transmission = trans_str.strip().capitalize() or None

            # Body style from "Carrozzeria"
            body_vals = basic.get("Carrozzeria") or []
            if body_vals:
                body_style = body_vals[0].strip() or None

            # Doors from "Numero di porte": "4 o 5 porte"
            doors_str = " ".join(basic.get("Numero di porte") or [])
            doors_m = re.search(r"\b(\d+)\b", doors_str)
            if doors_m:
                doors = int(doors_m.group(1))

            # Seats from "Numero di posti": "5 posti"
            seats_str = " ".join(basic.get("Numero di posti") or [])
            seats_m = re.search(r"\b(\d+)\b", seats_str)
            if seats_m:
                seats = int(seats_m.group(1))

            # Make / Model from basicInfo (more accurate than title split)
            make_vals = basic.get("Marca") or []
            if make_vals:
                make_raw = make_vals[0].strip() or make_raw
            model_vals = basic.get("Modello") or []
            if model_vals and model_vals[0].strip() != "-":
                model_raw = model_vals[0].strip() or model_raw

            # Condition from "Tipologia": "Usato" / "Nuovo"
            tipo_vals = basic.get("Tipologia") or []
            if tipo_vals:
                tipo = tipo_vals[0].strip().lower()
                condition = "used" if "usat" in tipo else "new" if "nuov" in tipo else condition

            # Color from aesthetic: [{title: "Colore esterno", values: ["Grigio"]}]
            aesthetic = {
                item["title"]: item["values"]
                for item in (vehicle_info.get("aesthetic") or [])
                if isinstance(item, dict) and item.get("title") and item.get("values")
            }
            color_vals = aesthetic.get("Colore esterno") or aesthetic.get("Colore") or []
            if color_vals:
                color = color_vals[0].strip() or None

            # Equipment from accessories: [{title: "Multimedia", values: [...]}, ...]
            for acc_group in (vehicle_info.get("accessories") or []):
                if not isinstance(acc_group, dict):
                    continue
                for item in (acc_group.get("values") or []):
                    if isinstance(item, str) and item.strip():
                        equipment.append(item.strip())

        return VehicleListing(
            provider="automobile",
            market="IT",
            url=listing_url,
            title=title,
            description=description,
            price_amount=price,
            price_currency="EUR",
            year=year,
            make=make_raw,
            model=model_raw,
            trim=None,
            mileage_value=km,
            mileage_unit="km",
            fuel_type=fuel_type,
            transmission=transmission,
            body_style=body_style,
            condition=condition,
            color=color,
            doors=doors,
            seats=seats,
            power=power,
            emission_class=emission_class,
            seller_type=seller_type,
            seller_name=seller_name,
            seller_url=seller_url_val,
            city=city,
            region=None,
            country="IT",
            posted_at=None,
            images=images,
            raw_payload={"equipment": equipment} if equipment else None,
            reason_codes=[],
            scraped_at=datetime.now(timezone.utc),
        )

    def _parse_detail_vehicle(self, v: dict, url: str) -> VehicleListing | None:  # noqa: C901
        """Map a detail-page vehicle dict to a VehicleListing.

        Field names vary across Automobile.it page versions; we try several aliases.
        """
        def _get(*keys: str) -> object:
            for key in keys:
                val = v.get(key)
                if val is not None:
                    return val
            return None

        def _str(*keys: str) -> str | None:
            val = _get(*keys)
            return str(val).strip() or None if val is not None else None

        def _int(*keys: str) -> int | None:
            val = _get(*keys)
            if val is None:
                return None
            try:
                return int(str(val).replace(".", "").replace(",", "").strip())
            except (ValueError, TypeError):
                return None

        # --- Price ---
        price_raw = _str("formattedPrice", "price") or ""
        price = parse_price(price_raw)
        if not price:
            raw_int = _int("price", "priceValue")
            price = raw_int if raw_int and raw_int > 0 else None
        if not price:
            return None

        # --- Title ---
        title = _str("title", "name") or ""
        if not title:
            return None

        # --- URL ---
        raw_url = _str("url", "detailUrl") or ""
        listing_url = f"https://www.automobile.it{raw_url}" if raw_url.startswith("/") else raw_url or url

        # --- Details sub-object (Automobile.it search structure) ---
        details: dict = v.get("details") or {}

        # --- Year ---
        year: int | None = None
        reg = _str("registration") or details.get("registration") or ""
        year_match = re.search(r"\b(20\d{2}|19\d{2})\b", str(reg))
        if year_match:
            year = int(year_match.group(1))
        if not year:
            year = _int("year", "modelYear")

        # --- KM ---
        km = parse_km(_str("formattedKm", "km") or details.get("formattedKm") or "")
        if not km:
            km = _int("mileage", "km", "mileageKm")

        # --- Fuel & emission ---
        fuel_raw = _str("fuelEmissions", "fuel", "fuelType") or details.get("fuelEmissions") or ""
        fuel: str | None = None
        emission: str | None = None
        if fuel_raw:
            parts = [p.strip() for p in str(fuel_raw).split("-")]
            fuel_map = {
                "benzina": "Benzina", "diesel": "Diesel",
                "elettrica": "Elettrica", "elettrico": "Elettrica",
                "ibrida": "Ibrida", "ibrido": "Ibrida", "hybrid": "Ibrida",
                "gpl": "GPL", "metano": "Metano",
            }
            fuel = fuel_map.get(parts[0].lower(), parts[0] or None) if parts else None
            emission = parts[1].strip() or None if len(parts) > 1 else None

        # --- Power ---
        power_raw = _str("formattedPower", "power") or details.get("formattedPower") or ""
        power: str | None = None
        cv_match = re.search(r"(\d+)\s*CV", str(power_raw), re.I)
        if cv_match:
            power = f"{cv_match.group(1)} CV"

        # --- Transmission ---
        trans_raw = _str("transmission", "gearbox", "cambio") or ""
        transmission: str | None = trans_raw if trans_raw else None

        # --- Body style ---
        body_raw = _str("bodyStyle", "bodyType", "carrozzeria", "category") or ""
        body_style: str | None = body_raw if body_raw else None

        # --- Condition ---
        channel = (_str("channel", "condition") or "").lower()
        condition = "used" if "usat" in channel else "new" if "nuov" in channel else None

        # --- Seller ---
        seller_raw = (_str("sellerType") or "").upper()
        seller_type = "dealer" if seller_raw == "DEALER" else "private" if seller_raw == "PRIVATE" else None
        seller_obj: dict = v.get("seller") or v.get("advertiser") or {}
        seller_name = (seller_obj.get("name") or seller_obj.get("companyName") or None)
        seller_url = seller_obj.get("url") or seller_obj.get("profileUrl") or None

        # --- Color ---
        color = _str("color", "colour", "colore") or None

        # --- Doors / Seats ---
        doors: int | None = _int("doors", "porte")
        seats: int | None = _int("seats", "posti")

        # --- Images ---
        images: list[str] = []
        for key in ("images", "imageUrls", "photos", "gallery"):
            raw_imgs = v.get(key)
            if isinstance(raw_imgs, list):
                for img in raw_imgs:
                    img_url = img if isinstance(img, str) else (img.get("url") or img.get("src") or "" if isinstance(img, dict) else "")
                    if img_url:
                        if not img_url.startswith("http"):
                            img_url = f"https:{img_url}" if img_url.startswith("//") else img_url
                        if img_url not in images:
                            images.append(img_url)
                break

        # --- Description ---
        description = _str("description", "longDescription", "note") or None

        # --- Equipment ---
        equipment: list[str] = []
        for key in ("equipment", "accessories", "features", "optional"):
            raw_eq = v.get(key)
            if isinstance(raw_eq, list):
                equipment = [str(e) for e in raw_eq if e]
                break
            if isinstance(raw_eq, dict):
                for items in raw_eq.values():
                    if isinstance(items, list):
                        equipment.extend(str(e) for e in items if e)
                break

        # --- Make / Model ---
        make_raw = _str("make", "brand") or None
        model_raw = _str("model", "modelName") or None
        if not make_raw and title:
            parts = title.split()
            make_raw = parts[0] if parts else None
            model_raw = parts[1] if len(parts) > 1 else None

        city = _str("location", "city") or None
        if city and "," in city:
            city = city.split(",")[0].strip()

        return VehicleListing(
            provider="automobile",
            market="IT",
            url=listing_url,
            title=title,
            description=description,
            price_amount=price,
            price_currency="EUR",
            year=year,
            make=make_raw,
            model=model_raw,
            trim=None,
            mileage_value=km,
            mileage_unit="km",
            fuel_type=fuel,
            transmission=transmission,
            body_style=body_style,
            condition=condition,
            color=color,
            doors=doors,
            seats=seats,
            power=power,
            emission_class=emission,
            seller_type=seller_type,
            seller_name=seller_name,
            seller_url=seller_url,
            city=city,
            region=None,
            country="IT",
            posted_at=None,
            images=images,
            raw_payload={"equipment": equipment} if equipment else None,
            reason_codes=[],
            scraped_at=datetime.now(timezone.utc),
        )

    # ------------------------------------------------------------------
    # Main search
    # ------------------------------------------------------------------

    async def search(self, request: SearchRequest) -> list[VehicleListing]:
        settings = get_settings()
        if settings.test_stub_mode:
            return self._stub_listings(request)

        use_json = settings.scraping_backend != "scrapingbee"
        all_listings: list[VehicleListing] = []
        for url in self._build_urls(request):
            if use_json:
                parsed = await self._fetch_next_data_listings(url)
            else:
                markdown = await fetch_markdown(url, wait_ms=8000, premium_proxy=True)
                parsed = parse_automobile_markdown(markdown, request.brand, request.model)
            all_listings.extend(parsed)
        return all_listings

    async def health(self) -> ProviderHealth:
        return ProviderHealth(
            provider=self.info.id,
            enabled=self.info.enabled,
            configured=self.is_configured(),
            error_rate=0.0,
        )
