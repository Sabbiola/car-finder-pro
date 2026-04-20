"""Scraping abstraction layer.

Supports three backends controlled by ``settings.scraping_backend``:

* ``"scrapingbee"`` (default) — cloud JS-rendering proxy; requires SCRAPINGBEE_API_KEY.
* ``"firecrawl"``             — Firecrawl cloud/self-hosted; requires FIRECRAWL_API_KEY
                                 when targeting the public SaaS; key is optional for a
                                 self-hosted instance at a custom FIRECRAWL_API_URL.
* ``"direct"``               — plain httpx GET + html2text conversion; no API key,
                                 no JS rendering; cheapest option, suitable when target
                                 pages do not require JavaScript.

All three return a markdown string compatible with the existing parsers.
"""

import asyncio
from urllib.parse import urlencode

import httpx

from app.core.request_context import get_request_id
from app.core.settings import get_settings

_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)


# ---------------------------------------------------------------------------
# Backend implementations
# ---------------------------------------------------------------------------


async def _fetch_direct(url: str, proxy_url: str | None = None) -> str:
    """Fetch a URL with a plain HTTP GET and convert HTML to markdown via html2text."""
    import html2text  # lazy import — only needed when this backend is active

    settings = get_settings()
    timeout = httpx.Timeout(settings.request_timeout_seconds)
    request_id = get_request_id()
    headers: dict[str, str] = {"User-Agent": _USER_AGENT}
    if request_id:
        headers["x-request-id"] = request_id

    # httpx 0.28+ uses `proxy` (single URL) instead of the removed `proxies` dict.
    proxy_kwargs: dict = {"proxy": proxy_url} if proxy_url else {}
    async with httpx.AsyncClient(timeout=timeout, **proxy_kwargs) as client:
        response = await client.get(url, headers=headers, follow_redirects=True)
        response.raise_for_status()

    converter = html2text.HTML2Text()
    converter.ignore_links = False
    converter.ignore_images = True
    converter.body_width = 0  # no hard line wrapping
    return converter.handle(response.text)


async def _fetch_firecrawl(url: str) -> str:
    """Fetch a URL via the Firecrawl /v1/scrape endpoint (cloud or self-hosted)."""
    settings = get_settings()
    api_url = settings.firecrawl_api_url.rstrip("/")
    api_key = settings.firecrawl_api_key

    headers: dict[str, str] = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    payload = {"url": url, "formats": ["markdown"]}
    timeout = httpx.Timeout(settings.request_timeout_seconds)

    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.post(f"{api_url}/v1/scrape", json=payload, headers=headers)

    if 400 <= response.status_code < 500:
        raise RuntimeError(f"Firecrawl non-retryable error {response.status_code}")
    if response.status_code >= 500:
        raise RuntimeError(f"Firecrawl transient error {response.status_code}")
    response.raise_for_status()

    data: dict = response.json()
    markdown: str = (data.get("data") or {}).get("markdown") or ""
    if not markdown:
        raise RuntimeError("Firecrawl returned empty markdown")
    return markdown


async def _fetch_scrapingbee(url: str, wait_ms: int, premium_proxy: bool) -> str:
    """Fetch a URL via the ScrapingBee cloud JS-rendering proxy."""
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
    request_id = get_request_id()
    req_headers: dict[str, str] | None = {"x-request-id": request_id} if request_id else None

    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.get(endpoint, headers=req_headers)

    if 400 <= response.status_code < 500:
        raise RuntimeError(f"ScrapingBee non-retryable error {response.status_code}")
    if response.status_code >= 500:
        raise RuntimeError(f"ScrapingBee transient error {response.status_code}")
    response.raise_for_status()
    return response.text


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


async def fetch_markdown(url: str, wait_ms: int = 7000, premium_proxy: bool = False) -> str:
    """Dispatch to the configured scraping backend and return page content as markdown.

    ``wait_ms`` and ``premium_proxy`` are forwarded only to the ScrapingBee backend;
    they are silently ignored by ``direct`` and ``firecrawl``.
    """
    settings = get_settings()
    backend = settings.scraping_backend
    attempts = max(settings.provider_retry_attempts, 1)
    backoff_ms = max(settings.provider_retry_backoff_ms, 0)
    last_error: Exception | None = None

    for attempt in range(1, attempts + 1):
        try:
            if backend == "direct":
                return await _fetch_direct(url, proxy_url=settings.direct_scraper_proxy_url)
            if backend == "firecrawl":
                return await _fetch_firecrawl(url)
            # Default: scrapingbee
            return await _fetch_scrapingbee(url, wait_ms=wait_ms, premium_proxy=premium_proxy)
        except Exception as exc:  # noqa: BLE001
            last_error = exc
            if attempt >= attempts:
                break
            sleep_seconds = (backoff_ms * attempt) / 1000
            if sleep_seconds > 0:
                await asyncio.sleep(sleep_seconds)

    raise RuntimeError(
        f"Scraping request failed after {attempts} attempt(s) [{backend}]: {last_error}"
    ) from last_error


def is_scraper_configured() -> bool:
    """Return True when the active scraping backend has all required credentials.

    Use this in each provider's ``is_configured()`` instead of checking
    ``scrapingbee_api_key`` directly.
    """
    settings = get_settings()
    backend = settings.scraping_backend
    if backend == "direct":
        return True
    if backend == "firecrawl":
        # A self-hosted instance at a non-default URL works without an API key.
        has_custom_url = settings.firecrawl_api_url != "https://api.firecrawl.dev"
        return bool(settings.firecrawl_api_key) or has_custom_url
    # scrapingbee (default)
    return bool(settings.scrapingbee_api_key)
