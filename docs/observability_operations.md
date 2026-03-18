# Observability Operations (Lean Externalized)

Questa guida descrive il wiring operativo gia presente per metriche, alerting e alerts processor.

## Stato Operativo Reale

| Area | Stato | Cosa e operativo oggi | Dipendenze esterne ancora necessarie |
| --- | --- | --- | --- |
| Ops endpoints | operativo | `/api/ops/metrics` e `/api/ops/alerts` espongono runtime metrics, provider health e alert derivati | token `OPS_TOKEN` quando attivo |
| Ops auth | operativo | enforcement `x-ops-token` lato API (se `OPS_TOKEN` configurato) | secret distribuito a chi invoca gli endpoint |
| Ops snapshot workflow | operativo | `ops-snapshot.yml` esegue pull + validazione payload + artifact | `FASTAPI_OPS_BASE_URL` (+ `FASTAPI_OPS_TOKEN` se richiesto) |
| Perf load workflow | operativo | `perf-load.yml` esegue k6 con threshold SLO su search sync/stream | `FASTAPI_STAGING_BASE_URL` raggiungibile |
| Alerts API | operativo | create/list/deactivate/process con outcome machine-readable | backend deploy + Supabase runtime |
| Alerts process scheduler | operativo | `process-alerts.yml` invoca `/api/alerts/process` e valida contract | `ALERTS_PROCESS_URL` + `ALERTS_PROCESSOR_TOKEN` |
| Alerts retry/audit | operativo | retry policy, idempotency key, audit su `alert_delivery_attempts` | migration applicata e DB raggiungibile |
| Email delivery | parziale | integrazione Resend gia implementata nel delivery service | `RESEND_API_KEY` + `RESEND_FROM_EMAIL` validi |
| External sink webhook | parziale | webhook sink supportato via `OBSERVABILITY_WEBHOOK_URL` | endpoint sink esterno reale e monitorato |

Regola di verita:
- "operativo" = wiring presente + percorso invocabile da workflow/script.
- "parziale" = wiring presente ma dipende da secret/servizi esterni non verificabili dal solo repo.

## Dati Disponibili

Endpoint ops:
- `GET /api/ops/metrics`
- `GET /api/ops/alerts`

Protezione:
- se `OPS_TOKEN` e configurato, entrambi gli endpoint richiedono header `x-ops-token`.

Campi chiave in `ops/metrics`:
- `runtime.search.sync` (`p50_ms`, `p95_ms`, `error_rate`)
- `runtime.search.stream` (`p50_ms`, `p95_ms`, `error_rate`)
- `runtime.stream_completion` (`completion_rate`)
- `providers[]` (`error_rate`, `configured`, `latency_ms`)
- `runtime.alerts_processor` (runs, triggered/notified/failed, failure rate)
- `alerts_processor.delivery_attempts_24h` (audit status/channel/failure rate)

Campi chiave in `ops/alerts`:
- `search_latency_high`
- `search_error_rate_high`
- `provider_not_configured`
- `provider_error_rate_high`
- `stream_completion_low`
- `alerts_processor_failure_rate_high`
- `alerts_delivery_failure_rate_high`
- `alerts_retry_queue_high`

## Dashboard Minima (obbligatoria)

1. Search API:
- `search.sync.p95_ms`
- `search.stream.p95_ms`
- `search.sync.error_rate`
- `search.stream.error_rate`

2. Provider health:
- `providers[].error_rate`
- `providers[].configured`
- `providers[].latency_ms`

3. Stream health:
- `stream_completion.completion_rate`

4. Alerts processor outcomes:
- `runtime.alerts_processor.failure_rate`
- `runtime.alerts_processor.notified_total`
- `alerts_processor.delivery_attempts_24h.by_status`
- `alerts_processor.delivery_attempts_24h.failure_rate`

## Workflow Operativi

- `process-alerts.yml`
  - invoca `/api/alerts/process`
  - valida shape response
  - opzionale smoke sintetico `create -> process -> list` con `ALERTS_SMOKE_LISTING_ID`
  - pubblica artifact JSON

- `ops-snapshot.yml`
  - invoca `/api/ops/metrics` e `/api/ops/alerts`
  - supporta `FASTAPI_OPS_TOKEN`
  - valida anche la presenza di `alerts_processor.delivery_attempts_24h` e campi minimi
  - fallisce se rileva alert `critical`
  - pubblica artifact JSON

- `perf-load.yml`
  - esegue k6 su `/api/search` e `/api/search/stream`
  - esporta summary artifact
- `canary-smoke.yml`
  - workflow manuale per smoke journey core su staging canary
  - esporta artifact `canary-smoke.json`

## Verifica Minima Consigliata

1. Eseguire `ops-snapshot.yml` su staging.
2. Verificare artifact:
   - `ops-metrics.json`
   - `ops-alerts.json`
3. Eseguire `process-alerts.yml` (manuale o scheduler) e verificare:
   - `alerts-process-response.json`
   - presenza campi contract + `items[].attempt_number/max_attempts`
4. Eseguire `perf-load.yml` e verificare `perf-load-summary.json`.

Script operativi locali per rollout:
- `scripts/run-core-journey-smoke.ps1`
- `scripts/run-staging-soak.ps1`
- `scripts/run-rollback-drill.ps1`

## Dipendenze Esterne

Per piena operativita servono:
- `OBSERVABILITY_WEBHOOK_URL` (sink esterno log/metriche)
- `FASTAPI_OPS_BASE_URL` (+ `FASTAPI_OPS_TOKEN` se `OPS_TOKEN` attivo)
- `ALERTS_PROCESS_URL` + `ALERTS_PROCESSOR_TOKEN`
- `RESEND_API_KEY` + `RESEND_FROM_EMAIL` per delivery email reale

## Gap Residui Prima del Go-Live

- Dashboard esterna e ownership on-call non sono verificabili dal repo: servono evidenze operative in ambiente.
- Resend puo essere cablato ma resta "parziale" finche non si prova delivery reale in staging.
- Gli endpoint ops sono runtime-memory oriented: la trend analysis storica dipende dagli artifact/workflow o da sink esterno.
