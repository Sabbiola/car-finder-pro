from __future__ import annotations

from datetime import datetime

from app.models.analysis import OwnershipEstimate, OwnershipProfile, OwnershipScenario
from app.models.vehicle import VehicleListing


class OwnershipService:
    def build_estimate(
        self,
        listing: VehicleListing,
        *,
        profile: OwnershipProfile,
    ) -> OwnershipEstimate:
        annual_km = max(profile.annual_km, 1)
        horizon_months = max(profile.horizon_months, 1)
        horizon_years = horizon_months / 12

        current_year = datetime.now().year
        age = max(0, current_year - (listing.year or current_year))
        if listing.fuel_type == "Elettrica":
            energy_multiplier = 0.18
            fuel_cost = int(round(annual_km * horizon_years * energy_multiplier * profile.electricity_price_per_kwh))
            maintenance_base = 450
        else:
            liters_per_km = 0.065 if listing.fuel_type in {"Diesel", "Benzina"} else 0.05
            fuel_cost = int(round(annual_km * horizon_years * liters_per_km * profile.fuel_price_per_liter))
            maintenance_base = 650

        depreciation_rate = 0.10 if age <= 3 else 0.07 if age <= 7 else 0.05
        depreciation_cost = int(round(listing.price_amount * depreciation_rate * horizon_years))
        maintenance_cost = int(round(maintenance_base * horizon_years + max(0, (listing.mileage_value or 0) / 50_000) * 180))
        insurance_band_multiplier = {"low": 0.8, "medium": 1.0, "high": 1.25}[profile.insurance_band]
        insurance_cost = int(round(720 * horizon_years * insurance_band_multiplier))
        total_cost = depreciation_cost + fuel_cost + maintenance_cost + insurance_cost
        monthly_cost = int(round(total_cost / horizon_months))

        def scenario(label: str, multiplier: float) -> OwnershipScenario:
            total = int(round(total_cost * multiplier))
            return OwnershipScenario(label=label, total_cost=total, monthly_cost=int(round(total / horizon_months)))

        summary = (
            f"Costo stimato {horizon_months} mesi: EUR {total_cost:,}, circa EUR {monthly_cost:,}/mese."
        ).replace(",", ".")
        return OwnershipEstimate(
            depreciation_cost=depreciation_cost,
            fuel_or_energy_cost=fuel_cost,
            maintenance_cost=maintenance_cost,
            insurance_cost=insurance_cost,
            total_cost_of_ownership=total_cost,
            monthly_cost=monthly_cost,
            scenario_best=scenario("best", 0.9),
            scenario_base=scenario("base", 1.0),
            scenario_worst=scenario("worst", 1.15),
            summary=summary,
        )
