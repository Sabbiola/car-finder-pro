from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from app.core.observability import log_event
from app.models.alerts import ProcessPriceAlertsResponse, ProcessedPriceAlert
from app.services.supabase_market_repository import SupabaseMarketRepository


class PriceAlertProcessor:
    def __init__(self, repository: SupabaseMarketRepository) -> None:
        self.repository = repository

    @staticmethod
    def _extract_listing_price(row: dict[str, Any]) -> int | None:
        listing_rel = row.get("car_listings")
        if isinstance(listing_rel, list):
            listing_rel = listing_rel[0] if listing_rel else None
        if not isinstance(listing_rel, dict):
            return None
        price = listing_rel.get("price")
        if isinstance(price, (int, float)):
            return int(price)
        return None

    async def process(self, *, dry_run: bool, limit: int) -> ProcessPriceAlertsResponse:
        rows = await self.repository.fetch_due_price_alert_rows(limit=limit)
        processed: list[ProcessedPriceAlert] = []
        triggered = 0
        notified = 0
        failed = 0

        for row in rows:
            alert_id = str(row.get("id") or "")
            listing_id = str(row.get("listing_id") or "")
            target_price = int(row.get("target_price") or 0)
            current_price = self._extract_listing_price(row)

            if not alert_id or not listing_id or target_price <= 0:
                failed += 1
                processed.append(
                    ProcessedPriceAlert(
                        alert_id=alert_id or "unknown",
                        listing_id=listing_id or "unknown",
                        target_price=target_price,
                        current_price=current_price,
                        status="failed",
                        reason="invalid_alert_row",
                    )
                )
                continue

            if current_price is None:
                processed.append(
                    ProcessedPriceAlert(
                        alert_id=alert_id,
                        listing_id=listing_id,
                        target_price=target_price,
                        current_price=None,
                        status="skipped",
                        reason="listing_price_missing",
                    )
                )
                continue

            if current_price > target_price:
                processed.append(
                    ProcessedPriceAlert(
                        alert_id=alert_id,
                        listing_id=listing_id,
                        target_price=target_price,
                        current_price=current_price,
                        status="skipped",
                        reason="target_not_reached",
                    )
                )
                continue

            triggered += 1
            now = datetime.now(timezone.utc)
            if dry_run:
                processed.append(
                    ProcessedPriceAlert(
                        alert_id=alert_id,
                        listing_id=listing_id,
                        target_price=target_price,
                        current_price=current_price,
                        status="triggered_dry_run",
                        notified_at=now,
                    )
                )
                continue

            updated = await self.repository.mark_price_alert_notified(
                alert_id=alert_id,
                notified_at=now,
            )
            if not updated:
                failed += 1
                processed.append(
                    ProcessedPriceAlert(
                        alert_id=alert_id,
                        listing_id=listing_id,
                        target_price=target_price,
                        current_price=current_price,
                        status="failed",
                        reason="notify_update_failed",
                    )
                )
                continue

            notified += 1
            log_event(
                "price_alert_triggered",
                alert_id=alert_id,
                listing_id=listing_id,
                target_price=target_price,
                current_price=current_price,
            )
            processed.append(
                ProcessedPriceAlert(
                    alert_id=alert_id,
                    listing_id=listing_id,
                    target_price=target_price,
                    current_price=current_price,
                    status="notified",
                    notified_at=now,
                )
            )

        return ProcessPriceAlertsResponse(
            scanned=len(rows),
            triggered=triggered,
            notified=notified,
            failed=failed,
            dry_run=dry_run,
            items=processed,
        )
