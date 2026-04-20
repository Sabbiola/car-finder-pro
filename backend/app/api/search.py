import json
from typing import Union

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse, StreamingResponse

from app.core.dependencies import get_search_orchestrator
from app.core.listing_cache import get_listing_session_cache
from app.core.rate_limiter import _search_limit, _search_stream_limit, limiter
from app.models.search import SearchRequest, SearchResponse
from app.models.vehicle import VehicleListing
from app.services.search_orchestrator import SearchOrchestrator


router = APIRouter()


@router.post("/search", response_model=SearchResponse)
@limiter.limit(_search_limit)
async def search(
    request: Request,
    payload: SearchRequest,
    orchestrator: SearchOrchestrator = Depends(get_search_orchestrator),
) -> Union[SearchResponse, JSONResponse]:
    response = await orchestrator.run_search(payload)
    get_listing_session_cache().put_many(response.listings)
    has_no_eligible = any(
        detail.code in {"no_provider_eligible_for_filters", "no_provider"}
        for detail in response.provider_error_details
    )
    if has_no_eligible:
        return JSONResponse(status_code=422, content=response.model_dump(mode="json"))
    return response


@router.post("/search/stream")
@limiter.limit(_search_stream_limit)
async def search_stream(
    request: Request,
    payload: SearchRequest,
    orchestrator: SearchOrchestrator = Depends(get_search_orchestrator),
) -> StreamingResponse:
    cache = get_listing_session_cache()

    async def event_generator():
        async for event in orchestrator.stream_search(payload):
            try:
                event_name = event["event"]
                if event_name == "result":
                    listing_data = event.get("listing")
                    if listing_data and isinstance(listing_data, dict):
                        try:
                            cache.put_many([VehicleListing.model_validate(listing_data)])
                        except Exception:  # noqa: BLE001
                            pass
                serialized_event = json.dumps(event, ensure_ascii=False)
                yield f"event: {event_name}\ndata: {serialized_event}\n\n"
            except Exception:  # noqa: BLE001
                error_payload = json.dumps({"event": "error", "code": "serialization_error", "message": "Failed to serialize event"}, ensure_ascii=False)
                yield f"event: error\ndata: {error_payload}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"},
    )
