from datetime import datetime, timezone
from typing import Any

import pytest

from app.services.price_alert_processor import PriceAlertProcessor


class StubRepository:
    def __init__(self, rows: list[dict[str, Any]]) -> None:
        self.rows = rows
        self.attempts: list[dict[str, Any]] = []
        self.notified: set[str] = set()

    async def fetch_due_price_alert_rows(self, *, limit: int = 200) -> list[dict[str, Any]]:
        return self.rows[:limit]

    async def fetch_latest_delivery_attempts(self, alert_ids: list[str]) -> dict[str, dict[str, Any]]:
        latest: dict[str, dict[str, Any]] = {}
        for attempt in sorted(self.attempts, key=lambda item: item["created_at"], reverse=True):
            alert_id = str(attempt.get("alert_id") or "")
            if alert_id in alert_ids and alert_id not in latest:
                latest[alert_id] = attempt
        return latest

    async def count_delivery_attempts_by_run(self, run_id: str) -> int:
        return sum(1 for attempt in self.attempts if attempt.get("idempotency_key") == run_id)

    async def create_alert_delivery_attempt(
        self,
        *,
        alert_id: str,
        attempt_number: int,
        status: str,
        channel: str | None,
        error_message: str | None,
        next_retry_at,
        delivered_at,
        idempotency_key: str,
        meta: dict[str, Any] | None = None,
    ) -> None:
        self.attempts.append(
            {
                "alert_id": alert_id,
                "attempt_number": attempt_number,
                "status": status,
                "channel": channel,
                "error_message": error_message,
                "next_retry_at": next_retry_at.isoformat() if next_retry_at else None,
                "delivered_at": delivered_at.isoformat() if delivered_at else None,
                "idempotency_key": idempotency_key,
                "meta": meta or {},
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
        )

    async def mark_price_alert_notified(self, *, alert_id: str, notified_at) -> bool:
        self.notified.add(alert_id)
        return True


class StubDeliveryService:
    def __init__(self, *, delivered: bool, channel: str, error: str | None) -> None:
        self.delivered = delivered
        self.channel = channel
        self.error = error

    async def deliver(self, _row: dict[str, Any]) -> dict[str, Any]:
        return {
            "delivered": self.delivered,
            "channel": self.channel,
            "error": self.error,
        }


def _due_alert_row(alert_id: str = "alert-1") -> dict[str, Any]:
    return {
        "id": alert_id,
        "listing_id": "listing-1",
        "target_price": 26000,
        "is_active": True,
        "notified_at": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "user_id": "user-1",
        "client_id": None,
        "car_listings": {
            "price": 25000,
            "title": "BMW 320d",
            "source_url": "https://example.com/listing",
        },
    }


@pytest.mark.asyncio
async def test_processor_records_retry_attempt_and_idempotent_replay() -> None:
    repository = StubRepository([_due_alert_row()])
    processor = PriceAlertProcessor(repository=repository)
    processor.delivery_service = StubDeliveryService(
        delivered=False,
        channel="email",
        error="smtp_down",
    )

    first = await processor.process(dry_run=False, limit=10, idempotency_key="run-alerts-1")
    assert first.run_id == "run-alerts-1"
    assert first.triggered == 1
    assert first.notified == 0
    assert first.failed == 1
    assert len(first.items) == 1
    assert first.items[0].delivery_status == "retrying"
    assert first.items[0].attempt_number == 1
    assert first.items[0].next_retry_at is not None
    assert len(repository.attempts) == 1
    assert repository.attempts[0]["status"] == "retrying"

    replay = await processor.process(dry_run=False, limit=10, idempotency_key="run-alerts-1")
    assert replay.idempotent_replay is True
    assert replay.scanned == 0
    assert replay.items == []


@pytest.mark.asyncio
async def test_processor_skips_when_retry_exhausted() -> None:
    repository = StubRepository([_due_alert_row("alert-exhausted")])
    repository.attempts.append(
        {
            "alert_id": "alert-exhausted",
            "attempt_number": 3,
            "status": "retrying",
            "channel": "email",
            "error_message": "smtp_down",
            "next_retry_at": None,
            "delivered_at": None,
            "idempotency_key": "old-run",
            "meta": {},
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
    )
    processor = PriceAlertProcessor(repository=repository)
    processor.delivery_service = StubDeliveryService(
        delivered=False,
        channel="email",
        error="smtp_down",
    )

    result = await processor.process(dry_run=False, limit=10, idempotency_key="run-alerts-2")
    assert result.triggered == 0
    assert result.failed == 0
    assert len(result.items) == 1
    assert result.items[0].status == "skipped"
    assert result.items[0].reason == "retry_not_due_or_exhausted"
