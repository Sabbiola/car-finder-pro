from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

import httpx

from app.core.observability import log_event
from app.core.request_context import get_request_id
from app.core.settings import get_settings
from app.core.metrics import get_runtime_metrics
from app.models.vehicle import VehicleListing


def _parse_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    normalized = value.replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed


class SupabaseRepositoryBase:
    def __init__(self) -> None:
        self.settings = get_settings()
        self._use_stub_storage = bool(
            self.settings.test_stub_mode
            and not (self.settings.supabase_url and self._read_key())
        )
        self._stub_listings_by_id: dict[str, dict[str, Any]] = {}
        self._stub_listings_by_source_url: dict[str, dict[str, Any]] = {}
        self._stub_price_history: dict[str, list[dict[str, Any]]] = {}
        self._stub_user_favorites: dict[str, list[dict[str, Any]]] = {}
        self._stub_user_saved_searches: dict[str, list[dict[str, Any]]] = {}
        self._stub_price_alerts: list[dict[str, Any]] = []
        self._stub_alert_delivery_attempts: list[dict[str, Any]] = []
        self._stub_user_email_by_user_id: dict[str, str] = {}
        if self._use_stub_storage:
            self._initialize_stub_storage()

    def _initialize_stub_storage(self) -> None:
        now_iso = datetime.now(timezone.utc).isoformat()
        listing_rows = [
            self._build_stub_listing_row(
                listing_id="11111111-1111-4111-8111-111111111111",
                source="autoscout24",
                source_url="https://stub.autoscout24.local/listing-1",
                title="BMW 320d Stub AutoScout24",
                price=24900, year=2021, km=42000, city="Milano",
                image_url="https://images.example.com/as24-stub.jpg",
                seller_type="dealer", scraped_at=now_iso,
            ),
            self._build_stub_listing_row(
                listing_id="22222222-2222-4222-8222-222222222222",
                source="subito",
                source_url="https://stub.subito.local/listing-1",
                title="BMW 320d Stub Subito",
                price=25900, year=2020, km=51000, city="Roma",
                image_url="https://images.example.com/subito-stub.jpg",
                seller_type="private", scraped_at=now_iso,
            ),
            self._build_stub_listing_row(
                listing_id="33333333-3333-4333-8333-333333333333",
                source="ebay",
                source_url="https://stub.ebay.local/item-1",
                title="BMW 320d Stub eBay",
                price=24100, year=2022, km=38000, city="Torino",
                image_url="https://images.example.com/ebay-stub.jpg",
                seller_type="dealer", scraped_at=now_iso,
            ),
            self._build_stub_listing_row(
                listing_id="44444444-4444-4444-8444-444444444444",
                source="automobile",
                source_url="https://stub.automobile.local/listing-1",
                title="BMW 320d Stub Automobile.it",
                price=24700, year=2021, km=47000, city="Milano",
                image_url="https://images.example.com/automobile-stub.jpg",
                seller_type="dealer", scraped_at=now_iso,
            ),
            self._build_stub_listing_row(
                listing_id="55555555-5555-4555-8555-555555555555",
                source="brumbrum",
                source_url="https://stub.brumbrum.local/listing-1",
                title="BMW 320d Stub BrumBrum",
                price=25100, year=2022, km=39000, city="Roma",
                image_url="https://images.example.com/brumbrum-stub.jpg",
                seller_type="dealer", scraped_at=now_iso,
            ),
        ]
        for row in listing_rows:
            listing_id = str(row["id"])
            source_url = str(row["source_url"])
            self._stub_listings_by_id[listing_id] = row
            self._stub_listings_by_source_url[source_url] = row
            self._stub_price_history[listing_id] = [
                {"price": int(row["price"]) + 700, "recorded_at": datetime(2026, 1, 10, tzinfo=timezone.utc).isoformat()},
                {"price": int(row["price"]), "recorded_at": datetime(2026, 2, 18, tzinfo=timezone.utc).isoformat()},
            ]
        self._stub_user_email_by_user_id = {"test-user": "test-user@example.com"}

    @staticmethod
    def _build_stub_listing_row(
        *,
        listing_id: str,
        source: str,
        source_url: str,
        title: str,
        price: int,
        year: int,
        km: int,
        city: str,
        image_url: str,
        seller_type: str,
        scraped_at: str,
    ) -> dict[str, Any]:
        return {
            "id": listing_id,
            "source": source,
            "source_url": source_url,
            "title": title,
            "description": "Stub listing for test mode",
            "price": price,
            "year": year,
            "brand": "BMW",
            "model": "320d",
            "trim": "M Sport",
            "km": km,
            "fuel": "Diesel",
            "transmission": "Automatico",
            "body_type": "Berlina",
            "condition": "used",
            "is_new": False,
            "color": "Nero",
            "doors": 4,
            "emission_class": "Euro 6",
            "seller_type": seller_type,
            "location": city,
            "image_url": image_url,
            "image_urls": [image_url],
            "created_at": scraped_at,
            "scraped_at": scraped_at,
            "extra_data": {
                "seller_type": seller_type,
                "seller_name": "Stub Seller",
                "seller_external_id": f"{source}-seller",
                "currency": "EUR",
            },
        }

    def is_configured(self) -> bool:
        return bool(self.settings.supabase_url and self._read_key())

    def _read_key(self) -> str | None:
        return self.settings.supabase_service_role_key or self.settings.supabase_anon_key

    def _write_key(self) -> str | None:
        return self.settings.supabase_service_role_key

    def _headers(self, *, write: bool = False) -> dict[str, str] | None:
        key = self._write_key() if write else self._read_key()
        if not self.settings.supabase_url or not key:
            return None
        headers = {
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        }
        request_id = get_request_id()
        if request_id:
            headers["x-request-id"] = request_id
        return headers

    async def ping(self) -> bool:
        if self._use_stub_storage:
            return True
        if not self.settings.supabase_url:
            return False
        headers = self._headers(write=False)
        if headers is None:
            return False
        try:
            timeout = httpx.Timeout(3.0)
            base_url = self.settings.supabase_url.rstrip("/")
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.request(
                    "GET",
                    f"{base_url}/rest/v1/car_listings",
                    params={"select": "id", "limit": "1"},
                    headers=headers,
                )
            response.raise_for_status()
            return True
        except (httpx.HTTPStatusError, httpx.RequestError):
            return False

    async def _request(
        self,
        method: str,
        table: str,
        *,
        params: dict[str, str] | None = None,
        json_payload: list[dict[str, Any]] | dict[str, Any] | None = None,
        write: bool = False,
        extra_headers: dict[str, str] | None = None,
    ) -> Any:
        headers = self._headers(write=write)
        if headers is None or not self.settings.supabase_url:
            return None
        if extra_headers:
            headers.update(extra_headers)
        timeout = httpx.Timeout(self.settings.request_timeout_seconds)
        base_url = self.settings.supabase_url.rstrip("/")
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.request(
                method,
                f"{base_url}/rest/v1/{table}",
                params=params,
                json=json_payload,
                headers=headers,
            )
        get_runtime_metrics().record_repository_call()
        response.raise_for_status()
        if not response.content:
            return None
        return response.json()

    async def _auth_request(self, method: str, path: str) -> Any:
        write_key = self._write_key()
        if not self.settings.supabase_url or not write_key:
            return None
        headers = {
            "apikey": write_key,
            "Authorization": f"Bearer {write_key}",
            "Content-Type": "application/json",
        }
        request_id = get_request_id()
        if request_id:
            headers["x-request-id"] = request_id
        timeout = httpx.Timeout(self.settings.request_timeout_seconds)
        base_url = self.settings.supabase_url.rstrip("/")
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.request(method, f"{base_url}{path}", headers=headers)
        get_runtime_metrics().record_repository_call()
        if response.status_code >= 400:
            return None
        if not response.content:
            return None
        return response.json()

    @staticmethod
    def row_to_listing(row: dict[str, Any]) -> VehicleListing:
        image_urls = row.get("image_urls") or []
        primary_image = row.get("image_url")
        images = [item for item in [primary_image, *image_urls] if item]
        extra_data = row.get("extra_data") or {}
        seller_type_from_row = row.get("seller_type")
        if not seller_type_from_row and row.get("condition") in {"private", "dealer"}:
            seller_type_from_row = row.get("condition")
        return VehicleListing(
            id=row.get("id"),
            provider=row.get("source", "legacy"),
            market=str(extra_data.get("market") or "IT"),
            url=row.get("source_url"),
            title=row.get("title") or "",
            description=row.get("description"),
            price_amount=int(row.get("price") or 0),
            price_currency=str(extra_data.get("currency") or "EUR"),
            year=row.get("year"),
            make=row.get("brand"),
            model=row.get("model"),
            trim=row.get("trim"),
            mileage_value=row.get("km"),
            fuel_type=row.get("fuel"),
            transmission=row.get("transmission"),
            power=row.get("power"),
            body_style=row.get("body_type"),
            version=row.get("version"),
            seats=row.get("seats"),
            condition=row.get("condition"),
            is_new=row.get("is_new"),
            color=row.get("color"),
            doors=row.get("doors"),
            emission_class=row.get("emission_class"),
            seller_type=extra_data.get("seller_type") or seller_type_from_row,
            seller_name=extra_data.get("seller_name"),
            seller_external_id=extra_data.get("seller_external_id"),
            seller_url=extra_data.get("seller_url"),
            seller_phone_hash=extra_data.get("seller_phone_hash"),
            city=row.get("location"),
            region=extra_data.get("region"),
            country="IT",
            posted_at=_parse_datetime(extra_data.get("posted_at")),
            images=list(dict.fromkeys(images)),
            raw_payload=extra_data.get("raw_payload"),
            listing_hash=extra_data.get("listing_hash"),
            deal_score=extra_data.get("deal_score"),
            reason_codes=list(extra_data.get("reason_codes") or []),
            scraped_at=_parse_datetime(row.get("scraped_at")) or datetime.now(timezone.utc),
        )
