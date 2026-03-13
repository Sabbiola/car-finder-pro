from fastapi import APIRouter, Depends, Header, HTTPException, Query

from app.core.observability import log_event
from app.core.settings import get_settings
from app.core.dependencies import get_market_repository
from app.models.alerts import (
    AlertListingSummary,
    CreatePriceAlertRequest,
    DeactivatePriceAlertRequest,
    ProcessPriceAlertsRequest,
    ProcessPriceAlertsResponse,
    PriceAlertListResponse,
    PriceAlertRecord,
    PriceAlertResponse,
)
from app.services.price_alert_processor import PriceAlertProcessor
from app.services.supabase_market_repository import SupabaseMarketRepository


router = APIRouter()


def _map_alert_row(row: dict) -> PriceAlertRecord:
    listing_rel = row.get("car_listings")
    if isinstance(listing_rel, list):
        listing_rel = listing_rel[0] if listing_rel else None
    listing = AlertListingSummary.model_validate(listing_rel) if isinstance(listing_rel, dict) else None
    return PriceAlertRecord(
        id=str(row["id"]),
        listing_id=str(row["listing_id"]),
        target_price=int(row["target_price"]),
        is_active=bool(row.get("is_active", True)),
        notified_at=row.get("notified_at"),
        created_at=row["created_at"],
        user_id=row.get("user_id"),
        client_id=row.get("client_id"),
        listing=listing,
    )


def _to_response(record: PriceAlertRecord) -> PriceAlertResponse:
    return PriceAlertResponse(alert=record, notification_status=record.notification_status)


@router.get("/alerts", response_model=PriceAlertListResponse)
async def list_alerts(
    user_id: str | None = Query(default=None),
    client_id: str | None = Query(default=None),
    active_only: bool = Query(default=False),
    repository: SupabaseMarketRepository = Depends(get_market_repository),
) -> PriceAlertListResponse:
    if not user_id and not client_id:
        raise HTTPException(status_code=422, detail="Either user_id or client_id is required.")

    rows = await repository.fetch_price_alert_rows(
        user_id=user_id,
        client_id=client_id,
        active_only=active_only,
    )
    records = [_map_alert_row(row) for row in rows]
    return PriceAlertListResponse(alerts=[_to_response(record) for record in records])


@router.post("/alerts", response_model=PriceAlertResponse)
async def create_alert(
    request: CreatePriceAlertRequest,
    repository: SupabaseMarketRepository = Depends(get_market_repository),
) -> PriceAlertResponse:
    existing = await repository.find_matching_price_alert(
        listing_id=request.listing_id,
        target_price=request.target_price,
        user_id=request.user_id,
        client_id=request.client_id,
    )
    if existing:
        record = _map_alert_row(existing)
        return _to_response(record)

    created = await repository.create_price_alert(
        listing_id=request.listing_id,
        target_price=request.target_price,
        user_id=request.user_id,
        client_id=request.client_id,
    )
    if created is None:
        raise HTTPException(status_code=500, detail="Unable to create alert.")

    record = _map_alert_row(created)
    log_event(
        "price_alert_created",
        alert_id=record.id,
        listing_id=record.listing_id,
        owner_type="user" if request.user_id else "client",
    )
    return _to_response(record)


@router.post("/alerts/{alert_id}/deactivate", response_model=PriceAlertResponse)
async def deactivate_alert(
    alert_id: str,
    request: DeactivatePriceAlertRequest,
    repository: SupabaseMarketRepository = Depends(get_market_repository),
) -> PriceAlertResponse:
    row = await repository.deactivate_price_alert(
        alert_id=alert_id,
        user_id=request.user_id,
        client_id=request.client_id,
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Alert not found.")

    record = _map_alert_row(row)
    log_event(
        "price_alert_deactivated",
        alert_id=record.id,
        listing_id=record.listing_id,
        owner_type="user" if request.user_id else "client",
    )
    return _to_response(record)


@router.post("/alerts/process", response_model=ProcessPriceAlertsResponse)
async def process_alerts(
    request: ProcessPriceAlertsRequest,
    x_alerts_token: str | None = Header(default=None),
    repository: SupabaseMarketRepository = Depends(get_market_repository),
) -> ProcessPriceAlertsResponse:
    settings = get_settings()
    expected_token = (settings.alerts_processor_token or "").strip()
    if expected_token and x_alerts_token != expected_token:
        raise HTTPException(status_code=401, detail="Invalid alerts processor token.")

    processor = PriceAlertProcessor(repository=repository)
    result = await processor.process(dry_run=request.dry_run, limit=request.limit)
    log_event(
        "price_alert_process_completed",
        scanned=result.scanned,
        triggered=result.triggered,
        notified=result.notified,
        failed=result.failed,
        dry_run=result.dry_run,
    )
    return result
