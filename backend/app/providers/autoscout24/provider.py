from urllib.parse import quote_plus

from app.core.settings import get_settings
from app.models.search import SearchRequest
from app.models.vehicle import VehicleListing
from app.providers.autoscout24.parser import parse_autoscout_markdown
from app.providers.base.base_provider import BaseProvider
from app.providers.base.models import ProviderHealth, ProviderInfo
from app.providers.common.scrapingbee import fetch_markdown


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
        return bool(settings.scrapingbee_api_key)

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

    async def search(self, request: SearchRequest) -> list[VehicleListing]:
        settings = get_settings()
        if settings.test_stub_mode:
            return self._stub_listings(request)

        all_listings: list[VehicleListing] = []
        for url in self._build_urls(request):
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
