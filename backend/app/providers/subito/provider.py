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
            "price_min",
            "price_max",
            "location",
        ],
    )

    @staticmethod
    def _build_urls(request: SearchRequest) -> list[str]:
        query = request.query or " ".join([request.brand or "", request.model or ""]).strip()
        query = quote_plus(query) if query else ""
        base = (
            f"https://www.subito.it/annunci-italia/vendita/auto/?q={query}"
            if query
            else "https://www.subito.it/annunci-italia/vendita/auto/"
        )
        separator = "&" if "?" in base else "?"
        return [base, f"{base}{separator}o=2", f"{base}{separator}o=3"]

    async def search(self, request: SearchRequest) -> list[VehicleListing]:
        all_listings: list[VehicleListing] = []
        for url in self._build_urls(request):
            markdown = await fetch_markdown(url, wait_ms=7000)
            parsed = parse_subito_markdown(markdown, request.brand, request.model)
            all_listings.extend(parsed)
        return all_listings

    async def health(self) -> ProviderHealth:
        settings = get_settings()
        return ProviderHealth(
            provider=self.info.id,
            enabled=self.info.enabled,
            configured=bool(settings.scrapingbee_api_key),
            error_rate=0.0,
        )
