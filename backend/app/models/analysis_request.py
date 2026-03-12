from __future__ import annotations

from pydantic import BaseModel, Field, model_validator

from app.models.analysis import ListingAnalysis, OwnershipProfile
from app.models.vehicle import VehicleListing


class AnalyzeListingRequest(BaseModel):
    listing_id: str | None = None
    listing: VehicleListing | None = None
    include: list[str] = Field(default_factory=lambda: ["deal", "trust", "negotiation"])
    ownership_profile: OwnershipProfile | None = None

    @model_validator(mode="after")
    def validate_source(self) -> "AnalyzeListingRequest":
        if not self.listing_id and self.listing is None:
            raise ValueError("Either listing_id or listing must be provided.")
        return self


class AnalyzeListingResponse(ListingAnalysis):
    pass
