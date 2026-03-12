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
    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.get(endpoint)
        response.raise_for_status()
        return response.text

