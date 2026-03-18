from fastapi import APIRouter, Depends

from app.core.dependencies import get_provider_registry
from app.core.provider_configuration import resolve_provider_configuration_status
from app.core.provider_registry import ProviderRegistry
from app.core.settings import get_settings


router = APIRouter()


@router.get("/providers/health")
async def provider_health(registry: ProviderRegistry = Depends(get_provider_registry)) -> dict[str, list[dict]]:
    settings = get_settings()
    health_rows = await registry.health()
    payload: list[dict] = []
    for row in health_rows:
        config = resolve_provider_configuration_status(row.provider, settings)
        payload.append(
            {
                **row.model_dump(mode="json"),
                "configuration_requirements": config.requirements,
                "missing_configuration": config.missing,
                "configuration_message": config.message,
            }
        )
    return {"providers": payload}
