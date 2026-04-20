from __future__ import annotations

from collections import OrderedDict
from datetime import datetime, timedelta, timezone
from threading import Lock

from app.models.vehicle import VehicleListing

_TTL = timedelta(minutes=60)
_MAX_SIZE = 2000


class ListingSessionCache:
    """Process-level in-memory LRU cache that stores VehicleListing objects after a search.

    Eviction policy: LRU by access order, capped at _MAX_SIZE entries.  TTL expiry on read.
    Thread-safe via a single Lock (held for O(1) dict operations only).
    """

    def __init__(self, max_size: int = _MAX_SIZE, ttl: timedelta = _TTL) -> None:
        self._by_url: OrderedDict[str, tuple[VehicleListing, datetime]] = OrderedDict()
        self._lock = Lock()
        self._max_size = max_size
        self._ttl = ttl

    def put_many(self, listings: list[VehicleListing]) -> None:
        now = datetime.now(timezone.utc)
        with self._lock:
            for listing in listings:
                if not listing.url:
                    continue
                if listing.url in self._by_url:
                    self._by_url.move_to_end(listing.url)
                self._by_url[listing.url] = (listing, now)
                if len(self._by_url) > self._max_size:
                    self._by_url.popitem(last=False)

    def get_by_url(self, url: str) -> VehicleListing | None:
        with self._lock:
            entry = self._by_url.get(url)
            if entry is None:
                return None
            listing, stored_at = entry
            if datetime.now(timezone.utc) - stored_at > self._ttl:
                del self._by_url[url]
                return None
            self._by_url.move_to_end(url)
            return listing

    @property
    def size(self) -> int:
        with self._lock:
            return len(self._by_url)


_cache = ListingSessionCache()


def get_listing_session_cache() -> ListingSessionCache:
    return _cache
