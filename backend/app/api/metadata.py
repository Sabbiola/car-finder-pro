from fastapi import APIRouter, Depends

from app.core.dependencies import get_provider_registry
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
        "providers": [provider.model_dump(mode="json") for provider in registry.catalog()],
    }
