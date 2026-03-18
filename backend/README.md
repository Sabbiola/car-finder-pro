# Backend (FastAPI)

Questo modulo contiene il backend FastAPI provider-based di CarFinder Pro.

Ruolo attuale:
- implementazione primaria per search e search streaming
- API di listing detail e listing analysis
- API alert e alerts processor
- API backend per favorites, saved searches e listings batch

Il prodotto complessivo resta hybrid bounded perche Supabase Auth rimane frontend-direct e il proxy edge/fallback esiste ancora.

## Runtime

Runtime richiesto: `Python 3.14`

Avvio locale:

```bash
python -m venv .venv
# Linux/macOS
source .venv/bin/activate
# Windows
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Profilo env canonico locale:
- `backend/.env.local.example`

Il file `backend/.env.example` resta per compatibilita e va tenuto allineato al profilo locale.

Profili target:
- staging: `backend/.env.staging.example` con `FASTAPI_PROXY_MODE=fastapi_only`
- production: `backend/.env.production.example` con `FASTAPI_PROXY_MODE=fastapi_only`

## Inventory Rotte Correnti

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
- `GET /api/user/favorites`
- `POST /api/user/favorites`
- `DELETE /api/user/favorites/{listing_id}`
- `GET /api/user/saved-searches`
- `POST /api/user/saved-searches`
- `DELETE /api/user/saved-searches/{search_id}`
- `POST /api/listings/batch`
- `GET /api/ops/metrics`
- `GET /api/ops/alerts`
- `GET /healthz`

## Contratto Search

Note sul contratto search backend:
- eventi SSE stabili: `progress`, `result`, `complete`, `error`
- `SearchRequest v1` include:
  - `is_new`
  - `color`
  - `doors`
  - `emission_class`
  - `seller_type`
- `private_only` resta per compatibilita additiva
- i metadata di capability arrivano da `GET /api/filters/metadata`
- la semantica attiva e `strict_all_active_non_post_filters`

## Provider

Provider search implementati nel backend:
- `autoscout24`
- `subito`
- `ebay`
- `automobile`
- `brumbrum`

Matrice secret provider (real providers, `TEST_STUB_MODE=false`):
- `autoscout24`, `subito`, `automobile`, `brumbrum` -> `SCRAPINGBEE_API_KEY`
- `ebay` -> `EBAY_CLIENT_ID` + `EBAY_CLIENT_SECRET`

`/api/providers` e `/api/providers/health` espongono anche:
- `configuration_requirements`
- `missing_configuration`
- `configuration_message`

per rendere esplicito cosa manca prima dello smoke reale.

## Smoke staging (provider reali)

Checklist:
- `docs/staging_provider_smoke_checklist.md`

Script rapido:

```powershell
pwsh -File scripts/run-core-journey-smoke.ps1 `
  -FastApiBaseUrl "https://<fastapi-staging>" `
  -OutputFile "artifacts/smoke/core-journey-smoke.json"
```

## Note Operative

- timeout, retry e concorrenza provider sono guidati da env
- l'enrichment analysis e limitato da concorrenza configurabile
- gli endpoint ops possono essere protetti con `X-Ops-Token` quando `OPS_TOKEN` e configurato
- l'alerts processor supporta idempotenza, retry metadata e audit di delivery
- l'export observability via webhook e supportato, ma dashboarding live e runbook restano tema di rollout e non prova interna al repo
- `/api/ops/metrics` include anche snapshot runtime alerts processor e summary delivery attempts 24h

## Test

Da `backend/`:

```bash
pytest -q
```
