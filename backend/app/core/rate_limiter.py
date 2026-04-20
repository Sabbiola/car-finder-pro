import base64
import json
import logging

from slowapi import Limiter
from slowapi.util import get_remote_address
from starlette.requests import Request

from app.core.settings import get_settings

_logger = logging.getLogger("carfinder")


def _search_limit() -> str:
    return get_settings().search_rate_limit


def _search_stream_limit() -> str:
    return get_settings().search_stream_rate_limit


def _get_rate_limit_key(request: Request) -> str:
    """Use user_id from JWT Bearer token when available; fall back to IP address.

    The JWT payload is decoded (not verified — Supabase already verified it) solely
    to extract the stable ``sub`` claim for per-user bucketing.
    """
    auth = request.headers.get("authorization", "")
    if auth.startswith("Bearer "):
        token = auth[7:]
        parts = token.split(".")
        if len(parts) == 3:
            try:
                # Re-pad the base64url payload segment before decoding.
                payload_b64 = parts[1] + "=" * (-len(parts[1]) % 4)
                payload = json.loads(base64.urlsafe_b64decode(payload_b64))
                sub = payload.get("sub")
                if sub and isinstance(sub, str):
                    return f"user:{sub}"
            except Exception:  # noqa: BLE001
                _logger.debug("rate_limiter: failed to decode JWT payload; using IP")
    return get_remote_address(request)


limiter = Limiter(key_func=_get_rate_limit_key)

