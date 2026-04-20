from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field, field_validator

from app.models.vehicle import VehicleListing


class FavoriteRecord(BaseModel):
    listing_id: str
    created_at: datetime | None = None


class FavoriteListResponse(BaseModel):
    favorites: list[FavoriteRecord] = Field(default_factory=list)


class FavoriteUpsertRequest(BaseModel):
    user_id: str
    listing_id: str


class FavoriteDeleteRequest(BaseModel):
    user_id: str


class SavedSearchRecord(BaseModel):
    id: str
    name: str
    filters: dict[str, Any]
    created_at: datetime
    alert_enabled: bool = False


class SavedSearchListResponse(BaseModel):
    saved_searches: list[SavedSearchRecord] = Field(default_factory=list)


class SavedSearchCreateRequest(BaseModel):
    user_id: str
    name: str = Field(min_length=1, max_length=120)
    filters: dict[str, Any]
    alert_enabled: bool = False


class SavedSearchDeleteRequest(BaseModel):
    user_id: str


class ListingsBatchRequest(BaseModel):
    ids: list[str] = Field(default_factory=list, min_length=1, max_length=100)

    @field_validator("ids")
    @classmethod
    def validate_ids(cls, v: list[str]) -> list[str]:
        for item in v:
            if len(item) > 255:
                raise ValueError(f"Each ID must be at most 255 characters; got {len(item)}")
            if not item.strip():
                raise ValueError("IDs must not be blank")
        return v


class ListingsBatchResponse(BaseModel):
    listings: list[VehicleListing] = Field(default_factory=list)
