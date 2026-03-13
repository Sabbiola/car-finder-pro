# Production Readiness Backlog

## P0 (Must Fix Before Full Cutover)

- Unify search contract across frontend, FastAPI, edge proxy.
- Keep SSE `complete` consistent with final deduped result set.
- Add machine-readable provider error details in sync and stream flows.
- Migrate remaining legacy providers (`automobile`, `brumbrum`) to FastAPI provider architecture.
- Add canary deploy + rollback drill checklist for `fastapi_only`.

## P1 (Hardening)

- Reduce N+1 queries in repository layer for image/seller fingerprint lookups.
- Add request/provider correlation IDs through frontend -> backend -> provider logs.
- Add provider-level timeout and failure alerts with operational runbook.
- Extend E2E scenarios for search + detail + compare + alerts.
- Add load test workflow for `/api/search` and `/api/search/stream`.

## P2 (Quality and Parity)

- Move listing detail read path to backend API where possible.
- Complete price alerts pipeline (persist + trigger + notify + state).
- Improve UX for partial provider failures and unsupported filters.
- Fix frontend string encoding issues in pages/components.
- Expand metadata-driven UI behavior (capability-aware controls).
