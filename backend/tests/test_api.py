from collections.abc import AsyncIterator
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

from app.core.dependencies import get_analysis_service, get_provider_registry, get_search_orchestrator
from app.models.analysis import DealSummary, ListingAnalysis, NegotiationSummary, OwnershipEstimate, OwnershipScenario, TrustSummary
from app.models.analysis_request import AnalyzeListingRequest
from app.main import app
from app.models.search import SearchResponse
from app.models.vehicle import VehicleListing
from app.providers.base.models import ProviderHealth, ProviderInfo


class StubRegistry:
    def catalog(self) -> list[ProviderInfo]:
        return [
            ProviderInfo(
                id="autoscout24",
                name="AutoScout24",
                provider_type="html_scraper",
                market="IT",
                enabled=True,
                configured=True,
                supports_filters=["brand", "model"],
            ),
            ProviderInfo(
                id="ebay",
                name="eBay Motors",
                provider_type="official_api",
                market="IT",
                enabled=True,
                configured=False,
                supports_filters=["query", "brand", "model"],
            ),
        ]

    async def health(self) -> list[ProviderHealth]:
        return [
            ProviderHealth(
                provider="autoscout24",
                enabled=True,
                configured=True,
                latency_ms=420,
                error_rate=0.0,
                total_calls=3,
                failed_calls=1,
                last_error="transient timeout",
                last_success=datetime.now(timezone.utc),
            )
        ]


