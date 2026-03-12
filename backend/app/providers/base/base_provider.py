from abc import ABC, abstractmethod

from app.models.search import SearchRequest
from app.models.vehicle import VehicleListing
from app.providers.base.models import ProviderHealth, ProviderInfo


class BaseProvider(ABC):
    info: ProviderInfo

    @abstractmethod
    async def search(self, request: SearchRequest) -> list[VehicleListing]:
        raise NotImplementedError

    async def health(self) -> ProviderHealth:
        return ProviderHealth(
            provider=self.info.id,
            enabled=self.info.enabled,
            configured=True,
            error_rate=0.0,
        )
