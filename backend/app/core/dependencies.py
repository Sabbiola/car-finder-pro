from functools import lru_cache

from app.core.provider_registry import ProviderRegistry
from app.services.search_orchestrator import SearchOrchestrator


@lru_cache(maxsize=1)
def get_provider_registry() -> ProviderRegistry:
    return ProviderRegistry()


@lru_cache(maxsize=1)
def get_search_orchestrator() -> SearchOrchestrator:
    return SearchOrchestrator(registry=get_provider_registry())
