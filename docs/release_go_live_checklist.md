# Release Go-Live Checklist

## 1. Repository State

Run:

```powershell
git status
git branch --show-current
git pull
```

Go:
- branch corretto
- working tree pulito o modifiche note
- nessun conflitto pendente

No-go:
- branch sbagliato
- stato repo non controllato

## 2. Supabase Migrations

Run:

```powershell
supabase db push
```

Verify:
- migration `20260312000100_listing_analysis_and_fingerprints.sql` applicata
- tabelle presenti:
  - `listing_image_fingerprints`
  - `seller_fingerprints`
  - `listing_analysis_snapshots`
- policy RLS corrette

Go:
- DB aggiornato senza regressioni

No-go:
- migration fallita
- accessi service role non funzionanti

## 3. Backend Environment

Required:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY`
- `ANALYSIS_SNAPSHOT_TTL_HOURS=24`
- `NEGOTIATION_LLM_ENABLED=false`
- provider secrets richiesti
- `OBSERVABILITY_WEBHOOK_URL` se usato

Go:
- env completi e caricati dal runtime

No-go:
- secret critici mancanti

## 4. Backend Test Suite

Run:

```powershell
cd backend
pytest
```

Go:
- unit e integration verdi

No-go:
- failure su `search`, `stream`, `analysis`, `providers`

## 5. Frontend Validation

Run:

```powershell
cd frontend
npm install
npm run lint
npm run test
npm run build
```

Go:
- lint verde
- test verdi
- build completata

No-go:
- regressioni su results, detail, compare, runtime config

## 6. Backend Smoke APIs

Run:

```powershell
curl http://localhost:8000/healthz
curl http://localhost:8000/api/providers
curl http://localhost:8000/api/providers/health
curl http://localhost:8000/api/filters/metadata
curl http://localhost:8000/api/metadata/ownership
```

Go:
- tutti `200`
- payload coerenti

No-go:
- `500`, timeout o contract errato

## 7. Search Sync Contract

Run:

```powershell
curl -X POST http://localhost:8000/api/search -H "Content-Type: application/json" -d "{\"brand\":\"BMW\",\"model\":\"320d\",\"sources\":[\"autoscout24\"]}"
```

Verify:
- `total_results`
- `listings`
- `deal_summary`
- `trust_summary`
- `negotiation_summary`

Go:
- payload enriched presente

No-go:
- listing non arricchiti o endpoint rotto

## 8. Search Stream Contract

Run:

```powershell
curl -N -X POST http://localhost:8000/api/search/stream -H "Content-Type: application/json" -d "{\"brand\":\"BMW\",\"model\":\"320d\",\"sources\":[\"autoscout24\"]}"
```

Verify:
- ordine eventi: `progress`, `result`, `complete`
- partial failure gestito

Go:
- SSE stabile

No-go:
- ordine errato o stream interrotto

## 9. Listing Analysis Contract

Run:

```powershell
curl -X POST http://localhost:8000/api/listings/analyze -H "Content-Type: application/json" -d "{\"listing_id\":\"<ID>\",\"include\":[\"deal\",\"trust\",\"negotiation\",\"ownership\"]}"
```

Go:
- ritorna `ListingAnalysis`
- ownership disponibile
- snapshot/cache senza errori

No-go:
- `404` inatteso o failure repository/cache

## 10. Frontend Smoke

Verify manually:
- ricerca standard
- stream `progress/result/complete`
- badge decisionali nelle card
- drawer `Why this car?`
- detail page con analysis panel
- compare con `Perche si`, `Perche no`, `Target`, `Costo 24 mesi`

Go:
- UX invariata e pannelli nuovi funzionanti

No-go:
- errori JS
- regressioni su ricerca, sorting, detail, compare

## 11. Proxy Transition Modes

Test:
- `FASTAPI_PROXY_MODE=primary_with_fallback`
- `FASTAPI_PROXY_MODE=fastapi_only`
- `FASTAPI_PROXY_MODE=legacy_only`
- backend down
- provider core in errore

Go:
- fallback e rollback reali e coerenti

No-go:
- rottura compatibilita lato client

## 12. Staging Deploy

Deploy:
- Railway backend
- frontend staging
- Supabase Edge Functions staging

Verify:
- env corretti
- healthcheck ok
- CORS ok
- smoke completo ripetuto in staging

Go:
- staging stabile

No-go:
- error rate o regressioni critiche

## 13. Observability

Verify:
- log JSON presenti
- `request_id` propagato
- metriche provider disponibili
- errori e timeout visibili
- alert minimi attivi

Go:
- produzione osservabile

No-go:
- sistema non monitorabile

## 14. Final Go / No-Go Decision

Deploy production only if:
- CI completamente verde
- staging smoke verde
- env completi
- migration ok
- rollback verificato
- nessuna regressione su `search`, `SSE`, `detail`, `compare`, `analysis`
