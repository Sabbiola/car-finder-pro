from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

import httpx

from app.core.observability import log_event


class AlertsMixin:
    async def fetch_price_alert_rows(
        self,
        *,
        user_id: str | None = None,
        client_id: str | None = None,
        active_only: bool = False,
        limit: int = 100,
        offset: int = 0,
    ) -> list[dict[str, Any]]:
        if self._use_stub_storage:  # type: ignore[attr-defined]
            if not user_id and not client_id:
                return []

            def include_row(row: dict[str, Any]) -> bool:
                if user_id and str(row.get("user_id") or "") != user_id:
                    return False
                if client_id and not user_id and str(row.get("client_id") or "") != client_id:
                    return False
                if active_only and not bool(row.get("is_active")):
                    return False
                return True

            rows = [row for row in self._stub_price_alerts if include_row(row)]  # type: ignore[attr-defined]
            rows.sort(key=lambda item: str(item.get("created_at") or ""), reverse=True)
            return rows[offset : offset + limit]

        if not user_id and not client_id:
            return []
        params: dict[str, str] = {
            "select": "id,listing_id,target_price,is_active,notified_at,created_at,user_id,client_id,car_listings(title,price,image_url,source_url)",
            "order": "created_at.desc",
            "limit": str(max(1, min(limit, 500))),
            "offset": str(max(0, offset)),
        }
        if user_id:
            params["user_id"] = f"eq.{user_id}"
        if client_id and not user_id:
            params["client_id"] = f"eq.{client_id}"
        if active_only:
            params["is_active"] = "eq.true"
        payload = await self._request("GET", "price_alerts", params=params)  # type: ignore[attr-defined]
        return list(payload or [])

    async def find_matching_price_alert(
        self,
        *,
        listing_id: str,
        target_price: int,
        user_id: str | None = None,
        client_id: str | None = None,
    ) -> dict[str, Any] | None:
        if self._use_stub_storage:  # type: ignore[attr-defined]
            for row in self._stub_price_alerts:  # type: ignore[attr-defined]
                if str(row.get("listing_id") or "") != listing_id:
                    continue
                if int(row.get("target_price") or 0) != target_price:
                    continue
                if user_id and str(row.get("user_id") or "") != user_id:
                    continue
                if client_id and not user_id and str(row.get("client_id") or "") != client_id:
                    continue
                if bool(row.get("is_active")):
                    return row
            return None

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
        payload = await self._request("GET", "price_alerts", params=params)  # type: ignore[attr-defined]
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
        if self._use_stub_storage:  # type: ignore[attr-defined]
            listing = self._stub_listings_by_id.get(listing_id)  # type: ignore[attr-defined]
            row = {
                "id": str(uuid4()),
                "listing_id": listing_id,
                "target_price": target_price,
                "is_active": True,
                "notified_at": None,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "user_id": user_id,
                "client_id": client_id,
                "car_listings": {
                    "title": str((listing or {}).get("title") or "Annuncio"),
                    "price": int((listing or {}).get("price") or 0),
                    "image_url": (listing or {}).get("image_url"),
                    "source_url": (listing or {}).get("source_url"),
                },
            }
            self._stub_price_alerts.append(row)  # type: ignore[attr-defined]
            return row

        row = {
            "listing_id": listing_id,
            "target_price": target_price,
            "is_active": True,
            "user_id": user_id,
            "client_id": client_id,
        }
        payload = await self._request(  # type: ignore[attr-defined]
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
        complete = await self._request(  # type: ignore[attr-defined]
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
        if self._use_stub_storage:  # type: ignore[attr-defined]
            for row in self._stub_price_alerts:  # type: ignore[attr-defined]
                if str(row.get("id") or "") != alert_id:
                    continue
                if user_id and str(row.get("user_id") or "") != user_id:
                    continue
                if client_id and not user_id and str(row.get("client_id") or "") != client_id:
                    continue
                row["is_active"] = False
                return row
            return None

        params: dict[str, str] = {"id": f"eq.{alert_id}"}
        if user_id:
            params["user_id"] = f"eq.{user_id}"
        elif client_id:
            params["client_id"] = f"eq.{client_id}"
        payload = await self._request(  # type: ignore[attr-defined]
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
        complete = await self._request(  # type: ignore[attr-defined]
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
        if self._use_stub_storage:  # type: ignore[attr-defined]
            rows = [
                row
                for row in self._stub_price_alerts  # type: ignore[attr-defined]
                if bool(row.get("is_active")) and row.get("notified_at") is None
            ]
            rows.sort(key=lambda item: str(item.get("created_at") or ""))
            return rows[:limit]

        payload = await self._request(  # type: ignore[attr-defined]
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

    async def fetch_latest_delivery_attempts(
        self, alert_ids: list[str]
    ) -> dict[str, dict[str, Any]]:
        if self._use_stub_storage:  # type: ignore[attr-defined]
            cleaned = {item for item in alert_ids if item}
            latest: dict[str, dict[str, Any]] = {}
            rows = sorted(
                self._stub_alert_delivery_attempts,  # type: ignore[attr-defined]
                key=lambda item: str(item.get("created_at") or ""),
                reverse=True,
            )
            for row in rows:
                alert_id = str(row.get("alert_id") or "")
                if not alert_id or alert_id not in cleaned or alert_id in latest:
                    continue
                latest[alert_id] = row
            return latest

        cleaned = sorted({item for item in alert_ids if item})
        if not cleaned:
            return {}
        selector = ",".join(cleaned)
        try:
            payload = await self._request(  # type: ignore[attr-defined]
                "GET",
                "alert_delivery_attempts",
                params={
                    "alert_id": f"in.({selector})",
                    "select": "alert_id,attempt_number,status,error_message,created_at,next_retry_at,idempotency_key,delivered_at",
                    "order": "created_at.desc",
                    "limit": str(max(200, len(cleaned) * 5)),
                },
            )
        except httpx.HTTPStatusError as exc:
            log_event("repository_error", operation="fetch_latest_delivery_attempts", error=str(exc), status_code=exc.response.status_code)
            return {}
        except httpx.RequestError as exc:
            log_event("repository_error", operation="fetch_latest_delivery_attempts", error=str(exc))
            return {}
        latest: dict[str, dict[str, Any]] = {}
        for row in list(payload or []):
            alert_id = str(row.get("alert_id") or "")
            if not alert_id or alert_id in latest:
                continue
            latest[alert_id] = row
        return latest

    async def fetch_alert_delivery_attempt_rows(
        self, *, limit: int = 500, since_iso: str | None = None
    ) -> list[dict[str, Any]]:
        if self._use_stub_storage:  # type: ignore[attr-defined]
            rows = sorted(
                self._stub_alert_delivery_attempts,  # type: ignore[attr-defined]
                key=lambda item: str(item.get("created_at") or ""),
                reverse=True,
            )
            if since_iso:
                rows = [row for row in rows if str(row.get("created_at") or "") >= since_iso]
            return rows[: max(1, min(limit, 5000))]

        params: dict[str, str] = {
            "select": "alert_id,attempt_number,status,channel,error_message,created_at,idempotency_key,next_retry_at,delivered_at",
            "order": "created_at.desc",
            "limit": str(max(1, min(limit, 5000))),
        }
        if since_iso:
            params["created_at"] = f"gte.{since_iso}"
        try:
            payload = await self._request("GET", "alert_delivery_attempts", params=params)  # type: ignore[attr-defined]
        except httpx.HTTPStatusError as exc:
            log_event("repository_error", operation="fetch_alert_delivery_attempt_rows", error=str(exc), status_code=exc.response.status_code)
            return []
        except httpx.RequestError as exc:
            log_event("repository_error", operation="fetch_alert_delivery_attempt_rows", error=str(exc))
            return []
        return list(payload or [])

    async def count_delivery_attempts_by_run(self, run_id: str) -> int:
        if self._use_stub_storage:  # type: ignore[attr-defined]
            return sum(
                1
                for row in self._stub_alert_delivery_attempts  # type: ignore[attr-defined]
                if str(row.get("idempotency_key") or "") == run_id
            )
        if not run_id:
            return 0
        try:
            payload = await self._request(  # type: ignore[attr-defined]
                "GET",
                "alert_delivery_attempts",
                params={"idempotency_key": f"eq.{run_id}", "select": "id", "limit": "1"},
            )
        except httpx.HTTPStatusError as exc:
            log_event("repository_error", operation="count_delivery_attempts_by_run", error=str(exc), status_code=exc.response.status_code)
            return 0
        except httpx.RequestError as exc:
            log_event("repository_error", operation="count_delivery_attempts_by_run", error=str(exc))
            return 0
        return len(payload or [])

    async def create_alert_delivery_attempt(
        self,
        *,
        alert_id: str,
        attempt_number: int,
        status: str,
        channel: str | None,
        error_message: str | None,
        next_retry_at: datetime | None,
        delivered_at: datetime | None,
        idempotency_key: str,
        meta: dict[str, Any] | None = None,
    ) -> None:
        if self._use_stub_storage:  # type: ignore[attr-defined]
            self._stub_alert_delivery_attempts.append(  # type: ignore[attr-defined]
                {
                    "alert_id": alert_id,
                    "attempt_number": attempt_number,
                    "status": status,
                    "channel": channel,
                    "error_message": error_message,
                    "next_retry_at": next_retry_at.astimezone(timezone.utc).isoformat() if next_retry_at else None,
                    "delivered_at": delivered_at.astimezone(timezone.utc).isoformat() if delivered_at else None,
                    "idempotency_key": idempotency_key,
                    "meta": meta or {},
                    "created_at": datetime.now(timezone.utc).isoformat(),
                }
            )
            return

        if not self._write_key():  # type: ignore[attr-defined]
            return
        row = {
            "alert_id": alert_id,
            "attempt_number": attempt_number,
            "status": status,
            "channel": channel,
            "error_message": error_message,
            "next_retry_at": next_retry_at.astimezone(timezone.utc).isoformat() if next_retry_at else None,
            "delivered_at": delivered_at.astimezone(timezone.utc).isoformat() if delivered_at else None,
            "idempotency_key": idempotency_key,
            "meta": meta or {},
        }
        try:
            await self._request(  # type: ignore[attr-defined]
                "POST",
                "alert_delivery_attempts",
                json_payload=[row],
                write=True,
                extra_headers={"Prefer": "return=minimal"},
            )
        except httpx.HTTPStatusError as exc:
            log_event("repository_error", operation="create_alert_delivery_attempt", error=str(exc), status_code=exc.response.status_code)
        except httpx.RequestError as exc:
            log_event("repository_error", operation="create_alert_delivery_attempt", error=str(exc))

    async def mark_price_alert_notified(self, *, alert_id: str, notified_at: datetime) -> bool:
        if self._use_stub_storage:  # type: ignore[attr-defined]
            for row in self._stub_price_alerts:  # type: ignore[attr-defined]
                if str(row.get("id") or "") != alert_id:
                    continue
                if not bool(row.get("is_active")) or row.get("notified_at") is not None:
                    return False
                row["is_active"] = False
                row["notified_at"] = notified_at.astimezone(timezone.utc).isoformat()
                return True
            return False

        payload = await self._request(  # type: ignore[attr-defined]
            "PATCH",
            "price_alerts",
            params={"id": f"eq.{alert_id}", "is_active": "eq.true", "notified_at": "is.null"},
            json_payload={"is_active": False, "notified_at": notified_at.astimezone(timezone.utc).isoformat()},
            write=True,
            extra_headers={"Prefer": "return=representation"},
        )
        return bool(payload)
