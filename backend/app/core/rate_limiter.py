from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.settings import get_settings


def _search_limit() -> str:
    return get_settings().search_rate_limit


def _search_stream_limit() -> str:
    return get_settings().search_stream_rate_limit


limiter = Limiter(key_func=get_remote_address)

