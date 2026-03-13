from datetime import datetime, timezone
from typing import Any

from pydantic import BaseModel, Field

from app.models.analysis import DealSummary, NegotiationSummary, TrustSummary


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
    condition: str | None = None
    is_new: bool | None = None
    color: str | None = None
    doors: int | None = None
    emission_class: str | None = None
    seller_type: str | None = None
    seller_name: str | None = None
    seller_external_id: str | None = None
    seller_url: str | None = None
    seller_phone_hash: str | None = None
    city: str | None = None
    region: str | None = None
    country: str | None = None
    posted_at: datetime | None = None
    images: list[str] = Field(default_factory=list)
    raw_payload: dict[str, Any] | None = None
    listing_hash: str | None = None
    deal_score: float | None = None
    reason_codes: list[str] = Field(default_factory=list)
    deal_summary: DealSummary | None = None
    trust_summary: TrustSummary | None = None
    negotiation_summary: NegotiationSummary | None = None
    scraped_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
