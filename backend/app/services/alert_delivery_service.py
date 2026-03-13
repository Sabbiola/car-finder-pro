from __future__ import annotations

from typing import Any

import httpx

from app.core.settings import get_settings
from app.services.supabase_market_repository import SupabaseMarketRepository


class AlertDeliveryService:
    def __init__(self, repository: SupabaseMarketRepository) -> None:
        self.repository = repository
        self.settings = get_settings()

    async def _send_email(
        self,
        *,
        to_email: str,
        listing_title: str,
        target_price: int,
        current_price: int,
        source_url: str | None,
    ) -> tuple[bool, str | None]:
        if not self.settings.resend_api_key or not self.settings.resend_from_email:
            return False, "resend_not_configured"
        link_block = f'<p><a href="{source_url}">Apri annuncio</a></p>' if source_url else ""
        payload = {
            "from": self.settings.resend_from_email,
            "to": [to_email],
            "subject": "CarFinder Pro: alert prezzo raggiunto",
            "html": (
                "<p>La tua alert prezzo e' stata attivata.</p>"
                f"<p><strong>{listing_title}</strong></p>"
                f"<p>Prezzo attuale: EUR {current_price}</p>"
                f"<p>Target: EUR {target_price}</p>"
                f"{link_block}"
            ),
        }
        headers = {
            "Authorization": f"Bearer {self.settings.resend_api_key}",
            "Content-Type": "application/json",
        }
        timeout = httpx.Timeout(self.settings.request_timeout_seconds)
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(
                f"{self.settings.resend_base_url.rstrip('/')}/emails",
                json=payload,
                headers=headers,
            )
        if response.status_code >= 400:
            return False, f"resend_http_{response.status_code}"
        return True, None

    @staticmethod
    def _extract_listing(row: dict[str, Any]) -> dict[str, Any]:
        listing_rel = row.get("car_listings")
        if isinstance(listing_rel, list):
            return listing_rel[0] if listing_rel else {}
        if isinstance(listing_rel, dict):
            return listing_rel
        return {}

    async def deliver(self, row: dict[str, Any]) -> dict[str, Any]:
        listing = self._extract_listing(row)
        current_price_raw = listing.get("price")
        current_price = int(current_price_raw) if isinstance(current_price_raw, (int, float)) else None
        target_price = int(row.get("target_price") or 0)
        listing_title = str(listing.get("title") or "Annuncio auto")
        source_url = listing.get("source_url")

        user_id = row.get("user_id")
        if user_id and self.settings.resend_api_key and self.settings.resend_from_email:
            email = await self.repository.fetch_user_email(str(user_id))
            if not email:
                return {
                    "delivered": False,
                    "channel": "email",
                    "error": "user_email_missing",
                }
            if current_price is None:
                return {
                    "delivered": False,
                    "channel": "email",
                    "error": "listing_price_missing",
                }
            delivered, error = await self._send_email(
                to_email=email,
                listing_title=listing_title,
                target_price=target_price,
                current_price=current_price,
                source_url=source_url if isinstance(source_url, str) else None,
            )
            return {
                "delivered": delivered,
                "channel": "email",
                "error": error,
            }

        # In-app state is derived from delivery attempts table even without email delivery.
        return {
            "delivered": True,
            "channel": "in_app",
            "error": None,
        }
