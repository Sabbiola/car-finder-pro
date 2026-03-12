from fastapi import APIRouter, Depends, HTTPException

from app.core.dependencies import get_analysis_service
from app.models.analysis_request import AnalyzeListingRequest, AnalyzeListingResponse
from app.services.analysis_service import AnalysisService


router = APIRouter()


@router.post("/listings/analyze", response_model=AnalyzeListingResponse)
async def analyze_listing(
    request: AnalyzeListingRequest,
    analysis_service: AnalysisService = Depends(get_analysis_service),
) -> AnalyzeListingResponse:
    try:
        analysis = await analysis_service.analyze_request(request)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return AnalyzeListingResponse.model_validate(analysis.model_dump(mode="json"))
