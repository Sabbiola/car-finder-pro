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

## Note architetturali
- provider core migrati: `autoscout24`, `subito`
- provider esteso: `ebay` (`official_api`, configurabile via `EBAY_CLIENT_ID` / `EBAY_CLIENT_SECRET`)
- orchestrazione concorrente con timeout e gestione failure parziali
- dedup/ranking base lato backend
- metriche runtime provider esposte in `/api/providers/health`
  (`latency_ms`, `error_rate`, `last_success`, `total_calls`, `failed_calls`, `last_error`)

## Test
Da `backend/`:

```bash
pytest -q
```
