import re
from datetime import datetime, timezone
from urllib.parse import quote_plus

import httpx

from app.core.settings import get_settings
from app.models.search import SearchRequest
from app.models.vehicle import VehicleListing
from app.providers.autoscout24.parser import parse_autoscout_markdown
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


class AutoScout24Provider(BaseProvider):
    info = ProviderInfo(
        id="autoscout24",
        name="AutoScout24",
        provider_type="html_scraper",
        market="IT",
        supports_filters=[
            "brand",
            "model",
            "trim",
            "year_min",
            "year_max",
            "price_min",
            "price_max",
            "mileage_max",
            "fuel_types",
        ],
    )

    @staticmethod
    def _build_urls(request: SearchRequest) -> list[str]:
        brand = (request.brand or "").strip().lower()
        model = (request.model or "").strip()
        trim = (request.trim or "").strip()
        model_query = " ".join([value for value in [model, trim] if value]).strip()
        params: list[str] = []
        if request.year_min:
            params.append(f"fregfrom={request.year_min}")
        if request.year_max:
            params.append(f"fregto={request.year_max}")
        if request.price_min:
            params.append(f"pricefrom={request.price_min}")
        if request.price_max:
            params.append(f"priceto={request.price_max}")
        if request.mileage_max:
            params.append(f"kmto={request.mileage_max}")
        if request.fuel_types:
            fuel_map = {
                "Benzina": "B",
                "Diesel": "D",
                "Elettrica": "E",
                "Ibrida": "H",
                "GPL": "L",
                "Metano": "M",
            }
            fuel_code = fuel_map.get(request.fuel_types[0])
            if fuel_code:
                params.append(f"fuelc={fuel_code}")
        if request.body_styles:
            body_map = {
                "SUV": "3",
                "Berlina": "1",
                "Station Wagon": "4",
                "Coup\u00e9": "2",
                "Coupe": "2",
                "Cabrio": "5",
                "Monovolume": "6",
            }
            body_code = body_map.get(request.body_styles[0])
            if body_code:
                params.append(f"body={body_code}")

        query_suffix = f"?{'&'.join(params)}" if params else ""

        if brand:
            brand_slug = quote_plus(brand.replace(" ", "-"))
            base = f"https://www.autoscout24.it/lst/{brand_slug}"
            if model_query:
                q = quote_plus(model_query)
                base = f"{base}?q={q}"
                if query_suffix:
                    base = f"{base}&{query_suffix.lstrip('?')}"
            elif query_suffix:
                base = f"{base}{query_suffix}"
        else:
            base = f"https://www.autoscout24.it/lst/?{query_suffix.lstrip('?')}".rstrip("?")

        urls = [base]
        separator = "&" if "?" in base else "?"
        urls.append(f"{base}{separator}page=2")
        return urls

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
                id="11111111-1111-4111-8111-111111111111",
                provider="autoscout24",
                market="IT",
                url="https://stub.autoscout24.local/listing-1",
                title=f"BMW {model_name} Stub AutoScout24",
                description="Stub listing for test mode",
                price_amount=24900,
                year=2021,
                make=request.brand or "BMW",
                model=model_name,
                mileage_value=42000,
                fuel_type="Diesel",
                transmission="Automatico",
                body_style="Berlina",
                city="Milano",
                country="IT",
                images=["https://images.example.com/as24-stub.jpg"],
                color="Nero",
                doors=4,
                emission_class="Euro 6",
                seller_type="dealer",
            )
        ]

    # ------------------------------------------------------------------
    # NEXT_DATA JSON path (direct / firecrawl backends)
    # ------------------------------------------------------------------

    async def _fetch_next_data_listings(
        self, url: str, brand: str | None, model: str | None
    ) -> list[VehicleListing]:
        """Fetch HTML and extract structured listing data from __NEXT_DATA__."""
        import json as _json

        settings = get_settings()
        timeout = httpx.Timeout(settings.request_timeout_seconds)
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
            response = await client.get(url, headers=_BROWSER_HEADERS)
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

        raw_listings = data.get("props", {}).get("pageProps", {}).get("listings", [])
        if not isinstance(raw_listings, list):
            return []

        results: list[VehicleListing] = []
        for item in raw_listings:
            listing = self._parse_next_item(item)
            if listing:
                results.append(listing)
        return results

    def _parse_next_item(self, item: dict) -> VehicleListing | None:
        vehicle = item.get("vehicle") or {}
        price_obj = item.get("price") or {}
        location_obj = item.get("location") or {}
        vehicle_details: list[dict] = item.get("vehicleDetails") or []

        # --- Price ---
        price_raw = price_obj.get("priceFormatted") or ""
        # Strip currency symbol; Italian format uses "." as thousands sep, no decimals
        price_clean = price_raw.split(",")[0]
        price = parse_price(price_clean)
        if not price:
            return None

        # --- Identity ---
        make = (vehicle.get("make") or "").strip()
        model_str = (vehicle.get("model") or "").strip()
        version = (vehicle.get("modelVersionInput") or "").strip()
        title_parts = [p for p in [make, model_str, version] if p]
        title = " ".join(title_parts)
        if not title:
            return None

        relative_url = item.get("url") or ""
        listing_url = f"https://www.autoscout24.it{relative_url}" if relative_url else ""
        if not listing_url:
            return None

        # --- Year ---
        year: int | None = None
        year_detail = next(
            (d for d in vehicle_details if d.get("ariaLabel") == "Anno"), None
        )
        if year_detail:
            year_match = re.search(r"(\d{4})", year_detail.get("data") or "")
            if year_match:
                year = int(year_match.group(1))

        # --- Km ---
        km: int | None = None
        km_detail = next(
            (d for d in vehicle_details if d.get("ariaLabel") == "Chilometraggio"), None
        )
        if km_detail:
            km = parse_km(km_detail.get("data") or "")
        if km is None:
            km = parse_km(vehicle.get("mileageInKm") or "")

        # --- Power ---
        power: str | None = None
        power_detail = next(
            (d for d in vehicle_details if d.get("ariaLabel") == "Potenza"), None
        )
        if power_detail:
            pd_str = power_detail.get("data") or ""
            cv_match = re.search(r"\((\d+)\s*CV\)", pd_str, re.I)
            if cv_match:
                power = f"{cv_match.group(1)} CV"
            else:
                kw_match = re.search(r"(\d+)\s*kW", pd_str, re.I)
                if kw_match:
                    power = f"{round(int(kw_match.group(1)) * 1.35962)} CV"

        # --- Condition ---
        offer_type = vehicle.get("offerType") or ""
        condition = {"U": "used", "N": "new"}.get(offer_type)

        # --- Images ---
        images: list[str] = []
        for img_url in (item.get("images") or []):
            normalized = re.sub(r"/\d+x\d+(\.\w+)$", r"/800x600\1", img_url)
            if normalized not in images:
                images.append(normalized)

        return VehicleListing(
            provider="autoscout24",
            market="IT",
            url=listing_url,
            title=title,
            description=(vehicle.get("subtitle") or None),
            price_amount=price,
            price_currency="EUR",
            year=year,
            make=make or None,
            model=model_str or None,
            trim=None,
            mileage_value=km,
            mileage_unit="km",
            fuel_type=vehicle.get("fuel") or None,
            transmission=vehicle.get("transmission") or None,
            body_style=None,
            condition=condition,
            color=None,
            doors=None,
            seats=None,
            power=power,
            emission_class=None,
            seller_type=None,
            city=(location_obj.get("city") or None),
            region=None,
            country="IT",
            posted_at=None,
            images=images,
            raw_payload=None,
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
                parsed = await self._fetch_next_data_listings(url, request.brand, request.model)
            else:
                markdown = await fetch_markdown(url, wait_ms=8000)
                parsed = parse_autoscout_markdown(markdown, request.brand, request.model)
            all_listings.extend(parsed)
        return all_listings

    async def health(self) -> ProviderHealth:
        return ProviderHealth(
            provider=self.info.id,
            enabled=self.info.enabled,
            configured=self.is_configured(),
            error_rate=0.0,
        )
