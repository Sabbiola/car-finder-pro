from datetime import datetime, timezone
from typing import Any

from pydantic import BaseModel, Field


class VehicleListing(BaseModel):
    id: str | None = None
    provider: str
    market: str = "IT"
    url: str | None = None
    title: str
    description: str | None = None
    price_amount: int
    price_currency: str = "EUR"
    year: int | None = None
    make: str | None = None
    model: str | None = None
    trim: str | None = None
    mileage_value: int | None = None
    mileage_unit: str = "km"
    fuel_type: str | None = None
    transmission: str | None = None
    body_style: str | None = None
    seller_type: str | None = None
    city: str | None = None
    region: str | None = None
    country: str | None = None
    posted_at: datetime | None = None
    images: list[str] = Field(default_factory=list)
    raw_payload: dict[str, Any] | None = None
    deal_score: float | None = None
    reason_codes: list[str] = Field(default_factory=list)
    scraped_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

