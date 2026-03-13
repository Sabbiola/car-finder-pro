from fastapi import APIRouter, Depends

from app.core.dependencies import get_provider_registry
from app.models.analysis import OwnershipProfile
from app.core.domain_metadata import BRANDS, MODELS_BY_BRAND, TRIMS_BY_BRAND_MODEL
from app.models.search import BACKEND_POST_FILTERS, CANONICAL_SEARCH_FILTERS
from app.core.provider_registry import ProviderRegistry

router = APIRouter()

FUEL_TYPES = ["Benzina", "Diesel", "Ibrida", "Elettrica", "GPL", "Metano"]
BODY_STYLES = ["SUV", "Berlina", "Station Wagon", "Coup\u00e9", "Cabrio", "Monovolume"]


@router.get("/filters/metadata")
def filters_metadata(registry: ProviderRegistry = Depends(get_provider_registry)) -> dict[str, object]:
    providers = [provider.model_dump(mode="json") for provider in registry.catalog()]
    provider_filter_union = sorted(
        {
            filter_key
            for provider in providers
            for filter_key in (provider.get("supports_filters") or [])
        }
    )
    return {
        "fuel_types": FUEL_TYPES,
        "body_styles": BODY_STYLES,
        "conditions": ["used", "new"],
        "markets": ["IT"],
        "brands": BRANDS,
        "models_by_brand": MODELS_BY_BRAND,
        "trims_by_brand_model": TRIMS_BY_BRAND_MODEL,
        "providers": providers,
        "search_contract": {
            "version": "v1",
            "canonical_filters": list(CANONICAL_SEARCH_FILTERS),
            "backend_post_filters": list(BACKEND_POST_FILTERS),
            "provider_filter_union": provider_filter_union,
        },
    }


@router.get("/metadata/ownership")
def ownership_metadata() -> dict[str, object]:
    defaults = OwnershipProfile()
    return {
        "defaults": defaults.model_dump(mode="json"),
        "insurance_bands": ["low", "medium", "high"],
        "horizon_months_options": [12, 24, 36],
    }
