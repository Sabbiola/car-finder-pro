from fastapi import APIRouter, Depends, Header, HTTPException, Query

from app.core.observability import log_event
from app.core.settings import get_settings
from app.core.metrics import get_runtime_metrics
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


def _map_alert_row(row: dict, latest_attempt: dict | None = None) -> PriceAlertRecord:
    listing_rel = row.get("car_listings")
    if isinstance(listing_rel, list):
        listing_rel = listing_rel[0] if listing_rel else None
    listing = AlertListingSummary.model_validate(listing_rel) if isinstance(listing_rel, dict) else None
    latest_status = str((latest_attempt or {}).get("status") or "") or None
    retry_count = int((latest_attempt or {}).get("attempt_number") or 0)
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
        delivery_status=latest_status,
        last_delivery_error=(latest_attempt or {}).get("error_message"),
        last_delivery_attempt_at=(latest_attempt or {}).get("created_at"),
        retry_count=retry_count,
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
    latest_attempts = await repository.fetch_latest_delivery_attempts([str(row.get("id") or "") for row in rows])
    records = [_map_alert_row(row, latest_attempts.get(str(row.get("id") or ""))) for row in rows]
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
        latest_attempts = await repository.fetch_latest_delivery_attempts([str(existing.get("id") or "")])
        record = _map_alert_row(existing, latest_attempts.get(str(existing.get("id") or "")))
        return _to_response(record)

    created = await repository.create_price_alert(
        listing_id=request.listing_id,
        target_price=request.target_price,
        user_id=request.user_id,
        client_id=request.client_id,
    )
    if created is None:
        raise HTTPException(status_code=500, detail="Unable to create alert.")

    latest_attempts = await repository.fetch_latest_delivery_attempts([str(created.get("id") or "")])
    record = _map_alert_row(created, latest_attempts.get(str(created.get("id") or "")))
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

    latest_attempts = await repository.fetch_latest_delivery_attempts([str(row.get("id") or "")])
    record = _map_alert_row(row, latest_attempts.get(str(row.get("id") or "")))
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
    provided_token = (x_alerts_token or "").strip()
    if expected_token and provided_token != expected_token:
        raise HTTPException(status_code=401, detail="Invalid alerts processor token.")

    processor = PriceAlertProcessor(repository=repository)
    result = await processor.process(
        dry_run=request.dry_run,
        limit=request.limit,
        idempotency_key=request.idempotency_key,
    )
    get_runtime_metrics().record_alerts_processor_run(
        scanned=result.scanned,
        triggered=result.triggered,
        notified=result.notified,
        failed=result.failed,
        dry_run=result.dry_run,
        idempotent_replay=result.idempotent_replay,
    )
    log_event(
        "price_alert_process_completed",
        run_id=result.run_id,
        idempotent_replay=result.idempotent_replay,
        scanned=result.scanned,
        triggered=result.triggered,
        notified=result.notified,
        failed=result.failed,
        dry_run=result.dry_run,
    )
    return result
