import pytest
from fastapi.testclient import TestClient

from app.core.dependencies import (
    get_analysis_service,
    get_market_repository,
    get_provider_registry,
    get_search_orchestrator,
)
from app.core.settings import get_settings
from app.main import app


def _clear_cached_dependencies() -> None:
    get_settings.cache_clear()
    get_market_repository.cache_clear()
    get_analysis_service.cache_clear()
    get_provider_registry.cache_clear()
    get_search_orchestrator.cache_clear()


@pytest.fixture(autouse=True)
def _reset_caches_between_tests() -> None:
    _clear_cached_dependencies()
    yield
    _clear_cached_dependencies()


def test_test_stub_mode_supports_core_fastapi_journeys_without_supabase(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("TEST_STUB_MODE", "true")
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_SERVICE_ROLE_KEY", raising=False)
    monkeypatch.delenv("SUPABASE_ANON_KEY", raising=False)

    client = TestClient(app)

    search_response = client.post(
        "/api/search",
        json={
            "brand": "BMW",
            "model": "320d",
            "sources": ["autoscout24", "subito"],
        },
    )
    assert search_response.status_code == 200
    search_payload = search_response.json()
    assert search_payload["total_results"] >= 1
    listing_id = search_payload["listings"][0]["id"]
    assert isinstance(listing_id, str)

    detail_response = client.get(f"/api/listings/{listing_id}?include_context=true")
    assert detail_response.status_code == 200
    detail_payload = detail_response.json()
    assert detail_payload["listing"]["id"] == listing_id
    assert len(detail_payload["price_samples"]) >= 1

    batch_response = client.post("/api/listings/batch", json={"ids": [listing_id]})
    assert batch_response.status_code == 200
    assert batch_response.json()["listings"][0]["id"] == listing_id

    create_alert_response = client.post(
        "/api/alerts",
        json={
            "listing_id": listing_id,
            "target_price": 23000,
            "client_id": "e2e-client",
        },
    )
    assert create_alert_response.status_code == 200
    alert_payload = create_alert_response.json()
    alert_id = alert_payload["alert"]["id"]
    assert alert_payload["alert"]["is_active"] is True

    list_alerts_response = client.get("/api/alerts?client_id=e2e-client&active_only=true")
    assert list_alerts_response.status_code == 200
    list_alerts_payload = list_alerts_response.json()
    assert any(item["alert"]["id"] == alert_id for item in list_alerts_payload["alerts"])

    deactivate_alert_response = client.post(
        f"/api/alerts/{alert_id}/deactivate",
        json={"client_id": "e2e-client"},
    )
    assert deactivate_alert_response.status_code == 200
    assert deactivate_alert_response.json()["alert"]["is_active"] is False
