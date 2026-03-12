import pytest

from app.core.settings import get_settings
from app.models.search import SearchRequest
from app.providers.ebay.provider import EbayProvider


@pytest.fixture(autouse=True)
def _reset_settings_cache() -> None:
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


@pytest.mark.asyncio
async def test_ebay_provider_in_test_stub_mode(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("TEST_STUB_MODE", "true")
    provider = EbayProvider()

    assert provider.is_configured() is True
    listings = await provider.search(SearchRequest(brand="BMW", model="320d", sources=["ebay"]))
    assert len(listings) == 1
    assert listings[0].provider == "ebay"
    assert listings[0].price_amount > 0


@pytest.mark.asyncio
async def test_ebay_provider_unconfigured_raises(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("TEST_STUB_MODE", "false")
    monkeypatch.delenv("EBAY_CLIENT_ID", raising=False)
    monkeypatch.delenv("EBAY_CLIENT_SECRET", raising=False)
    provider = EbayProvider()

    assert provider.is_configured() is False
    with pytest.raises(RuntimeError, match="not configured"):
        await provider.search(SearchRequest(brand="BMW", model="320d", sources=["ebay"]))


@pytest.mark.asyncio
async def test_ebay_provider_maps_client_payload(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("TEST_STUB_MODE", "false")
    monkeypatch.setenv("EBAY_CLIENT_ID", "dummy-id")
    monkeypatch.setenv("EBAY_CLIENT_SECRET", "dummy-secret")
    provider = EbayProvider()

    async def fake_search_items(**_kwargs):
        return {
            "itemSummaries": [
                {
                    "title": "BMW 320d 2021 xDrive",
                    "itemWebUrl": "https://www.ebay.it/itm/123",
                    "price": {"value": "23900", "currency": "EUR"},
                    "image": {"imageUrl": "https://i.ebayimg.com/images/123.jpg"},
                    "shortDescription": "Nice car",
                }
            ]
        }

    monkeypatch.setattr(provider.client, "search_items", fake_search_items)
    listings = await provider.search(SearchRequest(brand="BMW", model="320d", sources=["ebay"]))

    assert len(listings) == 1
    listing = listings[0]
    assert listing.provider == "ebay"
    assert listing.title == "BMW 320d 2021 xDrive"
    assert listing.year == 2021
    assert listing.url == "https://www.ebay.it/itm/123"
    assert listing.images == ["https://i.ebayimg.com/images/123.jpg"]
