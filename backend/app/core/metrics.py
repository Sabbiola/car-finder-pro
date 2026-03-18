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


@dataclass
class _AnalysisSeries:
    search_ms: deque[int] = field(default_factory=lambda: deque(maxlen=5000))
    analysis_ms: deque[int] = field(default_factory=lambda: deque(maxlen=5000))
    repository_calls: int = 0
    cache_hits: int = 0
    cache_misses: int = 0


@dataclass
class _AlertsProcessorSeries:
    runs: int = 0
    dry_runs: int = 0
    idempotent_replays: int = 0
    scanned: int = 0
    triggered: int = 0
    notified: int = 0
    failed: int = 0


class RuntimeMetrics:
    def __init__(self) -> None:
        self._lock = Lock()
        self._search_sync = _SearchSeries()
        self._search_stream = _SearchSeries()
        self._http_by_path: dict[str, _HttpSeries] = {}
        self._analysis = _AnalysisSeries()
        self._alerts_processor = _AlertsProcessorSeries()
        self._stream_started = 0
        self._stream_completed = 0

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

    def record_analysis_breakdown(self, *, search_ms: int, analysis_ms: int) -> None:
        with self._lock:
            self._analysis.search_ms.append(max(search_ms, 0))
            self._analysis.analysis_ms.append(max(analysis_ms, 0))

    def record_repository_call(self, *, count: int = 1) -> None:
        with self._lock:
            self._analysis.repository_calls += max(count, 0)

    def record_cache_event(self, *, hit: bool) -> None:
        with self._lock:
            if hit:
                self._analysis.cache_hits += 1
            else:
                self._analysis.cache_misses += 1

    def record_stream_started(self) -> None:
        with self._lock:
            self._stream_started += 1

    def record_stream_completed(self) -> None:
        with self._lock:
            self._stream_completed += 1

    def record_alerts_processor_run(
        self,
        *,
        scanned: int,
        triggered: int,
        notified: int,
        failed: int,
        dry_run: bool,
        idempotent_replay: bool,
    ) -> None:
        with self._lock:
            self._alerts_processor.runs += 1
            if dry_run:
                self._alerts_processor.dry_runs += 1
            if idempotent_replay:
                self._alerts_processor.idempotent_replays += 1
            self._alerts_processor.scanned += max(scanned, 0)
            self._alerts_processor.triggered += max(triggered, 0)
            self._alerts_processor.notified += max(notified, 0)
            self._alerts_processor.failed += max(failed, 0)

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

    @staticmethod
    def _analysis_snapshot(series: _AnalysisSeries) -> dict[str, object]:
        search = list(series.search_ms)
        analysis = list(series.analysis_ms)
        cache_total = series.cache_hits + series.cache_misses
        return {
            "search_vs_analysis_ms": {
                "search_p50_ms": _percentile(search, 0.5),
                "search_p95_ms": _percentile(search, 0.95),
                "analysis_p50_ms": _percentile(analysis, 0.5),
                "analysis_p95_ms": _percentile(analysis, 0.95),
                "latest_count": min(len(search), len(analysis)),
            },
            "repository_calls_count": series.repository_calls,
            "cache_hit_rate": round((series.cache_hits / cache_total), 4) if cache_total else 0.0,
            "cache_hits": series.cache_hits,
            "cache_misses": series.cache_misses,
        }

    @staticmethod
    def _alerts_processor_snapshot(series: _AlertsProcessorSeries) -> dict[str, object]:
        trigger_total = series.triggered
        return {
            "runs": series.runs,
            "dry_runs": series.dry_runs,
            "idempotent_replays": series.idempotent_replays,
            "scanned_total": series.scanned,
            "triggered_total": trigger_total,
            "notified_total": series.notified,
            "failed_total": series.failed,
            "notification_success_rate": round((series.notified / trigger_total), 4)
            if trigger_total
            else 1.0,
            "failure_rate": round((series.failed / trigger_total), 4) if trigger_total else 0.0,
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
                "analysis": self._analysis_snapshot(self._analysis),
                "alerts_processor": self._alerts_processor_snapshot(self._alerts_processor),
                "stream_completion": {
                    "started": self._stream_started,
                    "completed": self._stream_completed,
                    "completion_rate": round((self._stream_completed / self._stream_started), 4)
                    if self._stream_started
                    else 1.0,
                },
            }


_METRICS = RuntimeMetrics()


def get_runtime_metrics() -> RuntimeMetrics:
    return _METRICS
