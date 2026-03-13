from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.observability import log_event
from app.core.dependencies import get_analysis_service, get_market_repository
from app.models.listing_detail import ListingDetailResponse, ListingPriceHistoryPoint
from app.services.analysis_service import AnalysisService
from app.services.supabase_market_repository import SupabaseMarketRepository


router = APIRouter()


@router.get("/listings/{listing_id}", response_model=ListingDetailResponse)
async def listing_detail(
    listing_id: str,
    source_url: str | None = Query(default=None),
    include_analysis: bool = False,
    include_context: bool = True,
    include: list[str] = Query(default=["deal", "trust", "negotiation", "ownership"]),
    repository: SupabaseMarketRepository = Depends(get_market_repository),
    analysis_service: AnalysisService = Depends(get_analysis_service),
) -> ListingDetailResponse:
    row = await repository.fetch_listing_row_by_id(listing_id)
    resolved_by = "id"
    if row is None and source_url:
        row = await repository.fetch_listing_row_by_source_url(source_url)
        resolved_by = "source_url"

    if row is None:
        raise HTTPException(status_code=404, detail="Listing not found.")

    listing = repository.row_to_listing(row)
    analysis = None
    if include_analysis:
        analysis = await analysis_service.analyze_listing(
            listing,
            include=include,
            local_candidates=[listing],
            use_snapshot=True,
        )

    similar_listings = []
    price_samples = []
    price_history: list[ListingPriceHistoryPoint] = []
    if include_context and listing.make and listing.model:
        brand_model_rows = await repository.fetch_brand_model_rows(
            brand=listing.make,
            model=listing.model,
            order_by="price.asc",
            limit=30,
        )
        price_samples = [repository.row_to_listing(item) for item in brand_model_rows]
        similar_listings = [item for item in price_samples if item.id != listing.id][:6]

    if include_context and listing.id:
        raw_history = await repository.fetch_price_history(listing.id, limit=30)
        price_history = [
            ListingPriceHistoryPoint.model_validate(item)
            for item in raw_history
            if item.get("price") is not None and item.get("recorded_at")
        ]

    log_event(
        "listing_detail_served",
        listing_id=listing.id or listing_id,
        include_analysis=include_analysis,
        include_context=include_context,
        resolved_by=resolved_by,
    )
    return ListingDetailResponse(
        listing=listing,
        analysis=analysis,
        similar_listings=similar_listings,
        price_samples=price_samples,
        price_history=price_history,
        resolved_by=resolved_by,
    )
