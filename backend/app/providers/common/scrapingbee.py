import asyncio
from urllib.parse import urlencode

import httpx

from app.core.settings import get_settings


async def fetch_markdown(url: str, wait_ms: int = 7000, premium_proxy: bool = False) -> str:
    settings = get_settings()
    if not settings.scrapingbee_api_key:
        raise RuntimeError("SCRAPINGBEE_API_KEY is not configured")

    params = {
        "api_key": settings.scrapingbee_api_key,
        "url": url,
        "render_js": "true",
        "return_page_markdown": "true",
        "block_resources": "false",
        "wait": str(wait_ms),
        "country_code": "it",
    }
    if premium_proxy:
        params["premium_proxy"] = "true"

    endpoint = f"https://app.scrapingbee.com/api/v1/?{urlencode(params)}"
    timeout = httpx.Timeout(settings.request_timeout_seconds)
    attempts = max(settings.provider_retry_attempts, 1)
    backoff_ms = max(settings.provider_retry_backoff_ms, 0)
    last_error: Exception | None = None
    for attempt in range(1, attempts + 1):
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.get(endpoint)
            if response.status_code >= 500:
                raise RuntimeError(f"ScrapingBee transient error {response.status_code}")
            response.raise_for_status()
            return response.text
        except Exception as exc:  # noqa: BLE001
            last_error = exc
            if attempt >= attempts:
                break
            sleep_seconds = (backoff_ms * attempt) / 1000
            if sleep_seconds > 0:
                await asyncio.sleep(sleep_seconds)
    raise RuntimeError(f"ScrapingBee request failed after retries: {last_error}") from last_error
