# Runtime Environment Profiles

This document defines the canonical environment variable sets for local, staging, and production.

## Frontend

- Local: [`frontend/.env.local.example`](../frontend/.env.local.example)
- Staging: [`frontend/.env.staging.example`](../frontend/.env.staging.example)
- Production: [`frontend/.env.production.example`](../frontend/.env.production.example)

## Backend FastAPI

- Local: [`backend/.env.local.example`](../backend/.env.local.example)
- Staging: [`backend/.env.staging.example`](../backend/.env.staging.example)
- Production: [`backend/.env.production.example`](../backend/.env.production.example)

## Supabase Edge Proxy

- Local: [`.env.edge.local.example`](../.env.edge.local.example)
- Staging: [`.env.edge.staging.example`](../.env.edge.staging.example)
- Production: [`.env.edge.production.example`](../.env.edge.production.example)

## Required Secrets (Deploy Blockers)

### Railway deploy

- `RAILWAY_TOKEN`
- `RAILWAY_PROJECT_ID`
- `RAILWAY_ENVIRONMENT_ID`
- `RAILWAY_SERVICE_ID`
- `FASTAPI_HEALTHCHECK_URL`

### Supabase functions deploy

- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_PROJECT_ID`

If one of these values is missing, deployment workflows fail by design.
