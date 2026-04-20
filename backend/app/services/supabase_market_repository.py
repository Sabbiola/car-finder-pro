from app.services.repositories.alerts_mixin import AlertsMixin
from app.services.repositories.analysis_mixin import AnalysisMixin
from app.services.repositories.base import SupabaseRepositoryBase, _parse_datetime  # noqa: F401 (re-export)
from app.services.repositories.listings_mixin import ListingsMixin
from app.services.repositories.seller_stats_mixin import SellerStatsMixin
from app.services.repositories.user_data_mixin import UserDataMixin


class SupabaseMarketRepository(
    AlertsMixin,
    UserDataMixin,
    SellerStatsMixin,
    AnalysisMixin,
    ListingsMixin,
    SupabaseRepositoryBase,
):
    """Composes all domain-specific repository mixins into a single class.

    All external imports remain `from app.services.supabase_market_repository import SupabaseMarketRepository`.
    """
