from urllib.parse import quote_plus

from app.core.settings import get_settings
from app.models.search import SearchRequest
from app.models.vehicle import VehicleListing
from app.providers.base.base_provider import BaseProvider
from app.providers.common.scrapingbee import fetch_markdown
from app.providers.base.models import ProviderHealth, ProviderInfo
from app.providers.subito.parser import parse_subito_markdown


class SubitoProvider(BaseProvider):
    info = ProviderInfo(
        id="subito",
        name="Subito.it",
        provider_type="html_scraper",
        market="IT",
        supports_filters=[
            "query",
            "brand",
            "model",
            "trim",
            "price_min",
            "price_max",
            "location",
        ],
    )

    @staticmethod
    def _build_urls(request: SearchRequest) -> list[str]:
        query = request.query or " ".join([request.brand or "", request.model or "", request.trim or ""]).strip()
        query = quote_plus(query) if query else ""
        base = (
            f"https://www.subito.it/annunci-italia/vendita/auto/?q={query}"
            if query
            else "https://www.subito.it/annunci-italia/vendita/auto/"
        )
        separator = "&" if "?" in base else "?"
        return [base, f"{base}{separator}o=2", f"{base}{separator}o=3"]

    def is_configured(self) -> bool:
        settings = get_settings()
        if settings.test_stub_mode:
            return True
        return bool(settings.scrapingbee_api_key)

    @staticmethod
    def _stub_listings(request: SearchRequest) -> list[VehicleListing]:
        query = (request.query or "").lower()
        brand = (request.brand or "").lower()
        if "fail-subito" in query or "fail-subito" in brand:
            raise RuntimeError("Subito test stub forced failure")
        model_name = request.model or "320d"
        return [
            VehicleListing(
                id="22222222-2222-4222-8222-222222222222",
                provider="subito",
                market="IT",
                url="https://stub.subito.local/listing-1",
                title=f"BMW {model_name} Stub Subito",
                description="Stub listing for test mode",
                price_amount=25900,
                year=2020,
                make=request.brand or "BMW",
                model=model_name,
                mileage_value=51000,
                fuel_type="Diesel",
                transmission="Manuale",
                body_style="Berlina",
                city="Roma",
                country="IT",
                images=["https://images.example.com/subito-stub.jpg"],
                color="Nero",
                doors=4,
                emission_class="Euro 6",
                seller_type="private",
            )
        ]

    async def search(self, request: SearchRequest) -> list[VehicleListing]:
        settings = get_settings()
        if settings.test_stub_mode:
            return self._stub_listings(request)

        all_listings: list[VehicleListing] = []
        urls = self._build_urls(request)
        if request.mode == "fast":
            urls = urls[:1]

        last_error: Exception | None = None
        for url in urls:
            try:
                markdown = await fetch_markdown(url, wait_ms=7000)
                parsed = parse_subito_markdown(markdown, request.brand, request.model)
                all_listings.extend(parsed)
            except Exception as exc:  # noqa: BLE001
                last_error = exc
                continue
        if not all_listings and last_error is not None:
            raise RuntimeError(f"Subito scraping failed: {last_error}") from last_error
        return all_listings

    async def health(self) -> ProviderHealth:
        return ProviderHealth(
            provider=self.info.id,
            enabled=self.info.enabled,
            configured=self.is_configured(),
            error_rate=0.0,
        )
