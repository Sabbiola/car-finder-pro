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
  - response: `total_results`, `listings`, `providers_used`, `provider_errors`
- `POST /api/search/stream`
  - SSE con eventi stabili: `progress`, `result`, `complete`, `error`
- `GET /api/providers`
- `GET /api/providers/health`
- `GET /api/filters/metadata`

## Transizione FastAPI

Durante la release di transizione:
- `supabase/functions/scrape-listings` fa da proxy verso FastAPI
- se FastAPI fallisce, il proxy puo fare fallback legacy (configurabile)
- provider core migrati: `autoscout24`, `subito`
- provider non migrati restano su path legacy

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

### Frontend (`frontend/.env`)

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_SUPABASE_PROJECT_ID=
VITE_BACKEND_MODE=supabase
VITE_API_BASE_URL=http://localhost:8000
```

### Backend (`backend/.env`)

```env
ENV=development
LOG_LEVEL=info
CORS_ORIGINS=http://localhost:5173,http://localhost:8080
REQUEST_TIMEOUT_SECONDS=20
MAX_PROVIDER_CONCURRENCY=4
PROVIDER_TIMEOUT_SECONDS=30
SCRAPINGBEE_API_KEY=
LEGACY_SCRAPE_LISTINGS_URL=
FASTAPI_PROXY_MODE=primary_with_fallback
```

### Infra/Edge (root `.env`)

```env
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:8080
SCRAPINGBEE_API_KEY=
FASTAPI_SEARCH_URL=http://localhost:8000/api/search
FASTAPI_PROXY_MODE=primary_with_fallback
```

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
- [ ] dedup/ranking avanzati
- [ ] observability estesa
- [ ] test E2E completi
- [ ] estensione provider successivi

## Sicurezza

- nessuna credenziale hardcodata
- input validation tipizzata
- timeout bounded verso provider esterni
- CORS controllato
- logging senza esposizione segreti

## Licenza

Definire la licenza finale del progetto (es. MIT o proprietaria).
