from fastapi import APIRouter, Depends

from app.core.dependencies import get_provider_registry
from app.core.provider_registry import ProviderRegistry


router = APIRouter()


@router.get("/providers/health")
async def provider_health(registry: ProviderRegistry = Depends(get_provider_registry)) -> dict[str, list[dict]]:
    health = await registry.health()
    return {"providers": [item.model_dump(mode="json") for item in health]}
