from fastapi import APIRouter, Depends

from app.core.dependencies import get_provider_registry
from app.core.domain_metadata import BRANDS, MODELS_BY_BRAND, TRIMS_BY_BRAND_MODEL
from app.core.provider_registry import ProviderRegistry

router = APIRouter()

FUEL_TYPES = ["Benzina", "Diesel", "Ibrida", "Elettrica", "GPL", "Metano"]
BODY_STYLES = ["SUV", "Berlina", "Station Wagon", "Coup\u00e9", "Cabrio", "Monovolume"]


@router.get("/filters/metadata")
def filters_metadata(registry: ProviderRegistry = Depends(get_provider_registry)) -> dict[str, object]:
    return {
        "fuel_types": FUEL_TYPES,
        "body_styles": BODY_STYLES,
        "conditions": ["used", "new"],
        "markets": ["IT"],
        "brands": BRANDS,
        "models_by_brand": MODELS_BY_BRAND,
        "trims_by_brand_model": TRIMS_BY_BRAND_MODEL,
        "providers": [provider.model_dump(mode="json") for provider in registry.catalog()],
    }
