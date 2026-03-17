# CarFinder Pro

CarFinder Pro e un prodotto di ricerca multi-provider e decision support per auto usate, focalizzato sul mercato italiano.

Aggrega annunci da piu sorgenti, li normalizza, li ordina e aggiunge supporto decisionale su convenienza, trust, negoziazione e costo di possesso.

## Vision

> Find the right car. Know the real deal.

## Where We Are

Il repository oggi e **hybrid bounded**. FastAPI e l'implementazione primaria per la search e per buona parte delle API decisionali, ma il prodotto non e ancora provato in modo completo come production-ready.

| Area | Stato | Verita del repo |
| --- | --- | --- |
| Search platform | done | FastAPI espone `/api/search` e `/api/search/stream` con orchestrazione provider e SSE |
| Provider migration | done | `autoscout24`, `subito`, `ebay`, `automobile`, `brumbrum` esistono in `backend/app/providers` |
| Filter contract v1 | done | filtri estesi e strict capability semantics sono implementati in backend e frontend |
| Frontend/runtime boundary | partial | Auth resta Supabase-direct e alcuni flussi dipendono ancora dalla runtime mode |
| Alerts operations | partial | esistono alerts CRUD, processor API, audit migration e scheduler workflow, ma la prova di delivery live non e documentata qui |
| Observability | partial | esistono ops endpoints e workflow di perf e snapshot, ma dashboard esterne e alert consumption restano leggere |
| Testing | partial | il repo contiene 44 test backend, 39 test frontend, 1 Playwright spec e test edge, ma questo ambiente non puo eseguirli |
| Rollout evidence | missing proof | il repo non prova da solo canary staging, rollback drill o SLO live |
| Local bootstrap | missing proof | in questo ambiente mancano Python, Node, npm e Deno, quindi install e startup non sono verificati qui |

## Architettura

```text
/
  frontend/    React 18 + TypeScript + Vite
  backend/     FastAPI + Pydantic + httpx
  supabase/    PostgreSQL migrations + Edge Functions
  docs/        readiness, rollout, env profiles, SLO baseline
```

Boundary runtime:
- FastAPI gestisce search, search-stream, listing detail, listing analysis, alerts API e user data API lato backend.
- Supabase Auth resta frontend-direct.
- L'edge `scrape-listings` continua a supportare proxy e fallback via `FASTAPI_PROXY_MODE`.

## Superficie API Corrente

Rotte backend in uso:
- `POST /api/search`
- `POST /api/search/stream`
- `GET /api/providers`
- `GET /api/providers/health`
- `GET /api/filters/metadata`
- `GET /api/metadata/ownership`
- `GET /api/listings/{listing_id}`
- `POST /api/listings/analyze`
- `GET /api/alerts`
- `POST /api/alerts`
- `POST /api/alerts/{alert_id}/deactivate`
- `POST /api/alerts/process`
- `GET/POST/DELETE /api/user/favorites`
- `GET/POST/DELETE /api/user/saved-searches`
- `POST /api/listings/batch`

Note sul contratto search:
- gli eventi SSE stabili sono `progress`, `result`, `complete`, `error`
- `SearchRequest v1` include `is_new`, `color`, `doors`, `emission_class`, `seller_type`
- `private_only` resta per compatibilita additiva
- `GET /api/filters/metadata` espone:
  - `canonical_filters`
  - `backend_post_filters`
  - `provider_filter_union`
  - `provider_filter_intersection`
  - `provider_filter_semantics = strict_all_active_non_post_filters`

## Runtime Configuration

La runtime config frontend arriva da `frontend/src/lib/runtimeConfig.ts`.

Regole:
- `backendMode` supporta `supabase | fastapi`
- la precedenza e override localStorage, poi env vars, poi fallback default
- se `VITE_BACKEND_MODE` manca, il frontend va in fallback su `supabase`

Runtime dell'edge proxy:
- `FASTAPI_PROXY_MODE=primary_with_fallback`
- `FASTAPI_PROXY_MODE=fastapi_only`
- `FASTAPI_PROXY_MODE=legacy_only`

## Installazione

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Backend

Runtime richiesto: `Python 3.14`

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

### Edge Functions

Deploy via GitHub Actions o Supabase CLI.

## Environment Profiles

Esempi versionati:
- `frontend/.env.local.example`
- `frontend/.env.staging.example`
- `frontend/.env.production.example`
- `backend/.env.local.example`
- `backend/.env.staging.example`
- `backend/.env.production.example`
- `.env.edge.local.example`
- `.env.edge.staging.example`
- `.env.edge.production.example`

Dettagli: [runtime_env_profiles.md](docs/runtime_env_profiles.md)

## CI/CD

Workflow principali:
- `.github/workflows/ci.yml`
  - frontend lint, test, build
  - backend test e import smoke
  - edge typecheck e proxy contract checks
  - Playwright smoke
  - release gate aggregato
- `.github/workflows/deploy-fastapi.yml`
  - backend test piu deploy Railway
- `.github/workflows/deploy-functions.yml`
  - edge typecheck piu deploy Supabase Functions
- `.github/workflows/perf-load.yml`
  - k6 load test schedulato
- `.github/workflows/process-alerts.yml`
  - trigger schedulato dell'alerts processor
- `.github/workflows/ops-snapshot.yml`
  - polling schedulato di `/api/ops/metrics` e `/api/ops/alerts`

## Production Readiness

Questo repo **non e ancora production-ready in modo dimostrato**.

Cosa esiste gia:
- implementazione search FastAPI-first
- provider search migrati
- strict filter semantics e contratto search esteso
- alerts processor API e scheduler workflow
- ops endpoints e workflow CI/release

Cosa blocca ancora una dichiarazione pulita di production-ready:
- FastAPI non e ancora il default runtime inequivocabile end-to-end
- observability live, alert consumption e dashboard proof sono ancora leggere
- canary staging e rollback evidence non sono raccolte qui
- bootstrap locale ed esecuzione test non sono verificati in questo ambiente

Documenti canonici sul readiness:
- [production_readiness_checklist.md](docs/production_readiness_checklist.md)
- [production_readiness_backlog.md](docs/production_readiness_backlog.md)
- [release_go_live_checklist.md](docs/release_go_live_checklist.md)

## License

La licenza finale del progetto e ancora da definire.
