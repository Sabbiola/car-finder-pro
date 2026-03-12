from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, Field


ProviderType = Literal["official_api", "partner_api", "html_scraper", "browser_scraper"]


class ProviderInfo(BaseModel):
    id: str
    name: str
    provider_type: ProviderType
    market: str
    enabled: bool = True
    supports_filters: list[str] = Field(default_factory=list)


class ProviderHealth(BaseModel):
    provider: str
    enabled: bool
    configured: bool = True
    last_success: datetime | None = None
    latency_ms: int | None = None
    error_rate: float = 0.0
    checked_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
