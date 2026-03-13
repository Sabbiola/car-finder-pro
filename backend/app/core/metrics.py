from __future__ import annotations

from collections import deque
from dataclasses import dataclass, field
from threading import Lock


def _percentile(values: list[int], ratio: float) -> int | None:
    if not values:
        return None
    ordered = sorted(values)
    index = int((len(ordered) - 1) * ratio)
    return ordered[index]


@dataclass
class _SearchSeries:
    total: int = 0
    errored: int = 0
    durations_ms: deque[int] = field(default_factory=lambda: deque(maxlen=5000))


@dataclass
class _HttpSeries:
    total: int = 0
    failed: int = 0
    durations_ms: deque[int] = field(default_factory=lambda: deque(maxlen=5000))


class RuntimeMetrics:
    def __init__(self) -> None:
        self._lock = Lock()
        self._search_sync = _SearchSeries()
        self._search_stream = _SearchSeries()
        self._http_by_path: dict[str, _HttpSeries] = {}

    def record_search(self, *, mode: str, duration_ms: int, had_errors: bool) -> None:
        series = self._search_stream if mode == "stream" else self._search_sync
        with self._lock:
            series.total += 1
            if had_errors:
                series.errored += 1
            series.durations_ms.append(max(duration_ms, 0))

    def record_http(self, *, path: str, status_code: int, duration_ms: int) -> None:
        with self._lock:
            series = self._http_by_path.setdefault(path, _HttpSeries())
            series.total += 1
            if status_code >= 500:
                series.failed += 1
            series.durations_ms.append(max(duration_ms, 0))

    @staticmethod
    def _search_snapshot(series: _SearchSeries) -> dict[str, float | int | None]:
        durations = list(series.durations_ms)
        return {
            "total": series.total,
            "errored": series.errored,
            "error_rate": round((series.errored / series.total), 4) if series.total else 0.0,
            "p50_ms": _percentile(durations, 0.5),
            "p95_ms": _percentile(durations, 0.95),
            "latest_count": len(durations),
        }

    @staticmethod
    def _http_snapshot(series: _HttpSeries) -> dict[str, float | int | None]:
        durations = list(series.durations_ms)
        return {
            "total": series.total,
            "failed": series.failed,
            "error_rate": round((series.failed / series.total), 4) if series.total else 0.0,
            "p50_ms": _percentile(durations, 0.5),
            "p95_ms": _percentile(durations, 0.95),
            "latest_count": len(durations),
        }

    def snapshot(self) -> dict[str, object]:
        with self._lock:
            http_snapshot = {
                path: self._http_snapshot(series) for path, series in self._http_by_path.items()
            }
            return {
                "search": {
                    "sync": self._search_snapshot(self._search_sync),
                    "stream": self._search_snapshot(self._search_stream),
                },
                "http": http_snapshot,
            }


_METRICS = RuntimeMetrics()


def get_runtime_metrics() -> RuntimeMetrics:
    return _METRICS
