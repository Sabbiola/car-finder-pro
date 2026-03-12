import json

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from app.core.dependencies import get_search_orchestrator
from app.models.search import SearchRequest, SearchResponse
from app.services.search_orchestrator import SearchOrchestrator


router = APIRouter()


@router.post("/search", response_model=SearchResponse)
async def search(
    request: SearchRequest,
    orchestrator: SearchOrchestrator = Depends(get_search_orchestrator),
) -> SearchResponse:
    return await orchestrator.run_search(request)


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
