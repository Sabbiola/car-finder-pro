from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

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


class SavedSearchListResponse(BaseModel):
    saved_searches: list[SavedSearchRecord] = Field(default_factory=list)


class SavedSearchCreateRequest(BaseModel):
    user_id: str
    name: str = Field(min_length=1, max_length=120)
    filters: dict[str, Any]


class SavedSearchDeleteRequest(BaseModel):
    user_id: str


class ListingsBatchRequest(BaseModel):
    ids: list[str] = Field(default_factory=list, min_length=1, max_length=100)


class ListingsBatchResponse(BaseModel):
    listings: list[VehicleListing] = Field(default_factory=list)
