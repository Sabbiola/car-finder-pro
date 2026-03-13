from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, Field

from app.models.vehicle import VehicleListing


class ProgressEvent(BaseModel):
    event: Literal["progress"] = "progress"
    provider: str
    status: Literal["started", "completed", "failed"]
    fetched_count: int = 0
    message: str | None = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ResultEvent(BaseModel):
    event: Literal["result"] = "result"
    listing: VehicleListing
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ErrorEvent(BaseModel):
    event: Literal["error"] = "error"
    provider: str | None = None
    code: str = "provider_error"
    message: str
    retryable: bool = False
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class CompleteEvent(BaseModel):
    event: Literal["complete"] = "complete"
    total_results: int
    provider_summary: dict[str, int]
    duration_ms: int
    final_result_keys: list[str] = Field(default_factory=list)
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
