import json
import logging
from datetime import datetime, timezone
from queue import Empty, Full, Queue
from threading import Lock, Thread
from typing import Any
from urllib.error import URLError
from urllib.request import Request, urlopen

from app.core.request_context import get_request_id


LOGGER_NAME = "carfinder"
_SINK_QUEUE_MAXSIZE = 1000

_sink_lock = Lock()
_sink_queue: Queue[str] | None = None
_sink_thread_started = False
_sink_url: str | None = None
_sink_timeout_seconds = 2


def _sink_worker() -> None:
    logger = logging.getLogger(LOGGER_NAME)
    while True:
        if _sink_queue is None:
            return
        try:
            payload = _sink_queue.get(timeout=0.5)
        except Empty:
            continue
        try:
            if not _sink_url:
                continue
            req = Request(
                _sink_url,
                data=payload.encode("utf-8"),
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urlopen(req, timeout=_sink_timeout_seconds):
                pass
        except URLError as exc:
            logger.debug("observability sink post failed: %s", exc)
        except Exception as exc:  # noqa: BLE001
            logger.debug("observability sink unexpected error: %s", exc)


def _configure_sink(url: str | None, timeout_seconds: int) -> None:
    global _sink_queue, _sink_thread_started, _sink_timeout_seconds, _sink_url

    normalized_url = (url or "").strip() or None
    _sink_timeout_seconds = max(timeout_seconds, 1)
    _sink_url = normalized_url
    if not normalized_url:
        return

    with _sink_lock:
        if _sink_queue is None:
            _sink_queue = Queue(maxsize=_SINK_QUEUE_MAXSIZE)
        if _sink_thread_started:
            return
        thread = Thread(target=_sink_worker, name="observability-sink-worker", daemon=True)
        thread.start()
        _sink_thread_started = True


def configure_logging(
    log_level: str,
    *,
    webhook_url: str | None = None,
    webhook_timeout_seconds: int = 2,
) -> None:
    level = getattr(logging, log_level.upper(), logging.INFO)
    root = logging.getLogger()
    if not root.handlers:
        logging.basicConfig(level=level, format="%(message)s")
    root.setLevel(level)
    logging.getLogger(LOGGER_NAME).setLevel(level)
    _configure_sink(webhook_url, webhook_timeout_seconds)


def log_event(event: str, *, level: int = logging.INFO, **fields: Any) -> None:
    payload: dict[str, Any] = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "event": event,
        "request_id": get_request_id(),
    }
    payload.update(fields)
    serialized = json.dumps(payload, ensure_ascii=True, default=str)
    logging.getLogger(LOGGER_NAME).log(level, serialized)

    if _sink_queue is None or _sink_url is None:
        return
    try:
        _sink_queue.put_nowait(serialized)
    except Full:
        logging.getLogger(LOGGER_NAME).debug("observability sink queue full; dropping event")
