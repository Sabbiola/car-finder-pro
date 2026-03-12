from fastapi import APIRouter, Depends

from app.core.dependencies import get_provider_registry
from app.core.provider_registry import ProviderRegistry

router = APIRouter()


@router.get("/filters/metadata")
def filters_metadata(registry: ProviderRegistry = Depends(get_provider_registry)) -> dict[str, object]:
    return {
        "fuel_types": ["Benzina", "Diesel", "Ibrida", "Elettrica", "GPL", "Metano"],
        "body_styles": ["SUV", "Berlina", "Station Wagon", "Coupé", "Cabrio", "Monovolume"],
        "conditions": ["used", "new"],
        "markets": ["IT"],
        "providers": [provider.model_dump(mode="json") for provider in registry.catalog()],
    }
