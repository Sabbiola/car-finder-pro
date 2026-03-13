# Backend (FastAPI)

Questo modulo contiene il backend provider-based di CarFinder Pro, usato come backend primario nella release di transizione.

## Avvio locale
```bash
python -m venv .venv
# Linux/macOS
source .venv/bin/activate
# Windows
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Endpoint principali
- `POST /api/search`
- `POST /api/search/stream`
- `GET /api/providers`
- `GET /api/providers/health`
- `GET /api/filters/metadata`
- `GET /api/listings/{listing_id}`
- `POST /api/listings/batch`
- `GET/POST/DELETE /api/user/favorites`
- `GET/POST/DELETE /api/user/saved-searches`
- `POST /api/alerts/process`

## Note architetturali
- provider migrati: `autoscout24`, `subito`, `ebay`, `automobile`, `brumbrum`
- orchestrazione concorrente con timeout e gestione failure parziali
- semantica strict capability: provider esclusi se non compatibili con filtri attivi non post-filter
- dedup/ranking base lato backend
- post-filter backend esteso (`is_new`, `color`, `doors`, `emission_class`, `seller_type`)
- metriche runtime provider esposte in `/api/providers/health`
  (`latency_ms`, `error_rate`, `last_success`, `total_calls`, `failed_calls`, `last_error`)
- metriche operative in `/api/ops/metrics` con breakdown `search_vs_analysis_ms`, `repository_calls_count`, `cache_hit_rate`
- pipeline alerts con retry/idempotenza/audit (`alert_delivery_attempts`) e delivery `email + in-app`

## Test
Da `backend/`:

```bash
pytest -q
```
