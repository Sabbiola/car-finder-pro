from time import perf_counter
from uuid import uuid4

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.requests import Request

from app.api.health import router as health_router
from app.api.metadata import router as metadata_router
from app.api.providers import router as providers_router
from app.api.search import router as search_router
from app.core.observability import configure_logging, log_event
from app.core.request_context import set_request_id
from app.core.settings import get_settings


settings = get_settings()
configure_logging(
    settings.log_level,
    webhook_url=settings.observability_webhook_url,
    webhook_timeout_seconds=settings.observability_webhook_timeout_seconds,
)

app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    root_path=settings.fastapi_root_path,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(search_router, prefix="/api", tags=["search"])
app.include_router(providers_router, prefix="/api", tags=["providers"])
app.include_router(health_router, prefix="/api", tags=["health"])
app.include_router(metadata_router, prefix="/api", tags=["metadata"])


@app.middleware("http")
async def request_id_middleware(request: Request, call_next):
    request_id = request.headers.get("x-request-id") or str(uuid4())
    set_request_id(request_id)
    request.state.request_id = request_id
    started_at = perf_counter()
    status_code = 500
    try:
        response = await call_next(request)
        status_code = response.status_code
        response.headers["x-request-id"] = request_id
        return response
    finally:
        duration_ms = int((perf_counter() - started_at) * 1000)
        log_event(
            "http_request_completed",
            method=request.method,
            path=str(request.url.path),
            status_code=status_code,
            duration_ms=duration_ms,
        )


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok"}
