# SLO Baseline (FastAPI-first)

## Target SLO (Go-Live Gate)

- `search sync p95 < 5s`
- `search stream error rate < 2%`
- `provider success rate >= 98%` (rolling 24h)
- `stream completion rate >= 98%` (rolling 24h)

## Baseline Metrics To Capture

- `http_request_completed` by path and status code
- `provider_search_completed` by provider, status, duration
- `search_completed` by mode (`sync`, `stream`), duration, provider_errors
- Frontend stream lifecycle:
  - stream started
  - stream completed
  - stream aborted
  - stream parser error

## Required Dashboards

- Search latency: p50/p95 for `/api/search` and `/api/search/stream`
- Provider health: success/timeout/failure ratio per provider
- Stream health: completion rate, abort rate, average duration
- Error taxonomy: `provider_not_configured`, `unsupported_filter`, `provider_timeout`, `provider_failure`, `no_provider`

## Alert Thresholds

- p95 search latency > 5s for 15 min
- provider error rate > 2% for 15 min
- stream completion rate < 98% for 15 min
- `no_provider` or `provider_not_configured` spikes after deploy