class StubOrchestrator:
    async def run_search(self, _request) -> SearchResponse:
        listing = VehicleListing(
            provider="autoscout24",
            market="IT",
            title="BMW 320d",
            price_amount=25000,
            year=2020,
            make="BMW",
            model="320d",
            url="https://example.com/a",
            deal_score=82.0,
            reason_codes=["PRICE_SIGNIFICANTLY_BELOW_MARKET"],
            deal_summary=DealSummary(
                headline="Affare interessante",
                summary="Sotto benchmark locale.",
                top_reasons=["9% sotto benchmark"],
                benchmark_price=27500,
                price_delta_pct=-9.0,
                comparable_count=12,
                confidence="medium",
            ),
            trust_summary=TrustSummary(
                trust_score=71.0,
                risk_level="medium",
                flags=["poche foto"],
                summary="Annuncio da verificare prima di trattare.",
            ),
            negotiation_summary=NegotiationSummary(
                target_price=25200,
                opening_offer=24400,
                walk_away_price=25200,
                negotiation_headroom_pct=4.0,
                arguments=["annuncio online da 20 giorni"],
                questions_for_seller=["tagliandi documentati?"],
                inspection_checklist=["controllare pneumatici"],
                message_template="Ciao, valuterei un'offerta dopo visione.",
                confidence="medium",
            ),
        )
        return SearchResponse(
            total_results=1,
            listings=[listing],
            providers_used=["autoscout24"],
            provider_errors=[],
        )

    async def stream_search(self, _request) -> AsyncIterator[dict]:
        yield {
            "event": "progress",
            "provider": "autoscout24",
            "status": "started",
            "fetched_count": 0,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        yield {
            "event": "result",
            "listing": {
                "provider": "autoscout24",
                "market": "IT",
                "title": "BMW 320d",
                "price_amount": 25000,
                "price_currency": "EUR",
                "mileage_unit": "km",
                "reason_codes": ["PRICE_SIGNIFICANTLY_BELOW_MARKET"],
                "images": [],
                "scraped_at": datetime.now(timezone.utc).isoformat(),
            },
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        yield {
            "event": "complete",
            "total_results": 1,
            "provider_summary": {"autoscout24": 1},
            "duration_ms": 1234,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }


class StubAnalysisService:
    async def analyze_request(self, _request: AnalyzeListingRequest) -> ListingAnalysis:
        return ListingAnalysis(
            listing_id="listing-1",
            listing_hash="hash-1",
            deal_summary=DealSummary(
                headline="Affare interessante",
                summary="Sotto benchmark locale.",
                top_reasons=["9% sotto benchmark"],
                benchmark_price=27500,
                price_delta_pct=-9.0,
                comparable_count=12,
                confidence="medium",
            ),
            trust_summary=TrustSummary(
                trust_score=71.0,
                risk_level="medium",
                flags=["poche foto"],
                summary="Annuncio da verificare prima di trattare.",
            ),
            negotiation_summary=NegotiationSummary(
                target_price=25200,
                opening_offer=24400,
                walk_away_price=25200,
                negotiation_headroom_pct=4.0,
                arguments=["annuncio online da 20 giorni"],
                questions_for_seller=["tagliandi documentati?"],
                inspection_checklist=["controllare pneumatici"],
                message_template="Ciao, valuterei un'offerta dopo visione.",
                confidence="medium",
            ),
            ownership_estimate=OwnershipEstimate(
                depreciation_cost=2500,
                fuel_or_energy_cost=1800,
                maintenance_cost=1200,
                insurance_cost=1400,
                total_cost_of_ownership=6900,
                monthly_cost=288,
                scenario_best=OwnershipScenario(label="best", total_cost=6200, monthly_cost=258),
                scenario_base=OwnershipScenario(label="base", total_cost=6900, monthly_cost=288),
                scenario_worst=OwnershipScenario(label="worst", total_cost=7800, monthly_cost=325),
                summary="Costo stimato 24 mesi.",
            ),
        )


@pytest.fixture(autouse=True)
def _clear_dependency_overrides() -> None:
    app.dependency_overrides.clear()
    yield
    app.dependency_overrides.clear()


def _build_client() -> TestClient:
    app.dependency_overrides[get_provider_registry] = lambda: StubRegistry()
    app.dependency_overrides[get_search_orchestrator] = lambda: StubOrchestrator()
    app.dependency_overrides[get_analysis_service] = lambda: StubAnalysisService()
    return TestClient(app)


def test_search_endpoint_contract() -> None:
    client = _build_client()
    response = client.post(
        "/api/search",
        json={"brand": "BMW", "model": "320d", "sources": ["autoscout24"]},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["total_results"] == 1
    assert payload["providers_used"] == ["autoscout24"]
    assert payload["provider_errors"] == []
    assert payload["listings"][0]["reason_codes"] == ["PRICE_SIGNIFICANTLY_BELOW_MARKET"]
    assert payload["listings"][0]["deal_summary"]["headline"] == "Affare interessante"


def test_search_stream_emits_stable_events() -> None:
    client = _build_client()
    with client.stream(
        "POST",
        "/api/search/stream",
        json={"brand": "BMW", "model": "320d", "sources": ["autoscout24"]},
    ) as response:
        assert response.status_code == 200
        body = "".join(response.iter_text())
        assert "event: progress" in body
        assert "event: result" in body
        assert "event: complete" in body


def test_providers_and_health_contract() -> None:
    client = _build_client()

    providers_response = client.get("/api/providers")
    assert providers_response.status_code == 200
    providers_payload = providers_response.json()
    assert providers_payload["providers"][0]["id"] == "autoscout24"
    by_provider_id = {provider["id"]: provider for provider in providers_payload["providers"]}
    assert by_provider_id["autoscout24"]["configured"] is True
    assert by_provider_id["ebay"]["configured"] is False

    health_response = client.get("/api/providers/health")
    assert health_response.status_code == 200
    health_payload = health_response.json()
    assert health_payload["providers"][0]["provider"] == "autoscout24"
    assert health_payload["providers"][0]["latency_ms"] == 420
    assert health_payload["providers"][0]["total_calls"] == 3
    assert health_payload["providers"][0]["failed_calls"] == 1
    assert health_payload["providers"][0]["last_error"] == "transient timeout"

    metadata_response = client.get("/api/filters/metadata")
    assert metadata_response.status_code == 200
    metadata_payload = metadata_response.json()
    assert "fuel_types" in metadata_payload
    assert "providers" in metadata_payload
    assert "brands" in metadata_payload
    assert "models_by_brand" in metadata_payload
    assert "trims_by_brand_model" in metadata_payload

    ownership_response = client.get("/api/metadata/ownership")
    assert ownership_response.status_code == 200
    ownership_payload = ownership_response.json()
    assert ownership_payload["defaults"]["annual_km"] == 10000


def test_listing_analysis_contract() -> None:
    client = _build_client()
    response = client.post(
        "/api/listings/analyze",
        json={"listing_id": "listing-1", "include": ["deal", "trust", "negotiation", "ownership"]},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["listing_id"] == "listing-1"
    assert payload["deal_summary"]["headline"] == "Affare interessante"
    assert payload["ownership_estimate"]["total_cost_of_ownership"] == 6900
