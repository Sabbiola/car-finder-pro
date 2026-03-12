from typing import Literal

from pydantic import BaseModel, Field, model_validator

from app.models.vehicle import VehicleListing


SearchMode = Literal["fast", "full"]


class SearchRequest(BaseModel):
    query: str | None = None
    brand: str | None = None
    model: str | None = None
    trim: str | None = None
    location: str | None = None
    zip_code: str | None = None
    radius_km: int | None = None
    year_min: int | None = None
    year_max: int | None = None
    price_min: int | None = None
    price_max: int | None = None
    mileage_max: int | None = None
    body_styles: list[str] = Field(default_factory=list)
    fuel_types: list[str] = Field(default_factory=list)
    condition: str | None = None
    private_only: bool = False
    mode: SearchMode = "fast"
    sources: list[str] = Field(default_factory=list)

    @model_validator(mode="after")
    def has_meaningful_filter(self) -> "SearchRequest":
        if any(
            [
                self.query,
                self.brand,
                self.model,
                self.location,
                self.body_styles,
                self.fuel_types,
                self.price_max,
                self.price_min,
                self.mileage_max,
                self.year_min,
                self.year_max,
                self.sources,
            ]
        ):
            return self
        raise ValueError("At least one meaningful filter is required.")


class SearchResponse(BaseModel):
    total_results: int
    listings: list[VehicleListing]
    providers_used: list[str]
    provider_errors: list[str] = Field(default_factory=list)
