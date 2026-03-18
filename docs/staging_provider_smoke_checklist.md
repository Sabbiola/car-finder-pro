# Staging Provider Smoke Checklist

Checklist operativa per validare staging con provider reali configurati (no stub).

## Prerequisiti

- `TEST_STUB_MODE=false`
- `FASTAPI_PROXY_MODE=fastapi_only`
- Secret backend presenti:
  - `SCRAPINGBEE_API_KEY` (autoscout24, subito, automobile, brumbrum)
  - `EBAY_CLIENT_ID` + `EBAY_CLIENT_SECRET` (ebay)
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
- Base URL staging disponibile (`https://<your-fastapi-staging>`)

## Smoke Manuale (ordine consigliato)

1. `GET /healthz`
   - atteso: `status=ok`

2. `GET /api/providers`
   - atteso: payload non vuoto
   - atteso: per ogni provider presenti `configured`, `configuration_requirements`, `missing_configuration`, `configuration_message`

3. `GET /api/providers/health`
   - atteso: payload non vuoto
   - atteso: stessi campi di configurazione del catalogo provider

4. `GET /api/filters/metadata`
   - atteso: `search_contract.provider_filter_union`
   - atteso: `search_contract.provider_filter_intersection`
   - atteso: `search_contract.provider_filter_semantics = strict_all_active_non_post_filters`

5. `POST /api/search`
   - atteso: response 200
   - atteso: shape con `providers_used`, `provider_errors`, `provider_error_details`

6. `POST /api/search/stream`
   - atteso: eventi SSE in ordine coerente (`progress`, `result`, `complete`)

7. Partial failure check
   - se esiste almeno un provider `enabled=true` ma `configured=false`:
     - eseguire search con una source configurata + una non configurata
     - atteso: `provider_error_details` contiene `provider_not_configured` per il provider non configurato
   - se tutti i provider enabled sono configurati:
     - marcare lo step come `skipped` e pianificare un drill separato (es. disable temporaneo controllato in staging)

## Script consigliato

```powershell
pwsh -File scripts/run-core-journey-smoke.ps1 `
  -FastApiBaseUrl "https://<your-fastapi-staging>" `
  -OpsToken "<optional-ops-token>" `
  -AlertsToken "<optional-alerts-token>" `
  -OutputFile "artifacts/smoke/core-journey-smoke.json"
```

Lo script include i controlli su:
- healthz
- providers catalog
- providers health
- filters metadata
- search sync
- search stream
- partial failure (quando deterministico)
