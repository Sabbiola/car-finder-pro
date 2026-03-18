# Runtime Environment Profiles

Questo documento definisce la fonte operativa unica per le variabili ambiente su locale, staging e produzione.

## Fonte Canonica dei Profili

Usare sempre questi file come source of truth:

### Frontend

- Local: [`frontend/.env.local.example`](../frontend/.env.local.example)
- Staging: [`frontend/.env.staging.example`](../frontend/.env.staging.example)
- Production: [`frontend/.env.production.example`](../frontend/.env.production.example)

### Backend FastAPI

- Local: [`backend/.env.local.example`](../backend/.env.local.example)
- Staging: [`backend/.env.staging.example`](../backend/.env.staging.example)
- Production: [`backend/.env.production.example`](../backend/.env.production.example)

### Supabase Edge Proxy

- Local: [`.env.edge.local.example`](../.env.edge.local.example)
- Staging: [`.env.edge.staging.example`](../.env.edge.staging.example)
- Production: [`.env.edge.production.example`](../.env.edge.production.example)

## File Legacy `.env.example`

I file `frontend/.env.example`, `backend/.env.example` e `.env.example` restano per compatibilita con tooling/abitudini locali.

Regola operativa:
- non usarli come reference primaria
- quando ci sono differenze, prevalgono sempre i profili `local/staging/production` sopra

## Toolchain Target (Bootstrap)

- Python `3.14`
- Node `22`
- npm
- Deno `v2`

## Backend Provider Secret Matrix (Real Providers)

Per abilitare provider reali con `TEST_STUB_MODE=false`:

| Provider | Env richieste |
| --- | --- |
| `autoscout24` | `SCRAPINGBEE_API_KEY` |
| `subito` | `SCRAPINGBEE_API_KEY` |
| `automobile` | `SCRAPINGBEE_API_KEY` |
| `brumbrum` | `SCRAPINGBEE_API_KEY` |
| `ebay` | `EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET` |

Verifica rapida configurazione runtime:
- `GET /api/providers`
- `GET /api/providers/health`

Ogni provider espone anche:
- `configuration_requirements`
- `missing_configuration`
- `configuration_message`

## Runtime Defaults e Boundary

Frontend (`frontend/src/lib/runtimeConfig.ts`):
- `backendMode` supporta `supabase | fastapi`
- precedenza runtime: localStorage -> env vars -> fallback
- se `VITE_BACKEND_MODE` manca o e invalido:
  - fallback `fastapi` (tutti gli ambienti)
- in `backendMode=fastapi`, i journey core non fanno fallback implicito a Supabase quando `VITE_API_BASE_URL` manca: falliscono in modo esplicito

Boundary ibrido finale:
- Auth resta Supabase-direct
- search, detail, analysis, favorites, saved searches, listings batch e alerts passano via backend API in fastapi mode

Backend ops security:
- se `OPS_TOKEN` e valorizzato nel backend, ogni chiamata a `/api/ops/*` deve includere `x-ops-token`
- in GitHub Actions usare `FASTAPI_OPS_TOKEN` nel workflow `ops-snapshot`
- rate limiting search configurabile via env backend:
  - `SEARCH_RATE_LIMIT` (default `20/minute`)
  - `SEARCH_STREAM_RATE_LIMIT` (default `10/minute`)

## Secret Matrix per Workflow GitHub

| Workflow | Secret richiesti | Scopo |
| --- | --- | --- |
| `.github/workflows/deploy-fastapi.yml` | `RAILWAY_TOKEN`, `RAILWAY_PROJECT_ID`, `RAILWAY_ENVIRONMENT_ID`, `RAILWAY_SERVICE_ID`, `FASTAPI_HEALTHCHECK_URL` | Deploy backend su Railway + healthcheck |
| `.github/workflows/deploy-functions.yml` | `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_ID` | Deploy Supabase Edge Functions |
| `.github/workflows/perf-load.yml` | `FASTAPI_STAGING_BASE_URL` | Esecuzione k6 su staging |
| `.github/workflows/ops-snapshot.yml` | `FASTAPI_OPS_BASE_URL` (+ `FASTAPI_OPS_TOKEN` se `OPS_TOKEN` e attivo) | Polling endpoint ops metrics/alerts |
| `.github/workflows/process-alerts.yml` | `ALERTS_PROCESS_URL`, `ALERTS_PROCESSOR_TOKEN` | Trigger schedulato alerts processor |
| `.github/workflows/canary-smoke.yml` | `FASTAPI_STAGING_BASE_URL` (+ opzionali `FASTAPI_OPS_TOKEN`, `ALERTS_PROCESSOR_TOKEN`) | Smoke manuale canary su journey core |

## Note Operative

- I secret GitHub Actions non vanno messi nei file `.env*`.
- I file `.env*` descrivono variabili runtime applicative.
- I secret workflow sono gate di deploy/osservabilita e vanno gestiti nelle impostazioni repository/environment di GitHub.
- Secret opzionali per verifica operativa avanzata:
  - `ALERTS_SMOKE_LISTING_ID` per smoke sintetico `create -> process -> list` nel workflow `process-alerts`.
- Edge proxy target:
  - staging: `FASTAPI_PROXY_MODE=fastapi_only`
  - production: `FASTAPI_PROXY_MODE=fastapi_only`
- rollback edge mode disponibili:
  - `primary_with_fallback` (rollback controllato)
  - `legacy_only` (rollback aggressivo, uso incident-only)
- override per-request supportato sul proxy edge:
  - header `x-cf-legacy-only: 1` forza il path legacy per quella richiesta

## Verifica Rapida Consigliata

```powershell
powershell -ExecutionPolicy Bypass -File scripts/validate-go-live-readiness.ps1
```

Script operativi per rollout:
- `scripts/run-core-journey-smoke.ps1`
- `scripts/run-staging-soak.ps1`
- `scripts/run-rollback-drill.ps1`
