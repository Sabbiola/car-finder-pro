# AGENTS.md

## Project overview
CarFinder Pro is a used-car multi-provider search and decision-support product.

Current repo reality:
- frontend app in `frontend/src/` (React + TypeScript + Vite)
- data and scraping backend currently in `supabase/functions/*` (Deno Edge Functions)
- database and auth in Supabase (`supabase/migrations`)
- a new Python FastAPI backend is being introduced under `backend/`

## How to work in this repo
Before coding:
1. Identify whether the change is frontend, edge-function backend, or FastAPI backend.
2. Read this file first.
3. If editing inside `frontend/` or `backend/`, prefer nested `AGENTS.md`.
4. Preserve behavior unless a migration step explicitly changes contracts.
5. Avoid large opportunistic rewrites.

## Target structure
```text
/frontend
  /src
    /features
    /components
    /pages
    /services
    /types
    /lib
/backend
  /app
    /api
    /core
    /models
    /providers
    /services
    /normalizers
    /ranking
    /dedup
    /tests
```

## Global coding rules
- Make the smallest safe change that solves the task.
- Prefer typed contracts over ad-hoc dictionaries.
- Keep modules single-responsibility.
- Do not hardcode secrets, production endpoints, or fake provider counts.
- Do not silently swallow provider/network errors.
- Keep frontend aligned with backend runtime reality.

## Shared API contract rules
- Search contracts must be explicit and versionable.
- Streaming event names are stable:
  - `progress`
  - `result`
  - `complete`
  - `error`
- Prefer additive changes over breaking semantic changes.

## Security rules
- Never commit secrets or credentials.
- Load credentials only from env/secret managers.
- Treat provider HTML/API payloads as untrusted input.
- Validate inbound request payloads with typed schemas.
- Use bounded timeout and retry policies for outbound calls.
- Avoid open-ended scraping loops.

## Testing policy
Every meaningful change should include or update tests.

Minimum expectations:
- frontend behavior changes: component/hook tests
- backend service changes: unit tests for parsing/normalization/scoring/contracts
- API changes: integration tests for request validation and SSE event shape

## Migration guidance
This repository currently runs in a hybrid mode:
- production path: Supabase Edge Functions
- migration path: FastAPI backend in `backend/`

Migration rule:
- keep compatibility for existing frontend behavior unless a migration step explicitly updates it.
