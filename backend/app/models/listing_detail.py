from datetime import datetime
from pydantic import BaseModel, Field

from app.models.analysis import ListingAnalysis
from app.models.vehicle import VehicleListing


class ListingPriceHistoryPoint(BaseModel):
    price: int
    recorded_at: datetime


class ListingDetailResponse(BaseModel):
    listing: VehicleListing
    analysis: ListingAnalysis | None = None
    similar_listings: list[VehicleListing] = Field(default_factory=list)
    price_samples: list[VehicleListing] = Field(default_factory=list)
    price_history: list[ListingPriceHistoryPoint] = Field(default_factory=list)
    resolved_by: str = "id"
