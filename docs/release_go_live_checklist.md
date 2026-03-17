# Release Go-Live Checklist

Usare questa checklist per le decisioni di go-live su staging e produzione.

## 1. Stato Repo e Toolchain

Verificare:
- branch corretto
- working tree controllato
- ultime modifiche remote tirate giu
- toolchain locali richieste presenti quando si eseguono smoke manuali:
  - Python 3.14
  - Node 22
  - npm
  - Deno v2

No-go se:
- lo stato del repo e incerto
- le toolchain necessarie mancano per la validazione che si sta tentando

## 2. Database e Migration

Verificare:
- tutte le 15 migration applicate
- la migration piu recente `20260313000000_alert_delivery_attempts.sql` presente nella history del database target
- tabelle richieste presenti, incluse:
  - `listing_analysis_snapshots`
  - `listing_image_fingerprints`
  - `seller_fingerprints`
  - `price_alerts`
  - `alert_delivery_attempts`
- le policy RLS richieste continuano a comportarsi correttamente

No-go se:
- lo stato migration e incompleto
- manca lo storage di audit per i delivery alert

## 3. Environment e Secret

Env backend da verificare nell'ambiente target:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY`
- secret provider necessari
- `ALERTS_PROCESSOR_TOKEN`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `OBSERVABILITY_WEBHOOK_URL` se il webhook export e previsto

Secret dei workflow deploy da verificare:
- Railway:
  - `RAILWAY_TOKEN`
  - `RAILWAY_PROJECT_ID`
  - `RAILWAY_ENVIRONMENT_ID`
  - `RAILWAY_SERVICE_ID`
  - `FASTAPI_HEALTHCHECK_URL`
- Supabase functions:
  - `SUPABASE_ACCESS_TOKEN`
  - `SUPABASE_PROJECT_ID`
- Workflow schedulati quando previsti:
  - `FASTAPI_STAGING_BASE_URL`
  - `FASTAPI_OPS_BASE_URL`
  - `ALERTS_PROCESS_URL`
  - `ALERTS_PROCESSOR_TOKEN`

No-go se un secret richiesto manca o e stale.

## 4. CI e Gate Statici

Job GitHub Actions richiesti:
- `frontend`
- `backend`
- `edge-functions`
- `e2e`
- `release-gate`

Verificare anche che i workflow schedulati di supporto siano configurati quando attesi:
- `perf-load.yml`
- `ops-snapshot.yml`
- `process-alerts.yml`

No-go se i check richiesti sono rossi o se lo stato branch protection e ignoto per il release target.

## 5. Backend Smoke

Verificare queste rotte sul backend deployato:
- `GET /healthz`
- `GET /api/providers`
- `GET /api/providers/health`
- `GET /api/filters/metadata`
- `GET /api/metadata/ownership`
- `POST /api/search`
- `POST /api/search/stream`
- `GET /api/listings/{listing_id}`
- `POST /api/listings/analyze`
- `GET /api/alerts`
- `POST /api/alerts`
- `POST /api/alerts/{alert_id}/deactivate`
- `POST /api/alerts/process`
- `GET/POST/DELETE /api/user/favorites`
- `GET/POST/DELETE /api/user/saved-searches`
- `POST /api/listings/batch`

Verificare anche:
- ordine SSE `progress -> result -> complete`
- presenza di `provider_error_details` sui failure provider
- metadata con strict capability semantics
- alerts processor con retry e idempotency data machine-readable

No-go se inventory route o payload shape non coincidono con il contratto documentato.

## 6. Frontend Smoke

Validare nell'ambiente target:
- la search funziona in modalita FastAPI
- stream progress e partial failure vengono renderizzati correttamente
- il listing detail carica via backend API in modalita FastAPI
- favorites e saved searches funzionano in modalita FastAPI
- compare funziona con backend listings batch in modalita FastAPI
- gli alert possono essere creati e disattivati
- l'auth continua a funzionare tramite Supabase

No-go se il frontend va in fallback verso un runtime non voluto o rompe i journey core.

## 7. Runtime Mode e Boundary Checks

Verificare la verita runtime:
- `backendMode` lato frontend risolve come previsto
- il default e intenzionale per l'ambiente target
- `FASTAPI_PROXY_MODE` lato edge e impostato intenzionalmente
- `fastapi_only` viene usato dove il rollout plan lo richiede

No-go se il comportamento production dipende da default accidentali o override localStorage non documentati.

## 8. Observability e Alerts

Verificare:
- `/api/ops/metrics` e `/api/ops/alerts` rispondono come atteso
- la protezione `X-Ops-Token` funziona se configurata
- il workflow snapshot raggiunge gli ops endpoint
- il workflow perf puo colpire staging
- lo scheduler alerts puo invocare `/api/alerts/process`
- log e metriche sono visibili nel sink esterno scelto

No-go se il sistema resta osservabile solo leggendo il repo e non da operazioni live.

## 9. Evidenza di Rollout

Prima della produzione:
- staging deve essere stabile nella runtime mode prevista
- il canary deve essere eseguito
- il rollback drill deve essere eseguito
- gli SLO chiave devono essere verificati sulla telemetria live

Target SLO:
- `search sync p95 < 5s`
- `search stream error rate < 2%`
- `provider success rate >= 98%`
- `stream completion rate >= 98%`

No-go se l'evidenza di rollout manca o il rollback non e provato.

## 10. Decisione Finale

Go solo se sono tutte vere:
- codice e docs concordano sul comportamento runtime attuale
- i check richiesti sono verdi
- secret e migration sono verificati
- esistono evidenze di staging e canary
- il rollback e provato
- non ci sono Sev1 aperti

Altrimenti lo stato corretto del release e:
- non ancora production-ready
- continuare il production hardening
