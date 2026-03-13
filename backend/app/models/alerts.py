from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator


class AlertListingSummary(BaseModel):
    title: str | None = None
    price: int | None = None
    image_url: str | None = None
    source_url: str | None = None


class PriceAlertRecord(BaseModel):
    id: str
    listing_id: str
    target_price: int
    is_active: bool = True
    notified_at: datetime | None = None
    created_at: datetime
    user_id: str | None = None
    client_id: str | None = None
    listing: AlertListingSummary | None = None
    delivery_status: str | None = None
    last_delivery_error: str | None = None
    last_delivery_attempt_at: datetime | None = None
    retry_count: int = 0

    @property
    def notification_status(self) -> str:
        if self.notified_at is not None:
            return "notified"
        if self.delivery_status in {"retrying", "failed"}:
            return self.delivery_status
        if self.is_active:
            return "active"
        return "inactive"


class CreatePriceAlertRequest(BaseModel):
    listing_id: str
    target_price: int = Field(gt=0)
    user_id: str | None = None
    client_id: str | None = None

    @model_validator(mode="after")
    def has_owner(self) -> "CreatePriceAlertRequest":
        if self.user_id or self.client_id:
            return self
        raise ValueError("Either user_id or client_id is required.")


class DeactivatePriceAlertRequest(BaseModel):
    user_id: str | None = None
    client_id: str | None = None

    @model_validator(mode="after")
    def has_owner(self) -> "DeactivatePriceAlertRequest":
        if self.user_id or self.client_id:
            return self
        raise ValueError("Either user_id or client_id is required.")


class PriceAlertResponse(BaseModel):
    alert: PriceAlertRecord
    notification_status: str


class PriceAlertListResponse(BaseModel):
    alerts: list[PriceAlertResponse] = Field(default_factory=list)


class ProcessPriceAlertsRequest(BaseModel):
    dry_run: bool = False
    limit: int = Field(default=200, ge=1, le=1000)
    idempotency_key: str | None = Field(default=None, min_length=8, max_length=128)


DeliveryAttemptStatus = Literal["success", "retrying", "failed", "skipped", "triggered_dry_run"]


class ProcessedPriceAlert(BaseModel):
    alert_id: str
    listing_id: str
    target_price: int
    current_price: int | None = None
    status: str
    delivery_status: DeliveryAttemptStatus | None = None
    delivery_channel: str | None = None
    attempt_number: int = 0
    max_attempts: int = 3
    reason: str | None = None
    notified_at: datetime | None = None
    next_retry_at: datetime | None = None


class ProcessPriceAlertsResponse(BaseModel):
    run_id: str
    idempotent_replay: bool = False
    scanned: int
    triggered: int
    notified: int
    failed: int
    dry_run: bool
    items: list[ProcessedPriceAlert] = Field(default_factory=list)
