from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


ConfidenceLevel = Literal["high", "medium", "low", "insufficient"]
RiskLevel = Literal["low", "medium", "high"]


class DealSummary(BaseModel):
    headline: str | None = None
    summary: str | None = None
    top_reasons: list[str] = Field(default_factory=list)
    benchmark_price: int | None = None
    price_delta_pct: float | None = None
    days_on_market: int | None = None
    price_change_count: int = 0
    comparable_count: int = 0
    confidence: ConfidenceLevel = "insufficient"


class SellerProfile(BaseModel):
    seller_type_inferred: str | None = None
    seller_name: str | None = None
    seller_url: str | None = None
    confidence: ConfidenceLevel = "insufficient"
    notes: list[str] = Field(default_factory=list)


class TrustSummary(BaseModel):
    trust_score: float = 50.0
    risk_level: RiskLevel = "medium"
    flags: list[str] = Field(default_factory=list)
    seller_profile: SellerProfile = Field(default_factory=SellerProfile)
    data_completeness_score: float = 0.0
    duplicate_cluster_size: int = 1
    image_reuse_count: int = 0
    summary: str | None = None


class NegotiationSummary(BaseModel):
    target_price: int | None = None
    opening_offer: int | None = None
    walk_away_price: int | None = None
    negotiation_headroom_pct: float | None = None
    arguments: list[str] = Field(default_factory=list)
    questions_for_seller: list[str] = Field(default_factory=list)
    inspection_checklist: list[str] = Field(default_factory=list)
    message_template: str | None = None
    confidence: ConfidenceLevel = "insufficient"


class OwnershipScenario(BaseModel):
    label: Literal["best", "base", "worst"]
    total_cost: int
    monthly_cost: int


class OwnershipEstimate(BaseModel):
    depreciation_cost: int = 0
    fuel_or_energy_cost: int = 0
    maintenance_cost: int = 0
    insurance_cost: int = 0
    total_cost_of_ownership: int = 0
    monthly_cost: int = 0
    scenario_best: OwnershipScenario = Field(
        default_factory=lambda: OwnershipScenario(label="best", total_cost=0, monthly_cost=0)
    )
    scenario_base: OwnershipScenario = Field(
        default_factory=lambda: OwnershipScenario(label="base", total_cost=0, monthly_cost=0)
    )
    scenario_worst: OwnershipScenario = Field(
        default_factory=lambda: OwnershipScenario(label="worst", total_cost=0, monthly_cost=0)
    )
    summary: str | None = None


class OwnershipProfile(BaseModel):
    annual_km: int = 10_000
    horizon_months: int = 24
    fuel_price_per_liter: float = 1.85
    electricity_price_per_kwh: float = 0.30
    insurance_band: Literal["low", "medium", "high"] = "medium"


class ListingAnalysis(BaseModel):
    listing_id: str | None = None
    listing_hash: str | None = None
    deal_summary: DealSummary | None = None
    trust_summary: TrustSummary | None = None
    negotiation_summary: NegotiationSummary | None = None
    ownership_estimate: OwnershipEstimate | None = None
