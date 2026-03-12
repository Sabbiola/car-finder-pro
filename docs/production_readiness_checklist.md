# Production Readiness Checklist

## Release Gate (PR Blockers)

The following jobs must be green on every PR:

- `frontend` (lint, unit tests, build)
- `backend` (unit/integration tests)
- `edge-functions` (typecheck + contract tests)
- `e2e` (Playwright smoke, deterministic stub mode)
- `release-gate` (aggregate gate)

## Branch Protection

Configure branch protection on `main` with required status checks:

- `frontend`
- `backend`
- `edge-functions`
- `e2e`
- `release-gate`

Also enable:

- require pull request before merge
- require branches up to date before merge
- block force-push and branch deletion

## Proxy Transition Rollback Modes

`supabase/functions/scrape-listings` supports:

- `FASTAPI_PROXY_MODE=primary_with_fallback`
- `FASTAPI_PROXY_MODE=fastapi_only`
- `FASTAPI_PROXY_MODE=legacy_only`

Observability tags for transition path:

- `fastapi`
- `legacy`
- `fallback_triggered`
- `fastapi_error`

## Cutover Plan

1. Keep `primary_with_fallback` for one stable release.
2. Validate error rate and latency SLOs.
3. Switch staging to `fastapi_only`.
4. Run smoke + rollback drill.
5. Promote `fastapi_only` to production.
6. Remove fallback only after all legacy providers are migrated or explicitly sunset.
