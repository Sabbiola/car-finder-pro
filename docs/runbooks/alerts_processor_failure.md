# Runbook - Alerts Processor Failure

## Trigger

- Workflow `process-alerts` fallisce.
- `GET /api/ops/alerts` contiene:
  - `alerts_processor_failure_rate_high`
  - `alerts_delivery_failure_rate_high`
  - `alerts_retry_queue_high`

## Diagnostica Rapida

1. Esegui snapshot ops:
```bash
curl -H "x-ops-token: <OPS_TOKEN>" "<FASTAPI_BASE_URL>/api/ops/metrics"
curl -H "x-ops-token: <OPS_TOKEN>" "<FASTAPI_BASE_URL>/api/ops/alerts"
```
2. Esegui process manuale dry-run:
```bash
curl -X POST "<FASTAPI_BASE_URL>/api/alerts/process" \
  -H "Content-Type: application/json" \
  -H "x-alerts-token: <ALERTS_PROCESSOR_TOKEN>" \
  --data '{"dry_run":true,"limit":100,"idempotency_key":"manual-dry-run-001"}'
```
3. Verifica configurazione delivery:
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `SUPABASE_SERVICE_ROLE_KEY` (per lookup email e audit write)

## Mitigazione

1. Se errore token/processor:
- correggere `ALERTS_PROCESSOR_TOKEN` in runtime e GitHub secret

2. Se errori delivery email:
- verificare credenziali Resend
- se necessario, mantenere delivery in-app e fermare canale email finche non stabilizzato

3. Se coda retry alta:
- aumentare temporaneamente frequenza workflow `process-alerts`
- ridurre causa primaria (provider email o Supabase auth lookup)

## Exit Criteria

- Workflow `process-alerts` verde su almeno 3 run consecutivi
- Alert processor failure rate sotto soglia
- Nessun alert `alerts_retry_queue_high` attivo
