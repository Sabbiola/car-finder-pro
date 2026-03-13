from urllib.parse import quote_plus

from app.core.settings import get_settings
from app.models.search import SearchRequest
from app.models.vehicle import VehicleListing
from app.providers.automobile.parser import parse_automobile_markdown
from app.providers.base.base_provider import BaseProvider
from app.providers.base.models import ProviderHealth, ProviderInfo
from app.providers.common.scrapingbee import fetch_markdown


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
        query = request.query or " ".join([request.brand or "", request.model or "", request.trim or ""]).strip()
        encoded_query = quote_plus(query) if query else ""
        base = f"https://www.automobile.it/annunci?q={encoded_query}" if encoded_query else "https://www.automobile.it/annunci"

        return [base, f"{base}&p=2" if "?" in base else f"{base}?p=2"]

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
            )
        ]

    async def search(self, request: SearchRequest) -> list[VehicleListing]:
        settings = get_settings()
        if settings.test_stub_mode:
            return self._stub_listings(request)

        all_listings: list[VehicleListing] = []
        for url in self._build_urls(request):
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
