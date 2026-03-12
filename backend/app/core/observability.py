import json
import logging
from datetime import datetime, timezone
from typing import Any

from app.core.request_context import get_request_id


LOGGER_NAME = "carfinder"


def configure_logging(log_level: str) -> None:
    level = getattr(logging, log_level.upper(), logging.INFO)
    root = logging.getLogger()
    if not root.handlers:
        logging.basicConfig(level=level, format="%(message)s")
    root.setLevel(level)
    logging.getLogger(LOGGER_NAME).setLevel(level)


def log_event(event: str, *, level: int = logging.INFO, **fields: Any) -> None:
    payload: dict[str, Any] = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "event": event,
        "request_id": get_request_id(),
    }
    payload.update(fields)
    logging.getLogger(LOGGER_NAME).log(level, json.dumps(payload, ensure_ascii=True, default=str))
