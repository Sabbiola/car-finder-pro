from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import httpx

from app.core.request_context import get_request_id
from app.core.settings import get_settings
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


class SupabaseMarketRepository:
    def __init__(self) -> None:
        self.settings = get_settings()

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
        response.raise_for_status()
        if not response.content:
            return None
        return response.json()

    @staticmethod
    def row_to_listing(row: dict[str, Any]) -> VehicleListing:
        image_urls = row.get("image_urls") or []
        primary_image = row.get("image_url")
        images = [item for item in [primary_image, *image_urls] if item]
        extra_data = row.get("extra_data") or {}

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
            body_style=row.get("body_type"),
            seller_type=extra_data.get("seller_type") or row.get("condition"),
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

    async def fetch_listing_row_by_id(self, listing_id: str) -> dict[str, Any] | None:
        payload = await self._request(
            "GET",
            "car_listings",
            params={"id": f"eq.{listing_id}", "select": "*", "limit": "1"},
        )
        if not payload:
            return None
        return payload[0]

    async def fetch_listing_row_by_source_url(self, source_url: str) -> dict[str, Any] | None:
        payload = await self._request(
            "GET",
            "car_listings",
            params={"source_url": f"eq.{source_url}", "select": "*", "limit": "1"},
        )
        if not payload:
            return None
        return payload[0]

    async def fetch_comparable_rows(
        self,
        *,
        brand: str,
        model: str,
        year_min: int | None,
        year_max: int | None,
        km_min: int | None,
        km_max: int | None,
        limit: int = 30,
    ) -> list[dict[str, Any]]:
        params: dict[str, str] = {
            "select": "*",
            "brand": f"eq.{brand}",
            "model": f"eq.{model}",
            "order": "scraped_at.desc",
            "limit": str(limit),
        }
        if year_min is not None:
            params["year"] = f"gte.{year_min}"
            params["and"] = f"(year.lte.{year_max if year_max is not None else year_min})"
        if km_min is not None:
            params["km"] = f"gte.{km_min}"
            upper = km_max if km_max is not None else km_min
            if "and" in params:
                params["and"] = params["and"].rstrip(")") + f",km.lte.{upper})"
            else:
                params["and"] = f"(km.lte.{upper})"

        payload = await self._request("GET", "car_listings", params=params)
        return list(payload or [])

    async def fetch_brand_model_rows(
        self,
        *,
        brand: str,
        model: str,
        order_by: str = "price.asc",
        limit: int = 20,
    ) -> list[dict[str, Any]]:
        payload = await self._request(
            "GET",
            "car_listings",
            params={
                "select": "*",
                "brand": f"eq.{brand}",
                "model": f"eq.{model}",
                "order": order_by,
                "limit": str(limit),
            },
        )
        return list(payload or [])

    async def fetch_price_history(self, listing_id: str, limit: int = 30) -> list[dict[str, Any]]:
        payload = await self._request(
            "GET",
            "price_history",
            params={
                "listing_id": f"eq.{listing_id}",
                "select": "price,recorded_at",
                "order": "recorded_at.asc",
                "limit": str(limit),
            },
        )
        return list(payload or [])

    async def fetch_analysis_snapshot(self, snapshot_key: str) -> dict[str, Any] | None:
        payload = await self._request(
            "GET",
            "listing_analysis_snapshots",
            params={"snapshot_key": f"eq.{snapshot_key}", "select": "*", "limit": "1"},
        )
        if not payload:
            return None
        row = payload[0]
        expires_at = _parse_datetime(row.get("expires_at"))
        if expires_at is not None and expires_at < datetime.now(timezone.utc):
            return None
        return row

    async def upsert_analysis_snapshot(
        self,
        *,
        snapshot_key: str,
        listing_id: str | None,
        payload: dict[str, Any],
        expires_at: datetime,
    ) -> None:
        if not self._write_key():
            return
        row = {
            "snapshot_key": snapshot_key,
            "listing_id": listing_id,
            "source": "fastapi",
            "payload": payload,
            "expires_at": expires_at.astimezone(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        await self._request(
            "POST",
            "listing_analysis_snapshots",
            params={"on_conflict": "snapshot_key"},
            json_payload=[row],
            write=True,
            extra_headers={"Prefer": "resolution=merge-duplicates,return=minimal"},
        )

    async def fetch_image_reuse_count(self, listing_hash: str) -> int:
        if not listing_hash:
            return 0
        payload = await self._request(
            "GET",
            "listing_image_fingerprints",
            params={"listing_hash": f"eq.{listing_hash}", "select": "fingerprint_hash"},
        )
        if not payload:
            return 0
        fingerprints = [row.get("fingerprint_hash") for row in payload if row.get("fingerprint_hash")]
        if not fingerprints:
            return 0

        total = 0
        for fingerprint in set(fingerprints):
            matches = await self._request(
                "GET",
                "listing_image_fingerprints",
                params={"fingerprint_hash": f"eq.{fingerprint}", "select": "id"},
            )
            total += max(0, len(matches or []) - 1)
        return total

    async def fetch_seller_fingerprint_stats(
        self,
        *,
        seller_external_id: str | None,
        seller_phone_hash: str | None,
        seller_url: str | None,
    ) -> dict[str, Any]:
        if not any([seller_external_id, seller_phone_hash, seller_url]):
            return {"listing_count": 0, "private_count": 0, "dealer_count": 0}
        filters = [item for item in [seller_external_id, seller_phone_hash, seller_url] if item]
        payload = await self._request("GET", "seller_fingerprints", params={"select": "*", "limit": "50"})
        rows = list(payload or [])
        matched = [
            row
            for row in rows
            if row.get("seller_external_id") in filters
            or row.get("seller_phone_hash") in filters
            or row.get("seller_url") in filters
        ]
        return {
            "listing_count": len(matched),
            "private_count": sum(1 for row in matched if row.get("seller_type") == "private"),
            "dealer_count": sum(1 for row in matched if row.get("seller_type") == "dealer"),
        }

    async def fetch_price_alert_rows(
        self,
        *,
        user_id: str | None = None,
        client_id: str | None = None,
        active_only: bool = False,
        limit: int = 200,
    ) -> list[dict[str, Any]]:
        if not user_id and not client_id:
            return []
        params: dict[str, str] = {
            "select": "id,listing_id,target_price,is_active,notified_at,created_at,user_id,client_id,car_listings(title,price,image_url,source_url)",
            "order": "created_at.desc",
            "limit": str(limit),
        }
        if user_id:
            params["user_id"] = f"eq.{user_id}"
        if client_id and not user_id:
            params["client_id"] = f"eq.{client_id}"
        if active_only:
            params["is_active"] = "eq.true"

        payload = await self._request("GET", "price_alerts", params=params)
        return list(payload or [])

    async def find_matching_price_alert(
        self,
        *,
        listing_id: str,
        target_price: int,
        user_id: str | None = None,
        client_id: str | None = None,
    ) -> dict[str, Any] | None:
        if not user_id and not client_id:
            return None
        params: dict[str, str] = {
            "select": "id,listing_id,target_price,is_active,notified_at,created_at,user_id,client_id,car_listings(title,price,image_url,source_url)",
            "listing_id": f"eq.{listing_id}",
            "target_price": f"eq.{target_price}",
            "is_active": "eq.true",
            "limit": "1",
        }
        if user_id:
            params["user_id"] = f"eq.{user_id}"
        elif client_id:
            params["client_id"] = f"eq.{client_id}"

        payload = await self._request("GET", "price_alerts", params=params)
        if not payload:
            return None
        return payload[0]

    async def create_price_alert(
        self,
        *,
        listing_id: str,
        target_price: int,
        user_id: str | None = None,
        client_id: str | None = None,
    ) -> dict[str, Any] | None:
        row = {
            "listing_id": listing_id,
            "target_price": target_price,
            "is_active": True,
            "user_id": user_id,
            "client_id": client_id,
        }
        payload = await self._request(
            "POST",
            "price_alerts",
            json_payload=[row],
            write=True,
            extra_headers={"Prefer": "return=representation"},
        )
        if not payload:
            return None
        created = payload[0]
        created_id = created.get("id")
        if not created_id:
            return created
        complete = await self._request(
            "GET",
            "price_alerts",
            params={
                "id": f"eq.{created_id}",
                "select": "id,listing_id,target_price,is_active,notified_at,created_at,user_id,client_id,car_listings(title,price,image_url,source_url)",
                "limit": "1",
            },
        )
        if complete:
            return complete[0]
        return created

    async def deactivate_price_alert(
        self,
        *,
        alert_id: str,
        user_id: str | None = None,
        client_id: str | None = None,
    ) -> dict[str, Any] | None:
        params: dict[str, str] = {"id": f"eq.{alert_id}"}
        if user_id:
            params["user_id"] = f"eq.{user_id}"
        elif client_id:
            params["client_id"] = f"eq.{client_id}"

        payload = await self._request(
            "PATCH",
            "price_alerts",
            params=params,
            json_payload={"is_active": False},
            write=True,
            extra_headers={"Prefer": "return=representation"},
        )
        if not payload:
            return None
        row = payload[0]
        row_id = row.get("id")
        if not row_id:
            return row
        complete = await self._request(
            "GET",
            "price_alerts",
            params={
                "id": f"eq.{row_id}",
                "select": "id,listing_id,target_price,is_active,notified_at,created_at,user_id,client_id,car_listings(title,price,image_url,source_url)",
                "limit": "1",
            },
        )
        if complete:
            return complete[0]
        return row

    async def fetch_due_price_alert_rows(self, *, limit: int = 200) -> list[dict[str, Any]]:
        payload = await self._request(
            "GET",
            "price_alerts",
            params={
                "select": "id,listing_id,target_price,is_active,notified_at,created_at,user_id,client_id,car_listings(price,title,image_url,source_url)",
                "is_active": "eq.true",
                "notified_at": "is.null",
                "order": "created_at.asc",
                "limit": str(limit),
            },
        )
        return list(payload or [])

    async def mark_price_alert_notified(
        self,
        *,
        alert_id: str,
        notified_at: datetime,
    ) -> bool:
        payload = await self._request(
            "PATCH",
            "price_alerts",
            params={
                "id": f"eq.{alert_id}",
                "is_active": "eq.true",
                "notified_at": "is.null",
            },
            json_payload={
                "is_active": False,
                "notified_at": notified_at.astimezone(timezone.utc).isoformat(),
            },
            write=True,
            extra_headers={"Prefer": "return=representation"},
        )
        return bool(payload)
