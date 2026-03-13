from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, Field

from app.models.search import SearchFilterKey


ProviderType = Literal["official_api", "partner_api", "html_scraper", "browser_scraper"]


class ProviderInfo(BaseModel):
    id: str
    name: str
    provider_type: ProviderType
    market: str
    enabled: bool = True
    configured: bool = True
    supports_filters: list[SearchFilterKey] = Field(default_factory=list)


class ProviderHealth(BaseModel):
    provider: str
    enabled: bool
    configured: bool = True
    last_success: datetime | None = None
    latency_ms: int | None = None
    error_rate: float = 0.0
    total_calls: int = 0
    failed_calls: int = 0
    last_error: str | None = None
    checked_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
