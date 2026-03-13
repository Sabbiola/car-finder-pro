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
    analysis_max_concurrency: int = 8
    disabled_providers: str = ""
    scrapingbee_api_key: str | None = None
    ebay_client_id: str | None = None
    ebay_client_secret: str | None = None
    ebay_marketplace_id: str = "EBAY_IT"
    observability_webhook_url: str | None = None
    observability_webhook_timeout_seconds: int = 2
    alerts_processor_token: str | None = None
    alerts_retry_max_attempts: int = 3
    alerts_retry_base_seconds: int = 300
    resend_api_key: str | None = None
    resend_from_email: str | None = None
    resend_base_url: str = "https://api.resend.com"
    supabase_url: str | None = None
    supabase_service_role_key: str | None = None
    supabase_anon_key: str | None = None
    analysis_snapshot_ttl_hours: int = 24
    negotiation_llm_enabled: bool = False
    legacy_scrape_listings_url: str | None = None
    fastapi_proxy_mode: str = "primary_with_fallback"
    ops_token: str | None = None
    test_stub_mode: bool = False

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_origins(cls, value: object) -> list[str]:
        if isinstance(value, str):
            return [item.strip() for item in value.split(",") if item.strip()]
        if isinstance(value, list):
            return [str(item).strip() for item in value if str(item).strip()]
        return ["http://localhost:8080", "http://localhost:5173"]

    @property
    def disabled_provider_list(self) -> list[str]:
        if not self.disabled_providers:
            return []
        return [item.strip() for item in self.disabled_providers.split(",") if item.strip()]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
