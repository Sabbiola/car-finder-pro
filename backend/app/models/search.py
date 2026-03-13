from typing import Literal

from pydantic import BaseModel, Field, model_validator

from app.models.vehicle import VehicleListing


SearchMode = Literal["fast", "full"]
SearchFilterKey = Literal[
    "query",
    "brand",
    "model",
    "trim",
    "location",
    "year_min",
    "year_max",
    "price_min",
    "price_max",
    "mileage_min",
    "mileage_max",
    "body_styles",
    "fuel_types",
    "transmission",
    "private_only",
]

CANONICAL_SEARCH_FILTERS: tuple[SearchFilterKey, ...] = (
    "query",
    "brand",
    "model",
    "trim",
    "location",
    "year_min",
    "year_max",
    "price_min",
    "price_max",
    "mileage_min",
    "mileage_max",
    "body_styles",
    "fuel_types",
    "transmission",
    "private_only",
)

# Filters natively supported by API post-filtering even if providers do not expose them.
BACKEND_POST_FILTERS: tuple[SearchFilterKey, ...] = (
    "trim",
    "mileage_min",
    "transmission",
    "private_only",
)


class ProviderErrorDetail(BaseModel):
    provider: str | None = None
    code: str
    message: str
    retryable: bool = False


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
    mileage_min: int | None = None
    mileage_max: int | None = None
    body_styles: list[str] = Field(default_factory=list)
    fuel_types: list[str] = Field(default_factory=list)
    transmission: str | None = None
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
                self.mileage_min,
                self.mileage_max,
                self.transmission,
                self.year_min,
                self.year_max,
                self.sources,
            ]
        ):
            return self
        raise ValueError("At least one meaningful filter is required.")

    def active_filter_keys(self) -> set[SearchFilterKey]:
        active: set[SearchFilterKey] = set()
        if self.query:
            active.add("query")
        if self.brand:
            active.add("brand")
        if self.model:
            active.add("model")
        if self.trim:
            active.add("trim")
        if self.location:
            active.add("location")
        if self.year_min is not None:
            active.add("year_min")
        if self.year_max is not None:
            active.add("year_max")
        if self.price_min is not None:
            active.add("price_min")
        if self.price_max is not None:
            active.add("price_max")
        if self.mileage_min is not None:
            active.add("mileage_min")
        if self.mileage_max is not None:
            active.add("mileage_max")
        if self.body_styles:
            active.add("body_styles")
        if self.fuel_types:
            active.add("fuel_types")
        if self.transmission:
            active.add("transmission")
        if self.private_only:
            active.add("private_only")
        return active


class SearchResponse(BaseModel):
    total_results: int
    listings: list[VehicleListing]
    providers_used: list[str]
    provider_errors: list[str] = Field(default_factory=list)
    provider_error_details: list[ProviderErrorDetail] = Field(default_factory=list)
