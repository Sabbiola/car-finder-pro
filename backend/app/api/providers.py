from fastapi import APIRouter, Depends

from app.core.dependencies import get_provider_registry
from app.core.provider_configuration import resolve_provider_configuration_status
from app.core.provider_registry import ProviderRegistry
from app.core.settings import get_settings


router = APIRouter()


@router.get("/providers")
def list_providers(registry: ProviderRegistry = Depends(get_provider_registry)) -> dict[str, list[dict]]:
    settings = get_settings()
    payload: list[dict] = []
    for provider in registry.catalog():
        config = resolve_provider_configuration_status(provider.id, settings)
        payload.append(
            {
                **provider.model_dump(mode="json"),
                "configuration_requirements": config.requirements,
                "missing_configuration": config.missing,
                "configuration_message": config.message,
            }
        )
    return {"providers": payload}
