import json
from typing import Union

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse, StreamingResponse

from app.core.dependencies import get_search_orchestrator
from app.models.search import SearchRequest, SearchResponse
from app.services.search_orchestrator import SearchOrchestrator


router = APIRouter()


@router.post("/search", response_model=SearchResponse)
async def search(
    request: SearchRequest,
    orchestrator: SearchOrchestrator = Depends(get_search_orchestrator),
) -> Union[SearchResponse, JSONResponse]:
    response = await orchestrator.run_search(request)
    has_no_eligible = any(
        detail.code in {"no_provider_eligible_for_filters", "no_provider"}
        for detail in response.provider_error_details
    )
    if has_no_eligible:
        return JSONResponse(status_code=422, content=response.model_dump(mode="json"))
    return response


@router.post("/search/stream")
async def search_stream(
    request: SearchRequest,
    orchestrator: SearchOrchestrator = Depends(get_search_orchestrator),
) -> StreamingResponse:
    async def event_generator():
        async for event in orchestrator.stream_search(request):
            event_name = event["event"]
            payload = json.dumps(event, ensure_ascii=False)
            yield f"event: {event_name}\ndata: {payload}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"},
    )
