from collections.abc import AsyncIterator
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

from app.core.dependencies import (
    get_analysis_service,
    get_market_repository,
    get_provider_registry,
    get_search_orchestrator,
)
from app.core.settings import get_settings
from app.models.analysis import DealSummary, ListingAnalysis, NegotiationSummary, OwnershipEstimate, OwnershipScenario, TrustSummary
from app.models.analysis_request import AnalyzeListingRequest
from app.main import app
from app.models.search import ProviderErrorDetail, SearchResponse
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


class NoEligibleOrchestrator:
    async def run_search(self, _request) -> SearchResponse:
        return SearchResponse(
            total_results=0,
            listings=[],
            providers_used=[],
            provider_errors=["No eligible providers for active filters: body_styles"],
            provider_error_details=[
                ProviderErrorDetail(
                    provider=None,
                    code="no_provider_eligible_for_filters",
                    message="No eligible providers for active filters: body_styles",
                    retryable=False,
                )
            ],
        )

    async def stream_search(self, _request) -> AsyncIterator[dict]:
        yield {
            "event": "error",
            "provider": None,
            "code": "no_provider_eligible_for_filters",
            "message": "No eligible providers for active filters: body_styles",
            "retryable": False,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        yield {
            "event": "complete",
            "total_results": 0,
            "provider_summary": {},
            "duration_ms": 0,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }


class StubAnalysisService:
    @staticmethod
    def _analysis_payload(listing_id: str | None = "listing-1") -> ListingAnalysis:
        return ListingAnalysis(
            listing_id=listing_id or "listing-1",
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

    async def analyze_request(self, _request: AnalyzeListingRequest) -> ListingAnalysis:
        return self._analysis_payload("listing-1")

    async def analyze_listing(self, listing: VehicleListing, **_kwargs) -> ListingAnalysis:
        return self._analysis_payload(listing.id)


class StubMarketRepository:
    def __init__(self) -> None:
        now_iso = datetime.now(timezone.utc).isoformat()
        self._alerts = [
            {
                "id": "alert-1",
                "listing_id": "listing-1",
                "target_price": 26000,
                "is_active": True,
                "notified_at": None,
                "created_at": now_iso,
                "user_id": "user-1",
                "client_id": None,
                "car_listings": {
                    "title": "BMW 320d",
                    "price": 25000,
                    "image_url": "https://images.example.com/a.jpg",
                    "source_url": "https://example.com/a",
                },
            }
        ]
        self._delivery_attempts: list[dict] = []
        self._favorites = [{"id": "fav-1", "user_id": "user-1", "listing_id": "listing-1", "created_at": now_iso}]
        self._saved_searches = [
            {
                "id": "search-1",
                "user_id": "user-1",
                "name": "BMW Milano",
                "filters": {"brand": "BMW", "model": "320d"},
                "created_at": now_iso,
            }
        ]

    async def fetch_listing_row_by_id(self, listing_id: str):
        if listing_id != "listing-1":
            return None
        return {
            "id": "listing-1",
            "source": "autoscout24",
            "source_url": "https://example.com/a",
            "title": "BMW 320d",
            "description": "BMW 320d usata in buone condizioni",
            "price": 25000,
            "year": 2020,
            "brand": "BMW",
            "model": "320d",
            "trim": "M Sport",
            "km": 52000,
            "fuel": "Diesel",
            "transmission": "Automatico",
            "body_type": "Berlina",
            "condition": "used",
            "location": "Milano",
            "image_url": "https://images.example.com/a.jpg",
            "image_urls": [],
            "extra_data": {},
            "scraped_at": datetime.now(timezone.utc).isoformat(),
        }

    async def fetch_listing_row_by_source_url(self, source_url: str):
        if source_url != "https://example.com/a":
            return None
        return await self.fetch_listing_row_by_id("listing-1")

    async def fetch_listing_rows_by_ids(self, listing_ids: list[str]):
        rows = []
        for listing_id in listing_ids:
            row = await self.fetch_listing_row_by_id(listing_id)
            if row:
                rows.append(row)
        return rows

    async def fetch_brand_model_rows(self, *, brand: str, model: str, order_by: str = "price.asc", limit: int = 20):
        if brand != "BMW" or model != "320d":
            return []
        return [
            {
                "id": "listing-1",
                "source": "autoscout24",
                "source_url": "https://example.com/a",
                "title": "BMW 320d",
                "description": "BMW 320d usata in buone condizioni",
                "price": 25000,
                "year": 2020,
                "brand": "BMW",
                "model": "320d",
                "trim": "M Sport",
                "km": 52000,
                "fuel": "Diesel",
                "transmission": "Automatico",
                "body_type": "Berlina",
                "condition": "used",
                "location": "Milano",
                "image_url": "https://images.example.com/a.jpg",
                "image_urls": [],
                "extra_data": {},
                "scraped_at": datetime.now(timezone.utc).isoformat(),
            },
            {
                "id": "listing-2",
                "source": "subito",
                "source_url": "https://example.com/b",
                "title": "BMW 320d seconda",
                "description": "BMW 320d seconda",
                "price": 25500,
                "year": 2020,
                "brand": "BMW",
                "model": "320d",
                "trim": "Business",
                "km": 54000,
                "fuel": "Diesel",
                "transmission": "Automatico",
                "body_type": "Berlina",
                "condition": "used",
                "location": "Roma",
                "image_url": "https://images.example.com/b.jpg",
                "image_urls": [],
                "extra_data": {},
                "scraped_at": datetime.now(timezone.utc).isoformat(),
            },
        ]

    async def fetch_price_history(self, listing_id: str, limit: int = 30):
        if listing_id != "listing-1":
            return []
        return [
            {"price": 26000, "recorded_at": datetime(2025, 1, 10, tzinfo=timezone.utc).isoformat()},
            {"price": 25000, "recorded_at": datetime(2025, 2, 15, tzinfo=timezone.utc).isoformat()},
        ]

    @staticmethod
    def row_to_listing(row):
        return VehicleListing(
            id=row["id"],
            provider=row["source"],
            market="IT",
            url=row["source_url"],
            title=row["title"],
            description=row["description"],
            price_amount=row["price"],
            year=row["year"],
            make=row["brand"],
            model=row["model"],
            trim=row["trim"],
            mileage_value=row["km"],
            fuel_type=row["fuel"],
            transmission=row["transmission"],
            body_style=row["body_type"],
            city=row["location"],
            country="IT",
            images=[row["image_url"]],
            scraped_at=datetime.now(timezone.utc),
        )

    async def fetch_price_alert_rows(
        self,
        *,
        user_id: str | None = None,
        client_id: str | None = None,
        active_only: bool = False,
        limit: int = 200,
    ):
        rows = self._alerts
        if user_id:
            rows = [row for row in rows if row.get("user_id") == user_id]
        elif client_id:
            rows = [row for row in rows if row.get("client_id") == client_id]
        if active_only:
            rows = [row for row in rows if row.get("is_active")]
        return rows[:limit]

    async def find_matching_price_alert(
        self,
        *,
        listing_id: str,
        target_price: int,
        user_id: str | None = None,
        client_id: str | None = None,
    ):
        for row in self._alerts:
            if row["listing_id"] != listing_id or row["target_price"] != target_price:
                continue
            if user_id and row.get("user_id") != user_id:
                continue
            if client_id and row.get("client_id") != client_id:
                continue
            if row.get("is_active"):
                return row
        return None

    async def create_price_alert(
        self,
        *,
        listing_id: str,
        target_price: int,
        user_id: str | None = None,
        client_id: str | None = None,
    ):
        row = {
            "id": "alert-2",
            "listing_id": listing_id,
            "target_price": target_price,
            "is_active": True,
            "notified_at": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "user_id": user_id,
            "client_id": client_id,
            "car_listings": {
                "title": "BMW 320d",
                "price": 25000,
                "image_url": "https://images.example.com/a.jpg",
                "source_url": "https://example.com/a",
            },
        }
        self._alerts.append(row)
        return row

    async def deactivate_price_alert(
        self,
        *,
        alert_id: str,
        user_id: str | None = None,
        client_id: str | None = None,
    ):
        for row in self._alerts:
            if row["id"] != alert_id:
                continue
            if user_id and row.get("user_id") != user_id:
                continue
            if client_id and row.get("client_id") != client_id:
                continue
            row["is_active"] = False
            return row
        return None

    async def fetch_due_price_alert_rows(self, *, limit: int = 200):
        rows = []
        for row in self._alerts:
            if not row.get("is_active") or row.get("notified_at") is not None:
                continue
            rows.append(row)
        return rows[:limit]

    async def fetch_latest_delivery_attempts(self, alert_ids: list[str]):
        latest: dict[str, dict] = {}
        for attempt in sorted(self._delivery_attempts, key=lambda item: item["created_at"], reverse=True):
            alert_id = attempt.get("alert_id")
            if alert_id in alert_ids and alert_id not in latest:
                latest[alert_id] = attempt
        return latest

    async def fetch_alert_delivery_attempt_rows(self, *, limit: int = 500, since_iso: str | None = None):
        rows = sorted(self._delivery_attempts, key=lambda item: item["created_at"], reverse=True)
        if since_iso:
            rows = [row for row in rows if str(row.get("created_at") or "") >= since_iso]
        return rows[:limit]

    async def count_delivery_attempts_by_run(self, run_id: str) -> int:
        return sum(1 for item in self._delivery_attempts if item.get("idempotency_key") == run_id)

    async def create_alert_delivery_attempt(
        self,
        *,
        alert_id: str,
        attempt_number: int,
        status: str,
        channel: str | None,
        error_message: str | None,
        next_retry_at: datetime | None,
        delivered_at: datetime | None,
        idempotency_key: str,
        meta: dict | None = None,
    ):
        self._delivery_attempts.append(
            {
                "alert_id": alert_id,
                "attempt_number": attempt_number,
                "status": status,
                "channel": channel,
                "error_message": error_message,
                "next_retry_at": next_retry_at.isoformat() if next_retry_at else None,
                "delivered_at": delivered_at.isoformat() if delivered_at else None,
                "idempotency_key": idempotency_key,
                "meta": meta or {},
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
        )

    async def fetch_user_email(self, user_id: str):
        if user_id == "user-1":
            return "user@example.com"
        return None

    async def mark_price_alert_notified(self, *, alert_id: str, notified_at: datetime) -> bool:
        for row in self._alerts:
            if row.get("id") != alert_id:
                continue
            if not row.get("is_active") or row.get("notified_at") is not None:
                return False
            row["is_active"] = False
            row["notified_at"] = notified_at.isoformat()
            return True
        return False

    async def fetch_user_favorite_rows(self, *, user_id: str):
        return [item for item in self._favorites if item["user_id"] == user_id]

    async def add_user_favorite(self, *, user_id: str, listing_id: str):
        existing = [item for item in self._favorites if item["user_id"] == user_id and item["listing_id"] == listing_id]
        if existing:
            return existing[0]
        row = {
            "id": f"fav-{len(self._favorites) + 1}",
            "user_id": user_id,
            "listing_id": listing_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        self._favorites.append(row)
        return row

    async def remove_user_favorite(self, *, user_id: str, listing_id: str):
        before = len(self._favorites)
        self._favorites = [
            item
            for item in self._favorites
            if not (item["user_id"] == user_id and item["listing_id"] == listing_id)
        ]
        return len(self._favorites) != before

    async def fetch_user_saved_search_rows(self, *, user_id: str, limit: int = 20):
        rows = [item for item in self._saved_searches if item["user_id"] == user_id]
        return rows[:limit]

    async def create_user_saved_search(self, *, user_id: str, name: str, filters: dict):
        row = {
            "id": f"search-{len(self._saved_searches) + 1}",
            "user_id": user_id,
            "name": name,
            "filters": filters,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        self._saved_searches.append(row)
        return row

    async def delete_user_saved_search(self, *, user_id: str, search_id: str):
        before = len(self._saved_searches)
        self._saved_searches = [
            item
            for item in self._saved_searches
            if not (item["user_id"] == user_id and item["id"] == search_id)
        ]
        return len(self._saved_searches) != before


@pytest.fixture(autouse=True)
def _clear_dependency_overrides() -> None:
    app.dependency_overrides.clear()
    yield
    app.dependency_overrides.clear()


def _build_client() -> TestClient:
    market_repository = StubMarketRepository()
    app.dependency_overrides[get_provider_registry] = lambda: StubRegistry()
    app.dependency_overrides[get_search_orchestrator] = lambda: StubOrchestrator()
    app.dependency_overrides[get_analysis_service] = lambda: StubAnalysisService()
    app.dependency_overrides[get_market_repository] = lambda: market_repository
    return TestClient(app)


def test_search_endpoint_contract() -> None:
    client = _build_client()
    response = client.post(
        "/api/search",
        json={
            "brand": "BMW",
            "model": "320d",
            "sources": ["autoscout24"],
            "is_new": False,
            "color": "Nero",
            "doors": 4,
            "emission_class": "Euro 6",
            "seller_type": "dealer",
            "private_only": False,
        },
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["total_results"] == 1
    assert payload["providers_used"] == ["autoscout24"]
    assert payload["provider_errors"] == []
    assert payload["provider_error_details"] == []
    assert payload["listings"][0]["reason_codes"] == ["PRICE_SIGNIFICANTLY_BELOW_MARKET"]
    assert payload["listings"][0]["deal_summary"]["headline"] == "Affare interessante"


def test_search_endpoint_rejects_conflicting_seller_flags() -> None:
    client = _build_client()
    response = client.post(
        "/api/search",
        json={
            "brand": "BMW",
            "seller_type": "dealer",
            "private_only": True,
        },
    )
    assert response.status_code == 422
    payload = response.json()
    assert "private_only cannot be combined with seller_type=dealer." in str(payload)


def test_search_endpoint_returns_422_when_no_provider_eligible() -> None:
    market_repository = StubMarketRepository()
    app.dependency_overrides[get_provider_registry] = lambda: StubRegistry()
    app.dependency_overrides[get_search_orchestrator] = lambda: NoEligibleOrchestrator()
    app.dependency_overrides[get_analysis_service] = lambda: StubAnalysisService()
    app.dependency_overrides[get_market_repository] = lambda: market_repository
    client = TestClient(app)

    response = client.post("/api/search", json={"brand": "BMW", "body_styles": ["SUV"]})
    assert response.status_code == 422
    payload = response.json()
    assert payload["provider_error_details"][0]["code"] == "no_provider_eligible_for_filters"


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
    assert by_provider_id["autoscout24"]["configuration_requirements"] == ["SCRAPINGBEE_API_KEY"]
    assert by_provider_id["autoscout24"]["missing_configuration"] == []
    assert by_provider_id["autoscout24"]["configuration_message"] == "Configured"
    assert by_provider_id["ebay"]["configuration_requirements"] == ["EBAY_CLIENT_ID", "EBAY_CLIENT_SECRET"]
    assert by_provider_id["ebay"]["missing_configuration"] == ["EBAY_CLIENT_ID", "EBAY_CLIENT_SECRET"]
    assert "Missing required env" in by_provider_id["ebay"]["configuration_message"]

    health_response = client.get("/api/providers/health")
    assert health_response.status_code == 200
    health_payload = health_response.json()
    assert health_payload["providers"][0]["provider"] == "autoscout24"
    assert health_payload["providers"][0]["latency_ms"] == 420
    assert health_payload["providers"][0]["total_calls"] == 3
    assert health_payload["providers"][0]["failed_calls"] == 1
    assert health_payload["providers"][0]["last_error"] == "transient timeout"
    assert health_payload["providers"][0]["configuration_requirements"] == ["SCRAPINGBEE_API_KEY"]
    assert health_payload["providers"][0]["missing_configuration"] == []
    assert health_payload["providers"][0]["configuration_message"] == "Configured"

    metadata_response = client.get("/api/filters/metadata")
    assert metadata_response.status_code == 200
    metadata_payload = metadata_response.json()
    assert "fuel_types" in metadata_payload
    assert "providers" in metadata_payload
    assert metadata_payload["search_contract"]["version"] == "v1"
    assert "canonical_filters" in metadata_payload["search_contract"]
    assert "provider_filter_union" in metadata_payload["search_contract"]
    assert "provider_filter_intersection" in metadata_payload["search_contract"]
    assert metadata_payload["search_contract"]["provider_filter_semantics"] == "strict_all_active_non_post_filters"
    assert "query" in metadata_payload["search_contract"]["provider_filter_union"]
    assert metadata_payload["search_contract"]["provider_filter_intersection"] == ["brand", "model"]
    assert "seller_type" in metadata_payload["search_contract"]["canonical_filters"]
    assert "private_only" in metadata_payload["search_contract"]["canonical_filters"]
    assert "seller_type" in metadata_payload["search_contract"]["backend_post_filters"]
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


def test_listing_detail_contract() -> None:
    client = _build_client()
    response = client.get("/api/listings/listing-1?include_analysis=true&include_context=true")
    assert response.status_code == 200
    payload = response.json()
    assert payload["listing"]["id"] == "listing-1"
    assert payload["listing"]["provider"] == "autoscout24"
    assert payload["analysis"]["listing_id"] == "listing-1"
    assert payload["resolved_by"] == "id"
    assert len(payload["similar_listings"]) == 1
    assert len(payload["price_samples"]) == 2
    assert len(payload["price_history"]) == 2


def test_listing_detail_contract_can_resolve_by_source_url() -> None:
    client = _build_client()
    response = client.get("/api/listings/not-a-db-id?source_url=https://example.com/a")
    assert response.status_code == 200
    payload = response.json()
    assert payload["listing"]["id"] == "listing-1"
    assert payload["resolved_by"] == "source_url"


def test_alerts_contract_create_list_and_deactivate() -> None:
    client = _build_client()

    list_response = client.get("/api/alerts?user_id=user-1")
    assert list_response.status_code == 200
    list_payload = list_response.json()
    assert len(list_payload["alerts"]) == 1
    assert list_payload["alerts"][0]["notification_status"] == "active"

    create_response = client.post(
        "/api/alerts",
        json={"listing_id": "listing-1", "target_price": 22000, "user_id": "user-1"},
    )
    assert create_response.status_code == 200
    created_payload = create_response.json()
    assert created_payload["alert"]["listing_id"] == "listing-1"
    assert created_payload["notification_status"] == "active"

    deactivate_response = client.post(
        "/api/alerts/alert-2/deactivate",
        json={"user_id": "user-1"},
    )
    assert deactivate_response.status_code == 200
    deactivated_payload = deactivate_response.json()
    assert deactivated_payload["alert"]["is_active"] is False
    assert deactivated_payload["notification_status"] == "inactive"


def test_ops_metrics_contract() -> None:
    client = _build_client()
    response = client.get("/api/ops/metrics")
    assert response.status_code == 200
    payload = response.json()
    assert "runtime" in payload
    assert "search" in payload["runtime"]
    assert "http" in payload["runtime"]
    assert "providers" in payload
    assert "alerts_processor" in payload
    assert "delivery_attempts_24h" in payload["alerts_processor"]


def test_ops_alerts_contract() -> None:
    client = _build_client()
    response = client.get("/api/ops/alerts")
    assert response.status_code == 200
    payload = response.json()
    assert "alerts" in payload
    assert "alerts_processor" in payload
    assert "thresholds" in payload


def test_ops_endpoints_require_token_when_configured(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("OPS_TOKEN", "ops-secret")
    get_settings.cache_clear()
    try:
        client = _build_client()
        unauthorized_metrics = client.get("/api/ops/metrics")
        unauthorized_alerts = client.get("/api/ops/alerts")
        assert unauthorized_metrics.status_code == 403
        assert unauthorized_alerts.status_code == 403

        headers = {"x-ops-token": "ops-secret"}
        authorized_metrics = client.get("/api/ops/metrics", headers=headers)
        authorized_alerts = client.get("/api/ops/alerts", headers=headers)
        assert authorized_metrics.status_code == 200
        assert authorized_alerts.status_code == 200
    finally:
        get_settings.cache_clear()


def test_ops_endpoints_accept_trimmed_token_value(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("OPS_TOKEN", "ops-secret")
    get_settings.cache_clear()
    try:
        client = _build_client()
        headers = {"x-ops-token": "  ops-secret  "}
        authorized_metrics = client.get("/api/ops/metrics", headers=headers)
        authorized_alerts = client.get("/api/ops/alerts", headers=headers)
        assert authorized_metrics.status_code == 200
        assert authorized_alerts.status_code == 200
    finally:
        get_settings.cache_clear()


def test_user_data_contract() -> None:
    client = _build_client()

    favorites = client.get("/api/user/favorites?user_id=user-1")
    assert favorites.status_code == 200
    assert favorites.json()["favorites"][0]["listing_id"] == "listing-1"

    add_favorite = client.post("/api/user/favorites", json={"user_id": "user-1", "listing_id": "listing-2"})
    assert add_favorite.status_code == 200

    remove_favorite = client.request(
        "DELETE",
        "/api/user/favorites/listing-2",
        json={"user_id": "user-1"},
    )
    assert remove_favorite.status_code == 200

    saved = client.get("/api/user/saved-searches?user_id=user-1")
    assert saved.status_code == 200
    assert saved.json()["saved_searches"][0]["id"] == "search-1"

    create_saved = client.post(
        "/api/user/saved-searches",
        json={"user_id": "user-1", "name": "Nuova ricerca", "filters": {"brand": "BMW"}},
    )
    assert create_saved.status_code == 200
    created_id = create_saved.json()["id"]

    delete_saved = client.request(
        "DELETE",
        f"/api/user/saved-searches/{created_id}",
        json={"user_id": "user-1"},
    )
    assert delete_saved.status_code == 200
    assert delete_saved.json()["deleted"] is True

    listings_batch = client.post("/api/listings/batch", json={"ids": ["listing-1"]})
    assert listings_batch.status_code == 200
    assert listings_batch.json()["listings"][0]["id"] == "listing-1"


def test_alerts_process_contract() -> None:
    client = _build_client()
    response = client.post("/api/alerts/process", json={"dry_run": False, "limit": 50})
    assert response.status_code == 200
    payload = response.json()
    assert payload["run_id"]
    assert payload["scanned"] >= 1
    assert payload["triggered"] >= 1
    assert payload["notified"] >= 1
    assert isinstance(payload["items"], list)


def test_alerts_process_idempotency_key_replay() -> None:
    client = _build_client()
    first = client.post(
        "/api/alerts/process",
        json={"dry_run": True, "limit": 10, "idempotency_key": "alerts-run-1"},
    )
    assert first.status_code == 200
    second = client.post(
        "/api/alerts/process",
        json={"dry_run": True, "limit": 10, "idempotency_key": "alerts-run-1"},
    )
    assert second.status_code == 200
    payload = second.json()
    assert payload["idempotent_replay"] is True


def test_alerts_process_requires_token_when_configured(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ALERTS_PROCESSOR_TOKEN", "secret-token")
    get_settings.cache_clear()
    try:
        client = _build_client()
        unauthorized = client.post("/api/alerts/process", json={"dry_run": True, "limit": 10})
        assert unauthorized.status_code == 401

        authorized = client.post(
            "/api/alerts/process",
            json={"dry_run": True, "limit": 10},
            headers={"x-alerts-token": "secret-token"},
        )
        assert authorized.status_code == 200
    finally:
        get_settings.cache_clear()


def test_alerts_process_accepts_trimmed_token_value(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ALERTS_PROCESSOR_TOKEN", "secret-token")
    get_settings.cache_clear()
    try:
        client = _build_client()
        authorized = client.post(
            "/api/alerts/process",
            json={"dry_run": True, "limit": 10},
            headers={"x-alerts-token": "  secret-token  "},
        )
        assert authorized.status_code == 200
    finally:
        get_settings.cache_clear()
