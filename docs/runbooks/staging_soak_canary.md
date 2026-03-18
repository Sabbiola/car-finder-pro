# Runbook - Staging Soak e Canary

## Obiettivo

Dimostrare stabilita operativa prima del go-live:
- soak staging continuo 5-7 giorni
- canary controllato con gate espliciti
- rollback drill obbligatorio

Questo runbook non dichiara il prodotto production-ready da solo: produce evidenza.

## Scope Journey da Validare

Journey core da validare in `backendMode=fastapi`:
- search
- stream
- detail
- compare
- favorites
- saved searches
- alerts

Auth resta Supabase-direct e deve restare funzionante (path non-auth incluso).

## Prerequisiti

- Staging in mode target:
  - frontend `VITE_BACKEND_MODE=fastapi`
  - edge proxy `FASTAPI_PROXY_MODE=fastapi_only`
- Workflow verdi:
  - `ci.yml` (`frontend`, `backend`, `edge-functions`, `e2e`, `release-gate`)
  - `canary-smoke.yml` disponibile per run manuale durante la finestra canary
- Secret operativi presenti:
  - `FASTAPI_STAGING_BASE_URL`
  - `FASTAPI_OPS_BASE_URL` (+ `FASTAPI_OPS_TOKEN` se richiesto)
  - `ALERTS_PROCESS_URL` + `ALERTS_PROCESSOR_TOKEN`

## Fase 1 - Soak Staging (5-7 giorni)

Durata:
- minimo 120 ore (5 giorni)
- target 168 ore (7 giorni)

Frequenza:
- smoke matrix ogni 30 minuti
- snapshot ops ogni 10 minuti (`ops-snapshot.yml`)
- process alerts ogni 15 minuti (`process-alerts.yml`)

Script consigliato:

```powershell
pwsh -File scripts/run-staging-soak.ps1 `
  -FastApiBaseUrl "<FASTAPI_BASE_URL>" `
  -DurationHours 120 `
  -IntervalMinutes 30 `
  -OutputDir "artifacts/soak"
```

Gate di successo soak:
- smoke success rate >= 98%
- nessun alert `critical` persistente su `ops/alerts`
- `search sync p95 < 5s`
- `error rate < 2%`
- `stream completion >= 98%`

No-go soak:
- smoke success rate < 98%
- failure ripetute non risolte su journey core
- alert `critical` persistenti

## Fase 2 - Canary

Strategia canary consigliata:
1. Avvio canary con osservazione stretta (30-60 minuti).
2. Verifica smoke matrix almeno 3 run consecutive.
   - opzionale: eseguire `canary-smoke.yml` da GitHub Actions per tracciare artifact standard.
3. Verifica telemetria e alert in tempo reale.
4. Esecuzione rollback drill durante canary.
5. Promozione solo se tutti i gate sono verdi.

Gate di successo canary:
- 3 smoke run consecutive verdi
- nessun `critical` in `ops/alerts`
- SLO in soglia durante finestra canary
- rollback drill eseguito e superato

No-go canary:
- fallimento smoke su journey core
- superamento soglie SLO
- rollback drill non eseguito o fallito

## Fase 3 - Rollback Drill

Obbligatorio prima della promozione completa.

Script consigliato:

```powershell
pwsh -File scripts/run-rollback-drill.ps1 `
  -FastApiBaseUrl "<FASTAPI_BASE_URL>" `
  -EvidenceDir "artifacts/rollback-drill"
```

Dettagli tecnici del rollback: `docs/runbooks/rollback_runtime_mode.md`.

## Evidenza Minima da Allegare

- `soak-summary.json`
- N output smoke (`smoke-*.json`)
- `rollback-drill-summary.json`
- `ops-metrics.json` e `ops-alerts.json` della finestra canary
- `perf-load-summary.json` piu recente su staging

## Decisione

Promuovere a produzione solo se:
- soak superato
- canary superato
- rollback drill superato
- nessun Sev1 aperto
