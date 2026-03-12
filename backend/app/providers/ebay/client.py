import asyncio
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx

from app.core.settings import get_settings


class EbayClient:
    def __init__(self) -> None:
        self.settings = get_settings()
        self._token: str | None = None
        self._token_expires_at: datetime | None = None
        self._base_url = "https://api.ebay.com"
        self._token_url = "https://api.ebay.com/identity/v1/oauth2/token"

    async def _fetch_access_token(self) -> str:
        if self._token and self._token_expires_at and datetime.now(timezone.utc) < self._token_expires_at:
            return self._token

        if not self.settings.ebay_client_id or not self.settings.ebay_client_secret:
            raise RuntimeError("EBAY credentials are not configured")

        timeout = httpx.Timeout(self.settings.request_timeout_seconds)
        auth = (self.settings.ebay_client_id, self.settings.ebay_client_secret)
        data = {
            "grant_type": "client_credentials",
            "scope": "https://api.ebay.com/oauth/api_scope",
        }

        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(
                self._token_url,
                auth=auth,
                data=data,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
            response.raise_for_status()
            payload = response.json()

        access_token = payload.get("access_token")
        expires_in = int(payload.get("expires_in", 7200))
        if not access_token:
            raise RuntimeError("eBay token response missing access_token")

        self._token = access_token
        self._token_expires_at = datetime.now(timezone.utc) + timedelta(seconds=max(60, expires_in - 120))
        return access_token

    async def search_items(
        self,
        *,
        query: str,
        limit: int = 20,
        price_min: int | None = None,
        price_max: int | None = None,
    ) -> dict[str, Any]:
        token = await self._fetch_access_token()
        params: dict[str, str] = {
            "q": query,
            "limit": str(limit),
            "category_ids": "6001",  # Cars & Trucks
        }

        filters: list[str] = []
        if price_min is not None:
            filters.append(f"price:[{price_min}..]")
        if price_max is not None:
            filters.append(f"price:[..{price_max}]")
        if filters:
            params["filter"] = ",".join(filters)

        headers = {
            "Authorization": f"Bearer {token}",
            "X-EBAY-C-MARKETPLACE-ID": self.settings.ebay_marketplace_id,
        }

        timeout = httpx.Timeout(self.settings.request_timeout_seconds)
        attempts = max(self.settings.provider_retry_attempts, 1)
        backoff_ms = max(self.settings.provider_retry_backoff_ms, 0)
        last_error: Exception | None = None
        for attempt in range(1, attempts + 1):
            try:
                async with httpx.AsyncClient(timeout=timeout) as client:
                    response = await client.get(
                        f"{self._base_url}/buy/browse/v1/item_summary/search",
                        params=params,
                        headers=headers,
                    )
                if response.status_code >= 500:
                    raise RuntimeError(f"eBay transient error {response.status_code}")
                response.raise_for_status()
                return response.json()
            except Exception as exc:  # noqa: BLE001
                last_error = exc
                if attempt >= attempts:
                    break
                sleep_seconds = (backoff_ms * attempt) / 1000
                if sleep_seconds > 0:
                    await asyncio.sleep(sleep_seconds)
        raise RuntimeError(f"eBay search failed after {attempts} attempts: {last_error}") from last_error
