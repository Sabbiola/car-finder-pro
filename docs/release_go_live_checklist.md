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

Preflight consigliato:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/validate-go-live-readiness.ps1
```

No-go se:
- lo stato del repo e incerto
- le toolchain necessarie mancano per la validazione che si sta tentando

## 1.1 Bootstrap Verified Checklist

Compilare questa checklist tecnica prima del go-live:

- [ ] Toolchain target disponibili: Python 3.14, Node 22, npm, Deno v2
- [ ] Preflight locale eseguito (`scripts/validate-go-live-readiness.ps1`)
- [ ] Frontend bootstrap verificato (`npm ci`, `npm run build`)
- [ ] Backend bootstrap verificato (`pip install -r requirements.txt`, import smoke)
- [ ] Edge toolchain verificata (`deno --version`)
- [ ] Test minima verificata (almeno smoke subset)

Evidenza minima da allegare:
- timestamp run
- comando eseguito
- esito (pass/fail)
- eventuale blocker aperto

Comandi minimi consigliati per la verifica:

```powershell
# Preflight repository
powershell -ExecutionPolicy Bypass -File scripts/validate-go-live-readiness.ps1

# Frontend
cd frontend
npm ci
npm run test
npm run build

# Backend
cd ../backend
python -m pip install --upgrade pip
pip install -r requirements.txt
pytest -q
python -c "import app.main; print('backend import ok')"

# Edge toolchain smoke
cd ..
deno --version
```

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
  - `FASTAPI_OPS_TOKEN` (richiesto se `OPS_TOKEN` e attivo nel backend)
  - `ALERTS_PROCESS_URL`
  - `ALERTS_PROCESSOR_TOKEN`
  - `ALERTS_SMOKE_LISTING_ID` (opzionale ma raccomandato per smoke operativo alerts)

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
- `canary-smoke.yml` (manuale, obbligatorio durante finestra canary)

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

Checklist operativa dedicata:
- `docs/staging_provider_smoke_checklist.md`

Verificare anche:
- ordine SSE `progress -> result -> complete`
- `/api/providers` e `/api/providers/health` con campi:
  - `configuration_requirements`
  - `missing_configuration`
  - `configuration_message`
- presenza di `provider_error_details` sui failure provider
- metadata con strict capability semantics
- alerts processor con retry e idempotency data machine-readable
- smoke contract in `TEST_STUB_MODE` per detail, listings batch e alerts API

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
- la suite Playwright copre sia `search-stream.spec.ts` che `journeys-fastapi.spec.ts`

No-go se il frontend va in fallback verso un runtime non voluto o rompe i journey core.

## 7. Runtime Mode e Boundary Checks

Verificare la verita runtime:
- `backendMode` lato frontend risolve come previsto
- il default e intenzionale per l'ambiente target
- in staging/production non vengono usati override runtime da localStorage
- in `backendMode=fastapi` i journey core falliscono in modo esplicito se `VITE_API_BASE_URL` manca (no fallback implicito)
- `FASTAPI_PROXY_MODE` lato edge e impostato intenzionalmente
  - target stabile: `fastapi_only`
  - rollback controllato: `primary_with_fallback`
  - rollback aggressivo: `legacy_only`
- override edge per richiesta disponibile: header `x-cf-legacy-only: 1`
- `fastapi_only` viene usato dove il rollout plan lo richiede

No-go se il comportamento production dipende da default accidentali o override localStorage non documentati.

## 8. Observability e Alerts

Verificare:
- `/api/ops/metrics` e `/api/ops/alerts` rispondono come atteso
- la protezione `X-Ops-Token` funziona se configurata
- il workflow snapshot raggiunge gli ops endpoint
  - e pubblica artifact `ops-metrics.json` / `ops-alerts.json`
- il workflow perf puo colpire staging
  - e pubblica `perf-load-summary.json`
- lo scheduler alerts puo invocare `/api/alerts/process`
  - con payload outcome valido e artifact del run
- log e metriche sono visibili nel sink esterno scelto
- runbook operativi disponibili e allineati:
  - `docs/runbooks/provider_failure_spike.md`
  - `docs/runbooks/stream_completion_drop.md`
  - `docs/runbooks/alerts_processor_failure.md`
  - `docs/runbooks/rollback_runtime_mode.md`

No-go se il sistema resta osservabile solo leggendo il repo e non da operazioni live.

## 9. Evidenza di Rollout

Prima della produzione:
- staging deve essere stabile nella runtime mode prevista
- il canary deve essere eseguito
- il rollback drill deve essere eseguito
- gli SLO chiave devono essere verificati sulla telemetria live

### 9.1 Staging Soak (obbligatorio)

Richiesto:
- soak continuo 5-7 giorni
- smoke journey core ripetuti
- evidenza artifact

Comando consigliato:

```powershell
pwsh -File scripts/run-staging-soak.ps1 `
  -FastApiBaseUrl "<FASTAPI_BASE_URL>" `
  -DurationHours 120 `
  -IntervalMinutes 30 `
  -OutputDir "artifacts/soak"
