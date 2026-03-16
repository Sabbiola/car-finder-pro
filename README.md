# CarFinder Pro

**CarFinder Pro** e un motore di ricerca multi-provider per auto usate che aggrega annunci da piu marketplace, li normalizza e aiuta a capire quali annunci meritano davvero attenzione.

Obiettivo prodotto:
- ricerca multi-source
- comparazione annunci
- analisi di convenienza
- segnali di rischio
- supporto alla negoziazione

## Visione

> **Find the right car. Know the real deal.**

## Stato attuale

Il progetto e in modalita ibrida:
- frontend in `frontend/` (React + TypeScript + Vite)
- backend target in `backend/` (FastAPI provider-based)
- runtime produzione in transizione con Supabase Edge Functions (`supabase/functions`) come proxy/fallback
- datastore e migrazioni in Supabase (`supabase/migrations`)

## Feature attuali

- ricerca multi-source
- streaming progressivo ricerca via SSE (`progress`, `result`, `complete`, `error`)
- filtri avanzati
- risultati ordinabili
- export CSV
- runtime config frontend unificata (`backendMode` + `apiBaseUrl`)
- fallback legacy automatico nella release di transizione

## Architettura repository

```text
/
  frontend/               # React app
    src/
  backend/                # FastAPI backend
    app/
  supabase/               # Edge Functions + migrations
  docs/
    piano_azione_carfinder_pro.md
    marketplace_catalog.tsv
```

## Backend APIs

- `POST /api/search`
  - response: `total_results`, `listings`, `providers_used`, `provider_errors`, `provider_error_details`
- `POST /api/search/stream`
  - SSE con eventi stabili: `progress`, `result`, `complete`, `error`
- `GET /api/providers`
- `GET /api/providers/health`
- `GET /api/filters/metadata`
- `GET /api/listings/{listing_id}`
  - query params:
    - `include_analysis=true|false`
    - `include=deal&include=trust&include=negotiation&include=ownership`
- `POST /api/listings/batch`
- `GET/POST/DELETE /api/user/favorites`
- `GET/POST/DELETE /api/user/saved-searches`
- `POST /api/alerts/process`
  - supporta `idempotency_key` + retry metadata nel payload di risposta

## Transizione FastAPI

Durante la release di transizione:
- `supabase/functions/scrape-listings` fa da proxy verso FastAPI
- target runtime: `fastapi_only` per ricerca primaria
- provider migrati su backend FastAPI: `autoscout24`, `subito`, `ebay`, `automobile`, `brumbrum`
- fallback legacy non e piu happy path di default

Env flag principali edge:
- `FASTAPI_SEARCH_URL`
- `FASTAPI_PROXY_MODE` = `primary_with_fallback` | `fastapi_only` | `legacy_only`

## Installazione

### 1. Frontend

```bash
cd frontend
npm install
npm run dev
```

Build/lint/test:

```bash
npm run build
npm run lint
npm run test
```

### 2. Backend (FastAPI)

Requisito runtime: `Python 3.14`.

```bash
cd backend
python -m venv .venv
# Linux/macOS
source .venv/bin/activate
# Windows
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 3. Edge Functions (Supabase)

Deploy via workflow GitHub Actions o CLI Supabase.

## Variabili ambiente

### Frontend

```env
# usa i profili versionati:
# - frontend/.env.local.example
# - frontend/.env.staging.example
# - frontend/.env.production.example
```

### Backend

```env
# usa i profili versionati:
# - backend/.env.local.example
# - backend/.env.staging.example
# - backend/.env.production.example
```

### Infra/Edge

```env
# usa i profili versionati:
# - .env.edge.local.example
# - .env.edge.staging.example
# - .env.edge.production.example
```

Dettaglio completo: [`docs/runtime_env_profiles.md`](docs/runtime_env_profiles.md)

## CI/CD

Workflow principali:
- `.github/workflows/ci.yml`
  - frontend lint/test/build
  - backend test
  - edge typecheck + proxy contract check
- `.github/workflows/deploy-functions.yml`
  - deploy Supabase Edge Functions
- `.github/workflows/deploy-fastapi.yml`
  - test backend + deploy Railway
  - secret checks obbligatori + healthcheck smoke
- `.github/workflows/perf-load.yml`
  - load test k6 su `/api/search` e `/api/search/stream`
- `.github/workflows/process-alerts.yml`
  - scheduler per `POST /api/alerts/process` con token e idempotency key
- `.github/workflows/ops-snapshot.yml`
  - polling periodico di `/api/ops/metrics` e `/api/ops/alerts` (telemetria verso sink esterno)

Checklist release/cutover: [`docs/production_readiness_checklist.md`](docs/production_readiness_checklist.md)

## Roadmap prodotto

1. Deal Thesis Engine
2. Negotiation Copilot
3. Trust and Fraud Layer
4. Ownership Intelligence

## TODO immediati

- [x] split frontend fisico in `frontend/`
- [x] base runtime config unificata frontend
- [x] backend provider-based base + provider core
- [x] endpoint metadata/providers/health/search
- [x] proxy legacy -> FastAPI con fallback
- [x] dedup/ranking avanzati
- [x] observability estesa
- [x] test E2E smoke completi (Playwright + CI gate)
- [x] estensione provider successivi (eBay Motors)

## Sicurezza

- nessuna credenziale hardcodata
- input validation tipizzata
- timeout bounded verso provider esterni
- CORS controllato
- logging senza esposizione segreti

## Licenza

Definire la licenza finale del progetto (es. MIT o proprietaria).
