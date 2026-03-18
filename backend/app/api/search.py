import json
from typing import Union

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse, StreamingResponse

from app.core.dependencies import get_search_orchestrator
from app.core.rate_limiter import _search_limit, _search_stream_limit, limiter
from app.models.search import SearchRequest, SearchResponse
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
    async def event_generator():
        async for event in orchestrator.stream_search(payload):
            event_name = event["event"]
            serialized_event = json.dumps(event, ensure_ascii=False)
            yield f"event: {event_name}\ndata: {serialized_event}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"},
    )
