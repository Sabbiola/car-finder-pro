from app.core.provider_registry import ProviderRegistry
from app.models.search import SearchRequest
from app.providers.base.base_provider import BaseProvider


def select_providers(request: SearchRequest, registry: ProviderRegistry) -> list[BaseProvider]:
    providers = [provider for provider in registry.all() if provider.info.enabled and provider.is_configured()]
    if request.sources:
        requested = set(request.sources)
        providers = [provider for provider in providers if provider.info.id in requested]
    return providers
