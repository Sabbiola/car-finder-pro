from functools import lru_cache

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "CarFinder Pro API"
    env: str = "development"
    log_level: str = "info"
    fastapi_root_path: str = ""
    cors_origins: list[str] = Field(
        default_factory=lambda: ["http://localhost:8080", "http://localhost:5173"]
    )
    request_timeout_seconds: int = 20
    max_provider_concurrency: int = 4
    provider_timeout_seconds: int = 30
    provider_retry_attempts: int = 3
    provider_retry_backoff_ms: int = 250
    disabled_providers: list[str] = Field(default_factory=list)
    scrapingbee_api_key: str | None = None
    ebay_client_id: str | None = None
    ebay_client_secret: str | None = None
    ebay_marketplace_id: str = "EBAY_IT"
    observability_webhook_url: str | None = None
    observability_webhook_timeout_seconds: int = 2
    legacy_scrape_listings_url: str | None = None
    fastapi_proxy_mode: str = "primary_with_fallback"
    test_stub_mode: bool = False

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_origins(cls, value: object) -> list[str]:
        if isinstance(value, str):
            return [item.strip() for item in value.split(",") if item.strip()]
        if isinstance(value, list):
            return [str(item).strip() for item in value if str(item).strip()]
        return ["http://localhost:8080", "http://localhost:5173"]

    @field_validator("disabled_providers", mode="before")
    @classmethod
    def parse_disabled_providers(cls, value: object) -> list[str]:
        if isinstance(value, str):
            return [item.strip() for item in value.split(",") if item.strip()]
        if isinstance(value, list):
            return [str(item).strip() for item in value if str(item).strip()]
        return []


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
