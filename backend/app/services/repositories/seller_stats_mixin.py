from __future__ import annotations

from typing import Any


class SellerStatsMixin:
    @staticmethod
    def seller_stats_key(
        *,
        seller_external_id: str | None,
        seller_phone_hash: str | None,
        seller_url: str | None,
    ) -> str | None:
        values = [seller_external_id or "", seller_phone_hash or "", seller_url or ""]
        if not any(values):
            return None
        return "|".join(values)

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
        payload = await self._request("GET", "seller_fingerprints", params={"select": "*", "limit": "50"})  # type: ignore[attr-defined]
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

    async def fetch_seller_fingerprint_stats_bulk(
        self,
        seller_inputs: list[tuple[str | None, str | None, str | None]],
    ) -> dict[str, dict[str, Any]]:
        keys = [
            self.seller_stats_key(
                seller_external_id=seller_external_id,
                seller_phone_hash=seller_phone_hash,
                seller_url=seller_url,
            )
            for seller_external_id, seller_phone_hash, seller_url in seller_inputs
        ]
        requested_keys = [key for key in keys if key]
        if not requested_keys:
            return {}

        payload = await self._request(  # type: ignore[attr-defined]
            "GET",
            "seller_fingerprints",
            params={
                "select": "seller_external_id,seller_phone_hash,seller_url,seller_type",
                "limit": "2000",
            },
        )
        rows = list(payload or [])
        result: dict[str, dict[str, Any]] = {}
        for key in requested_keys:
            seller_external_id, seller_phone_hash, seller_url = key.split("|")
            selected_values = {item for item in [seller_external_id, seller_phone_hash, seller_url] if item}
            if not selected_values:
                continue
            matched = [
                row
                for row in rows
                if row.get("seller_external_id") in selected_values
                or row.get("seller_phone_hash") in selected_values
                or row.get("seller_url") in selected_values
            ]
            result[key] = {
                "listing_count": len(matched),
                "private_count": sum(1 for row in matched if row.get("seller_type") == "private"),
                "dealer_count": sum(1 for row in matched if row.get("seller_type") == "dealer"),
            }
        return result
