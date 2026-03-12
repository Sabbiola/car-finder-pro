from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.health import router as health_router
from app.api.metadata import router as metadata_router
from app.api.providers import router as providers_router
from app.api.search import router as search_router
from app.core.settings import get_settings


settings = get_settings()

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


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok"}

