from fastapi import APIRouter, Depends

from app.core.dependencies import get_provider_registry
from app.core.provider_registry import ProviderRegistry


router = APIRouter()


@router.get("/providers")
def list_providers(registry: ProviderRegistry = Depends(get_provider_registry)) -> dict[str, list[dict]]:
    return {"providers": [provider.model_dump(mode="json") for provider in registry.catalog()]}
