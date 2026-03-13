import re

from app.core.settings import get_settings
from app.models.search import SearchRequest
from app.models.vehicle import VehicleListing
from app.providers.base.base_provider import BaseProvider
from app.providers.base.models import ProviderHealth, ProviderInfo
from app.providers.ebay.client import EbayClient


def _parse_price(payload: dict) -> tuple[int | None, str]:
    price = payload.get("price") or {}
    value = price.get("value")
    currency = price.get("currency", "EUR")
    if value is None:
        return None, currency
    try:
        return int(float(value)), currency
    except Exception:  # noqa: BLE001
        return None, currency


def _extract_year_from_text(text: str | None) -> int | None:
    if not text:
        return None
    match = re.search(r"\b(19\d{2}|20\d{2})\b", text)
    if not match:
        return None
    year = int(match.group(1))
    if year < 1990 or year > 2100:
        return None
    return year


class EbayProvider(BaseProvider):
    info = ProviderInfo(
        id="ebay",
        name="eBay Motors",
        provider_type="official_api",
        market="IT",
        supports_filters=[
            "query",
            "brand",
            "model",
            "trim",
            "price_min",
            "price_max",
        ],
    )

    def __init__(self) -> None:
        self.client = EbayClient()

    def is_configured(self) -> bool:
        settings = get_settings()
        if settings.test_stub_mode:
            return True
        return bool(settings.ebay_client_id and settings.ebay_client_secret)

    @staticmethod
    def _build_query(request: SearchRequest) -> str:
        query = request.query or " ".join([request.brand or "", request.model or "", request.trim or ""]).strip()
        return query or "used car"

    @staticmethod
    def _stub_listings(request: SearchRequest) -> list[VehicleListing]:
        model_name = request.model or "320d"
        return [
            VehicleListing(
                provider="ebay",
                market="IT",
                url="https://stub.ebay.local/item-1",
                title=f"BMW {model_name} Stub eBay",
                description="Stub listing for test mode",
                price_amount=24100,
                price_currency="EUR",
                year=2022,
                make=request.brand or "BMW",
                model=model_name,
                mileage_value=38000,
                fuel_type="Diesel",
                transmission="Automatico",
                body_style="Berlina",
                city="Torino",
                country="IT",
                images=["https://images.example.com/ebay-stub.jpg"],
                seller_type="dealer",
            )
        ]

    async def search(self, request: SearchRequest) -> list[VehicleListing]:
        settings = get_settings()
        if settings.test_stub_mode:
            return self._stub_listings(request)
        if not self.is_configured():
            raise RuntimeError("eBay provider is not configured")

        payload = await self.client.search_items(
            query=self._build_query(request),
            limit=20 if request.mode == "fast" else 50,
            price_min=request.price_min,
            price_max=request.price_max,
        )

        listings: list[VehicleListing] = []
        for item in payload.get("itemSummaries", []):
            title = item.get("title")
            if not title:
                continue
            price_amount, currency = _parse_price(item)
            if price_amount is None:
                continue

            url = item.get("itemWebUrl")
            image = (item.get("image") or {}).get("imageUrl")
            make = request.brand
            model = request.model
            if not make and title:
                make = title.split(" ")[0]

            listing = VehicleListing(
                provider="ebay",
                market="IT",
                url=url,
                title=title,
                description=item.get("shortDescription"),
                price_amount=price_amount,
                price_currency=currency or "EUR",
                year=_extract_year_from_text(title),
                make=make,
                model=model,
                mileage_value=None,
                fuel_type=None,
                transmission=None,
                body_style=None,
                seller_type="dealer",
                city=None,
                region=None,
                country="IT",
                images=[image] if image else [],
                raw_payload=item,
            )
            listings.append(listing)
        return listings

    async def health(self) -> ProviderHealth:
        return ProviderHealth(
            provider=self.info.id,
            enabled=self.info.enabled,
            configured=self.is_configured(),
            error_rate=0.0,
        )
