from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.dependencies import get_market_repository
from app.core.observability import log_event
from app.models.user_data import (
    FavoriteDeleteRequest,
    FavoriteListResponse,
    FavoriteRecord,
    FavoriteUpsertRequest,
    ListingsBatchRequest,
    ListingsBatchResponse,
    SavedSearchCreateRequest,
    SavedSearchDeleteRequest,
    SavedSearchListResponse,
    SavedSearchRecord,
)
from app.services.supabase_market_repository import SupabaseMarketRepository


router = APIRouter()


@router.get("/user/favorites", response_model=FavoriteListResponse)
async def list_user_favorites(
    user_id: str = Query(..., min_length=1),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    repository: SupabaseMarketRepository = Depends(get_market_repository),
) -> FavoriteListResponse:
    rows = await repository.fetch_user_favorite_rows(user_id=user_id, limit=limit, offset=offset)
    return FavoriteListResponse(
        favorites=[
            FavoriteRecord(
                listing_id=str(row.get("listing_id")),
                created_at=row.get("created_at"),
            )
            for row in rows
            if row.get("listing_id")
        ]
    )


@router.post("/user/favorites", response_model=FavoriteListResponse)
async def add_user_favorite(
    request: FavoriteUpsertRequest,
    repository: SupabaseMarketRepository = Depends(get_market_repository),
) -> FavoriteListResponse:
    await repository.add_user_favorite(user_id=request.user_id, listing_id=request.listing_id)
    rows = await repository.fetch_user_favorite_rows(user_id=request.user_id)
    log_event("user_favorite_added", user_id=request.user_id, listing_id=request.listing_id)
    return FavoriteListResponse(
        favorites=[
            FavoriteRecord(
                listing_id=str(row.get("listing_id")),
                created_at=row.get("created_at"),
            )
            for row in rows
            if row.get("listing_id")
        ]
    )


@router.delete("/user/favorites/{listing_id}", response_model=FavoriteListResponse)
async def remove_user_favorite(
    listing_id: str,
    request: FavoriteDeleteRequest,
    repository: SupabaseMarketRepository = Depends(get_market_repository),
) -> FavoriteListResponse:
    await repository.remove_user_favorite(user_id=request.user_id, listing_id=listing_id)
    rows = await repository.fetch_user_favorite_rows(user_id=request.user_id)
    log_event("user_favorite_removed", user_id=request.user_id, listing_id=listing_id)
    return FavoriteListResponse(
        favorites=[
            FavoriteRecord(
                listing_id=str(row.get("listing_id")),
                created_at=row.get("created_at"),
            )
            for row in rows
            if row.get("listing_id")
        ]
    )


def _row_to_saved_search_record(row: dict) -> SavedSearchRecord:
    raw_filters: dict = row.get("filters") or {}
    alert_enabled = bool(raw_filters.pop("__alert_enabled", False))
    return SavedSearchRecord(
        id=str(row.get("id")),
        name=str(row.get("name") or ""),
        filters=raw_filters,
        created_at=row.get("created_at"),
        alert_enabled=alert_enabled,
    )


@router.get("/user/saved-searches", response_model=SavedSearchListResponse)
async def list_saved_searches(
    user_id: str = Query(..., min_length=1),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    repository: SupabaseMarketRepository = Depends(get_market_repository),
) -> SavedSearchListResponse:
    rows = await repository.fetch_user_saved_search_rows(user_id=user_id, limit=limit, offset=offset)
    return SavedSearchListResponse(
        saved_searches=[
            _row_to_saved_search_record(dict(row))
            for row in rows
            if row.get("id") and row.get("created_at")
        ]
    )


@router.post("/user/saved-searches", response_model=SavedSearchRecord)
async def create_saved_search(
    request: SavedSearchCreateRequest,
    repository: SupabaseMarketRepository = Depends(get_market_repository),
) -> SavedSearchRecord:
    merged_filters = {**request.filters, "__alert_enabled": request.alert_enabled}
    row = await repository.create_user_saved_search(
        user_id=request.user_id,
        name=request.name,
        filters=merged_filters,
    )
    if not row:
        raise HTTPException(status_code=500, detail="Unable to create saved search.")
    log_event(
        "user_saved_search_created",
        user_id=request.user_id,
        saved_search_id=row.get("id"),
        alert_enabled=request.alert_enabled,
    )
    return _row_to_saved_search_record(dict(row))


@router.delete("/user/saved-searches/{search_id}")
async def delete_saved_search(
    search_id: str,
    request: SavedSearchDeleteRequest,
    repository: SupabaseMarketRepository = Depends(get_market_repository),
) -> dict[str, bool]:
    deleted = await repository.delete_user_saved_search(user_id=request.user_id, search_id=search_id)
    log_event("user_saved_search_deleted", user_id=request.user_id, saved_search_id=search_id, deleted=deleted)
    return {"deleted": deleted}


@router.post("/listings/batch", response_model=ListingsBatchResponse)
async def listings_batch(
    request: ListingsBatchRequest,
    repository: SupabaseMarketRepository = Depends(get_market_repository),
) -> ListingsBatchResponse:
    rows = await repository.fetch_listing_rows_by_ids(request.ids)
    by_id = {str(row.get("id")): repository.row_to_listing(row) for row in rows if row.get("id")}
    ordered = [by_id[item] for item in request.ids if item in by_id]
    return ListingsBatchResponse(listings=ordered)
