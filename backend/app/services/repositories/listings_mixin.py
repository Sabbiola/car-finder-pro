from __future__ import annotations

from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    pass


class ListingsMixin:
    async def fetch_listing_row_by_id(self, listing_id: str) -> dict[str, Any] | None:
        if self._use_stub_storage:  # type: ignore[attr-defined]
            return self._stub_listings_by_id.get(listing_id)  # type: ignore[attr-defined]
        payload = await self._request(  # type: ignore[attr-defined]
            "GET",
            "car_listings",
            params={"id": f"eq.{listing_id}", "select": "*", "limit": "1"},
        )
        if not payload:
            return None
        return payload[0]

    async def fetch_listing_row_by_source_url(self, source_url: str) -> dict[str, Any] | None:
        if self._use_stub_storage:  # type: ignore[attr-defined]
            return self._stub_listings_by_source_url.get(source_url)  # type: ignore[attr-defined]
        payload = await self._request(  # type: ignore[attr-defined]
            "GET",
            "car_listings",
            params={"source_url": f"eq.{source_url}", "select": "*", "limit": "1"},
        )
        if not payload:
            return None
        return payload[0]

    async def fetch_listing_rows_by_ids(self, listing_ids: list[str]) -> list[dict[str, Any]]:
        cleaned = [item for item in dict.fromkeys(listing_ids) if item]
        if not cleaned:
            return []
        if self._use_stub_storage:  # type: ignore[attr-defined]
            return [self._stub_listings_by_id[item] for item in cleaned if item in self._stub_listings_by_id]  # type: ignore[attr-defined]
        selector = ",".join(cleaned)
        payload = await self._request(  # type: ignore[attr-defined]
            "GET",
            "car_listings",
            params={
                "id": f"in.({selector})",
                "select": "*",
                "limit": str(min(500, len(cleaned))),
            },
        )
        return list(payload or [])

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
        if self._use_stub_storage:  # type: ignore[attr-defined]
            def is_match(row: dict[str, Any]) -> bool:
                if str(row.get("brand") or "").lower() != brand.lower():
                    return False
                if str(row.get("model") or "").lower() != model.lower():
                    return False
                year = row.get("year")
                km = row.get("km")
                if year_min is not None and (year is None or int(year) < year_min):
                    return False
                if year_max is not None and (year is None or int(year) > year_max):
                    return False
                if km_min is not None and (km is None or int(km) < km_min):
                    return False
                if km_max is not None and (km is None or int(km) > km_max):
                    return False
                return True

            rows = [row for row in self._stub_listings_by_id.values() if is_match(row)]  # type: ignore[attr-defined]
            rows.sort(key=lambda item: str(item.get("scraped_at") or ""), reverse=True)
            return rows[:limit]

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

        payload = await self._request("GET", "car_listings", params=params)  # type: ignore[attr-defined]
        return list(payload or [])

    async def fetch_brand_model_rows(
        self,
        *,
        brand: str,
        model: str,
        order_by: str = "price.asc",
        limit: int = 20,
    ) -> list[dict[str, Any]]:
        if self._use_stub_storage:  # type: ignore[attr-defined]
            rows = [
                row
                for row in self._stub_listings_by_id.values()  # type: ignore[attr-defined]
                if str(row.get("brand") or "").lower() == brand.lower()
                and str(row.get("model") or "").lower() == model.lower()
            ]
            if order_by == "price.asc":
                rows.sort(key=lambda item: int(item.get("price") or 0))
            elif order_by == "price.desc":
                rows.sort(key=lambda item: int(item.get("price") or 0), reverse=True)
            return rows[:limit]

        payload = await self._request(  # type: ignore[attr-defined]
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
        if self._use_stub_storage:  # type: ignore[attr-defined]
            return list(self._stub_price_history.get(listing_id, []))[:limit]  # type: ignore[attr-defined]
        payload = await self._request(  # type: ignore[attr-defined]
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
