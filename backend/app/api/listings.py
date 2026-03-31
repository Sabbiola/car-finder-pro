from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.observability import log_event
from app.core.dependencies import get_analysis_service, get_market_repository
from app.models.listing_detail import ListingDetailResponse, ListingPriceHistoryPoint
from app.models.vehicle import VehicleListing
from app.providers.autoscout24.parser import parse_autoscout_detail_markdown
from app.providers.common.scrapingbee import fetch_markdown
from app.services.analysis_service import AnalysisService
from app.services.supabase_market_repository import SupabaseMarketRepository


router = APIRouter()


def _is_autoscout_listing_url(url: str | None) -> bool:
    if not url:
        return False
    normalized = url.lower()
    return "autoscout24." in normalized and "/annunci/" in normalized


def _needs_autoscout_enrichment(listing: VehicleListing) -> bool:
    return any(
        [
            not listing.description,
            not listing.power,
            not listing.doors,
            not listing.emission_class,
            not listing.seller_type,
            len(listing.images) <= 1,
        ]
    )


def _merge_enriched_listing(base: VehicleListing, enriched: VehicleListing) -> VehicleListing:
    # Keep persisted values when already present and use scraped detail for missing fields.
    merged = base.model_copy(deep=True)
    for field in (
        "description",
        "power",
        "doors",
        "seats",
        "emission_class",
        "condition",
        "color",
        "seller_type",
        "fuel_type",
        "transmission",
        "body_style",
        "city",
    ):
        if getattr(merged, field) in (None, "", 0):
            setattr(merged, field, getattr(enriched, field))

    if not merged.make:
        merged.make = enriched.make
    if not merged.model:
        merged.model = enriched.model
    if not merged.year:
        merged.year = enriched.year
    if not merged.mileage_value:
        merged.mileage_value = enriched.mileage_value
    if not merged.url:
        merged.url = enriched.url
    if len(merged.images) <= 1 and len(enriched.images) > len(merged.images):
        merged.images = enriched.images
    return merged


async def _try_fetch_autoscout_detail(source_url: str) -> VehicleListing | None:
    try:
        markdown = await fetch_markdown(source_url, wait_ms=6000, premium_proxy=True)
    except Exception as exc:  # noqa: BLE001
        log_event("listing_detail_autoscout_fetch_failed", source_url=source_url, error=str(exc))
        return None
    return parse_autoscout_detail_markdown(markdown, source_url=source_url)


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
    listing: VehicleListing | None = None
    if row is None and source_url:
        row = await repository.fetch_listing_row_by_source_url(source_url)
        resolved_by = "source_url"
    if row is not None:
        listing = repository.row_to_listing(row)

    if listing is None and source_url and _is_autoscout_listing_url(source_url):
        listing = await _try_fetch_autoscout_detail(source_url)
        if listing is not None:
            resolved_by = "source_url_live"

    if listing is None:
        raise HTTPException(status_code=404, detail="Listing not found.")

    if source_url and _is_autoscout_listing_url(source_url) and _needs_autoscout_enrichment(listing):
        enriched = await _try_fetch_autoscout_detail(source_url)
        if enriched is not None:
            listing = _merge_enriched_listing(listing, enriched)
            if resolved_by == "source_url":
                resolved_by = "source_url_enriched"
            elif resolved_by == "id":
                resolved_by = "id_enriched"
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
