from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import uuid4

from app.core.observability import log_event
from app.core.settings import get_settings
from app.models.alerts import ProcessPriceAlertsResponse, ProcessedPriceAlert
from app.services.alert_delivery_service import AlertDeliveryService
from app.services.supabase_market_repository import SupabaseMarketRepository, _parse_datetime


class PriceAlertProcessor:
    def __init__(self, repository: SupabaseMarketRepository) -> None:
        self.repository = repository
        self.settings = get_settings()
        self.delivery_service = AlertDeliveryService(repository)

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

    def _next_retry_at(self, *, attempt_number: int, now: datetime) -> datetime:
        base = max(1, self.settings.alerts_retry_base_seconds)
        seconds = base * (2 ** max(0, attempt_number - 1))
        return now + timedelta(seconds=seconds)

    def _can_retry(self, latest_attempt: dict[str, Any] | None, now: datetime) -> bool:
        if not latest_attempt:
            return True
        status = str(latest_attempt.get("status") or "")
        if status == "success":
            return False
        attempt_number = int(latest_attempt.get("attempt_number") or 0)
        if attempt_number >= self.settings.alerts_retry_max_attempts:
            return False
        next_retry_at = _parse_datetime(latest_attempt.get("next_retry_at"))
        if next_retry_at is None:
            return True
        return next_retry_at <= now

    async def _latest_attempts(self, alert_ids: list[str]) -> dict[str, dict[str, Any]]:
        method = getattr(self.repository, "fetch_latest_delivery_attempts", None)
        if method is None:
            return {}
        return await method(alert_ids)

    async def _count_attempts_by_run(self, run_id: str) -> int:
        method = getattr(self.repository, "count_delivery_attempts_by_run", None)
        if method is None:
            return 0
        return int(await method(run_id))

    async def _create_attempt(
        self,
        *,
        alert_id: str,
        attempt_number: int,
        status: str,
        channel: str | None,
        error_message: str | None,
        next_retry_at: datetime | None,
        delivered_at: datetime | None,
        run_id: str,
        meta: dict[str, Any] | None = None,
    ) -> None:
        method = getattr(self.repository, "create_alert_delivery_attempt", None)
        if method is None:
            return
        await method(
            alert_id=alert_id,
            attempt_number=attempt_number,
            status=status,
            channel=channel,
            error_message=error_message,
            next_retry_at=next_retry_at,
            delivered_at=delivered_at,
            idempotency_key=run_id,
            meta=meta,
        )

    async def process(
        self,
        *,
        dry_run: bool,
        limit: int,
        idempotency_key: str | None = None,
    ) -> ProcessPriceAlertsResponse:
        run_id = (idempotency_key or "").strip() or str(uuid4())
        if idempotency_key and await self._count_attempts_by_run(run_id) > 0:
            return ProcessPriceAlertsResponse(
                run_id=run_id,
                idempotent_replay=True,
                scanned=0,
                triggered=0,
                notified=0,
                failed=0,
                dry_run=dry_run,
                items=[],
            )

        rows = await self.repository.fetch_due_price_alert_rows(limit=limit)
        latest_attempts = await self._latest_attempts([str(row.get("id") or "") for row in rows])
        processed: list[ProcessedPriceAlert] = []
        triggered = 0
        notified = 0
        failed = 0

        for row in rows:
            alert_id = str(row.get("id") or "")
            listing_id = str(row.get("listing_id") or "")
            target_price = int(row.get("target_price") or 0)
            current_price = self._extract_listing_price(row)
            latest_attempt = latest_attempts.get(alert_id)
            now = datetime.now(timezone.utc)
            attempt_number = int((latest_attempt or {}).get("attempt_number") or 0) + 1

            if not alert_id or not listing_id or target_price <= 0:
                failed += 1
                processed.append(
                    ProcessedPriceAlert(
                        alert_id=alert_id or "unknown",
                        listing_id=listing_id or "unknown",
                        target_price=target_price,
                        current_price=current_price,
                        status="failed",
                        delivery_status="failed",
                        attempt_number=attempt_number,
                        max_attempts=self.settings.alerts_retry_max_attempts,
                        reason="invalid_alert_row",
                    )
                )
                continue

            if latest_attempt and str(latest_attempt.get("idempotency_key") or "") == run_id:
                processed.append(
                    ProcessedPriceAlert(
                        alert_id=alert_id,
                        listing_id=listing_id,
                        target_price=target_price,
                        current_price=current_price,
                        status="skipped",
                        reason="idempotent_replay",
                        attempt_number=attempt_number - 1,
                        max_attempts=self.settings.alerts_retry_max_attempts,
                    )
                )
                continue

            if not self._can_retry(latest_attempt, now):
                processed.append(
                    ProcessedPriceAlert(
                        alert_id=alert_id,
                        listing_id=listing_id,
                        target_price=target_price,
                        current_price=current_price,
                        status="skipped",
                        reason="retry_not_due_or_exhausted",
                        attempt_number=attempt_number - 1,
                        max_attempts=self.settings.alerts_retry_max_attempts,
                        next_retry_at=_parse_datetime((latest_attempt or {}).get("next_retry_at")),
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
                        attempt_number=attempt_number,
                        max_attempts=self.settings.alerts_retry_max_attempts,
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
                        attempt_number=attempt_number,
                        max_attempts=self.settings.alerts_retry_max_attempts,
                        reason="target_not_reached",
                    )
                )
                continue

            triggered += 1
            if dry_run:
                await self._create_attempt(
                    alert_id=alert_id,
                    attempt_number=attempt_number,
                    status="triggered_dry_run",
                    channel="in_app",
                    error_message=None,
                    next_retry_at=None,
                    delivered_at=now,
                    run_id=run_id,
                    meta={"current_price": current_price, "target_price": target_price},
                )
                processed.append(
                    ProcessedPriceAlert(
                        alert_id=alert_id,
                        listing_id=listing_id,
                        target_price=target_price,
                        current_price=current_price,
                        status="triggered_dry_run",
                        delivery_status="triggered_dry_run",
                        delivery_channel="in_app",
                        attempt_number=attempt_number,
                        max_attempts=self.settings.alerts_retry_max_attempts,
                        notified_at=now,
                    )
                )
                continue

            delivery = await self.delivery_service.deliver(row)
            if not delivery.get("delivered"):
                failed += 1
                retryable = attempt_number < self.settings.alerts_retry_max_attempts
                next_retry_at = self._next_retry_at(attempt_number=attempt_number, now=now) if retryable else None
                await self._create_attempt(
                    alert_id=alert_id,
                    attempt_number=attempt_number,
                    status="retrying" if retryable else "failed",
                    channel=str(delivery.get("channel") or "email"),
                    error_message=str(delivery.get("error") or "delivery_failed"),
                    next_retry_at=next_retry_at,
                    delivered_at=None,
                    run_id=run_id,
                    meta={"current_price": current_price, "target_price": target_price},
                )
                processed.append(
                    ProcessedPriceAlert(
                        alert_id=alert_id,
                        listing_id=listing_id,
                        target_price=target_price,
                        current_price=current_price,
                        status="failed",
                        delivery_status="retrying" if retryable else "failed",
                        delivery_channel=str(delivery.get("channel") or "email"),
                        attempt_number=attempt_number,
                        max_attempts=self.settings.alerts_retry_max_attempts,
                        reason=str(delivery.get("error") or "delivery_failed"),
                        next_retry_at=next_retry_at,
                    )
                )
                continue

            updated = await self.repository.mark_price_alert_notified(
                alert_id=alert_id,
                notified_at=now,
            )
            if not updated:
                failed += 1
                retryable = attempt_number < self.settings.alerts_retry_max_attempts
                next_retry_at = self._next_retry_at(attempt_number=attempt_number, now=now) if retryable else None
                await self._create_attempt(
                    alert_id=alert_id,
                    attempt_number=attempt_number,
                    status="retrying" if retryable else "failed",
                    channel=str(delivery.get("channel") or "in_app"),
                    error_message="notify_update_failed",
                    next_retry_at=next_retry_at,
                    delivered_at=None,
                    run_id=run_id,
                    meta={"current_price": current_price, "target_price": target_price},
                )
                processed.append(
                    ProcessedPriceAlert(
                        alert_id=alert_id,
                        listing_id=listing_id,
                        target_price=target_price,
                        current_price=current_price,
                        status="failed",
                        delivery_status="retrying" if retryable else "failed",
                        delivery_channel=str(delivery.get("channel") or "in_app"),
                        attempt_number=attempt_number,
                        max_attempts=self.settings.alerts_retry_max_attempts,
                        reason="notify_update_failed",
                        next_retry_at=next_retry_at,
                    )
                )
                continue

            await self._create_attempt(
                alert_id=alert_id,
                attempt_number=attempt_number,
                status="success",
                channel=str(delivery.get("channel") or "in_app"),
                error_message=None,
                next_retry_at=None,
                delivered_at=now,
                run_id=run_id,
                meta={"current_price": current_price, "target_price": target_price},
            )
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
                    delivery_status="success",
                    delivery_channel=str(delivery.get("channel") or "in_app"),
                    attempt_number=attempt_number,
                    max_attempts=self.settings.alerts_retry_max_attempts,
                    notified_at=now,
                )
            )

        return ProcessPriceAlertsResponse(
            run_id=run_id,
            scanned=len(rows),
            triggered=triggered,
            notified=notified,
            failed=failed,
            dry_run=dry_run,
            items=processed,
        )