```

Gate soak:
- `success_rate >= 98%`
- nessun alert `critical` persistente

### 9.2 Canary (obbligatorio)

Richiesto:
- almeno 3 smoke consecutive verdi durante finestra canary
- monitoraggio stretto `ops/metrics` e `ops/alerts`
- nessun Sev1 aperto durante canary

Evidenza minima:
- output smoke della finestra canary
- snapshot ops della finestra canary
- decision log promotione/no-go

Workflow consigliato:
- eseguire `.github/workflows/canary-smoke.yml` (workflow_dispatch) almeno 3 volte durante la finestra canary

### 9.3 Rollback Drill (obbligatorio)

Comando consigliato:

```powershell
pwsh -File scripts/run-rollback-drill.ps1 `
  -FastApiBaseUrl "<FASTAPI_BASE_URL>" `
  -EvidenceDir "artifacts/rollback-drill"
```

Per drill con switch mode edge applicato da CLI:

```powershell
pwsh -File scripts/run-rollback-drill.ps1 `
  -FastApiBaseUrl "<FASTAPI_BASE_URL>" `
  -ApplyEdgeProxyMode `
  -SupabaseProjectRef "<PROJECT_REF>" `
  -TargetProxyMode "primary_with_fallback" `
  -RestoreProxyMode "fastapi_only" `
  -EvidenceDir "artifacts/rollback-drill"
```

Gate rollback drill:
- pre-check e post-check smoke verdi
- percorso tecnico ripetibile
- evidenza mode switch/restore (se applicato)

Target SLO:
- `search sync p95 < 5s`
- `search stream error rate < 2%`
- `provider success rate >= 98%`
- `stream completion rate >= 98%`

Comando di verifica k6 su staging:

```bash
FASTAPI_BASE_URL=<staging-url> k6 run --summary-export=perf-load-summary.json backend/perf/search-load.js
```

No-go se l'evidenza di rollout manca o il rollback non e provato.

Riferimento operativo:
- `docs/runbooks/staging_soak_canary.md`
- `docs/runbooks/rollback_runtime_mode.md`

## 10. Decisione Finale

Go solo se sono tutte vere:
- codice e docs concordano sul comportamento runtime attuale
- i check richiesti sono verdi
- secret e migration sono verificati
- esistono evidenze di staging e canary
- il rollback e provato
- nessun blocker P0 aperto
- non ci sono Sev1 aperti

Altrimenti lo stato corretto del release e:
- non ancora production-ready
- continuare il production hardening

Checklist approvazione finale:
- `docs/release_approval_checklist.md`

## 11. Stabilization Window (post go-live)

Policy operativa:
- durata standard 14 giorni
- cambio scope limitato a fix critici/hardening
- no nuove macro-feature durante la finestra
- rollback immediato se KPI fuori soglia persistente

Riferimento:
- `docs/stabilization_window_policy.md`
