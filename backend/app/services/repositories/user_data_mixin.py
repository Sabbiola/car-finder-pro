from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import uuid4


class UserDataMixin:
    async def fetch_user_favorite_rows(
        self, *, user_id: str, limit: int = 100, offset: int = 0
    ) -> list[dict[str, Any]]:
        if self._use_stub_storage:  # type: ignore[attr-defined]
            rows = list(self._stub_user_favorites.get(user_id, []))  # type: ignore[attr-defined]
            rows.sort(key=lambda item: str(item.get("created_at") or ""), reverse=True)
            return rows[offset : offset + limit]
        payload = await self._request(  # type: ignore[attr-defined]
            "GET",
            "user_favorites",
            params={
                "user_id": f"eq.{user_id}",
                "select": "id,listing_id,created_at",
                "order": "created_at.desc",
                "limit": str(max(1, min(limit, 500))),
                "offset": str(max(0, offset)),
            },
            write=True,
        )
        return list(payload or [])

    async def add_user_favorite(self, *, user_id: str, listing_id: str) -> dict[str, Any] | None:
        if self._use_stub_storage:  # type: ignore[attr-defined]
            existing_rows = self._stub_user_favorites.setdefault(user_id, [])  # type: ignore[attr-defined]
            existing = next(
                (row for row in existing_rows if str(row.get("listing_id") or "") == listing_id),
                None,
            )
            if existing:
                return existing
            row = {
                "id": str(uuid4()),
                "user_id": user_id,
                "listing_id": listing_id,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            existing_rows.insert(0, row)
            return row
        payload = await self._request(  # type: ignore[attr-defined]
            "POST",
            "user_favorites",
            params={"on_conflict": "user_id,listing_id"},
            json_payload=[{"user_id": user_id, "listing_id": listing_id}],
            write=True,
            extra_headers={"Prefer": "resolution=merge-duplicates,return=representation"},
        )
        if not payload:
            return None
        return payload[0]

    async def remove_user_favorite(self, *, user_id: str, listing_id: str) -> bool:
        if self._use_stub_storage:  # type: ignore[attr-defined]
            rows = self._stub_user_favorites.get(user_id, [])  # type: ignore[attr-defined]
            before = len(rows)
            self._stub_user_favorites[user_id] = [  # type: ignore[attr-defined]
                row for row in rows if str(row.get("listing_id") or "") != listing_id
            ]
            return len(self._stub_user_favorites[user_id]) != before  # type: ignore[attr-defined]
        payload = await self._request(  # type: ignore[attr-defined]
            "DELETE",
            "user_favorites",
            params={"user_id": f"eq.{user_id}", "listing_id": f"eq.{listing_id}"},
            write=True,
            extra_headers={"Prefer": "return=representation"},
        )
        return bool(payload)

    async def fetch_user_saved_search_rows(
        self, *, user_id: str, limit: int = 20, offset: int = 0
    ) -> list[dict[str, Any]]:
        if self._use_stub_storage:  # type: ignore[attr-defined]
            rows = list(self._stub_user_saved_searches.get(user_id, []))  # type: ignore[attr-defined]
            rows.sort(key=lambda item: str(item.get("created_at") or ""), reverse=True)
            return rows[offset : offset + limit]
        payload = await self._request(  # type: ignore[attr-defined]
            "GET",
            "user_saved_searches",
            params={
                "user_id": f"eq.{user_id}",
                "select": "id,name,filters,created_at",
                "order": "created_at.desc",
                "limit": str(max(1, min(limit, 100))),
                "offset": str(max(0, offset)),
            },
            write=True,
        )
        return list(payload or [])

    async def create_user_saved_search(
        self,
        *,
        user_id: str,
        name: str,
        filters: dict[str, Any],
    ) -> dict[str, Any] | None:
        if self._use_stub_storage:  # type: ignore[attr-defined]
            row = {
                "id": str(uuid4()),
                "user_id": user_id,
                "name": name,
                "filters": filters,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            self._stub_user_saved_searches.setdefault(user_id, []).insert(0, row)  # type: ignore[attr-defined]
            return row
        payload = await self._request(  # type: ignore[attr-defined]
            "POST",
            "user_saved_searches",
            json_payload=[{"user_id": user_id, "name": name, "filters": filters}],
            write=True,
            extra_headers={"Prefer": "return=representation"},
        )
        if not payload:
            return None
        return payload[0]

    async def delete_user_saved_search(self, *, user_id: str, search_id: str) -> bool:
        if self._use_stub_storage:  # type: ignore[attr-defined]
            rows = self._stub_user_saved_searches.get(user_id, [])  # type: ignore[attr-defined]
            before = len(rows)
            self._stub_user_saved_searches[user_id] = [  # type: ignore[attr-defined]
                row for row in rows if str(row.get("id") or "") != search_id
            ]
            return len(self._stub_user_saved_searches[user_id]) != before  # type: ignore[attr-defined]
        payload = await self._request(  # type: ignore[attr-defined]
            "DELETE",
            "user_saved_searches",
            params={"id": f"eq.{search_id}", "user_id": f"eq.{user_id}"},
            write=True,
            extra_headers={"Prefer": "return=representation"},
        )
        return bool(payload)

    async def fetch_user_email(self, user_id: str) -> str | None:
        if self._use_stub_storage:  # type: ignore[attr-defined]
            if not user_id:
                return None
            if user_id in self._stub_user_email_by_user_id:  # type: ignore[attr-defined]
                return self._stub_user_email_by_user_id[user_id]  # type: ignore[attr-defined]
            return f"{user_id}@example.com"
        if not user_id:
            return None
        payload = await self._auth_request("GET", f"/auth/v1/admin/users/{user_id}")  # type: ignore[attr-defined]
        if not isinstance(payload, dict):
            return None
        user_obj = payload.get("user")
        if isinstance(user_obj, dict):
            email = user_obj.get("email")
            return str(email) if email else None
        email = payload.get("email")
        return str(email) if email else None
