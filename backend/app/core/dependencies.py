from functools import lru_cache

from app.core.provider_registry import ProviderRegistry
from app.services.analysis_service import AnalysisService
from app.services.search_orchestrator import SearchOrchestrator
from app.services.supabase_market_repository import SupabaseMarketRepository


@lru_cache(maxsize=1)
def get_provider_registry() -> ProviderRegistry:
    return ProviderRegistry()


@lru_cache(maxsize=1)
def get_market_repository() -> SupabaseMarketRepository:
    return SupabaseMarketRepository()


@lru_cache(maxsize=1)
def get_analysis_service() -> AnalysisService:
    return AnalysisService(repository=get_market_repository())


@lru_cache(maxsize=1)
def get_search_orchestrator() -> SearchOrchestrator:
    return SearchOrchestrator(
        registry=get_provider_registry(),
        analysis_service=get_analysis_service(),
    )
