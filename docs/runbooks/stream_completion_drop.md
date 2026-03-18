# Runbook - Stream Completion Drop

## Trigger

- `GET /api/ops/alerts` contiene `stream_completion_low`.
- `stream_completion.completion_rate < 0.98`.

## Diagnostica Rapida

1. Verifica metriche stream:
```bash
curl -H "x-ops-token: <OPS_TOKEN>" "<FASTAPI_BASE_URL>/api/ops/metrics"
```
2. Verifica alert e soglie:
```bash
curl -H "x-ops-token: <OPS_TOKEN>" "<FASTAPI_BASE_URL>/api/ops/alerts"
```
3. Ispeziona log:
- eventi `search_started` / `search_completed` con `mode=stream`
- eventi SSE `error` e progress provider `failed`

## Mitigazione

1. Ridurre carico concorrente:
- abbassare `MAX_PROVIDER_CONCURRENCY` o timeout provider
- rieseguire perf smoke (`perf-load.yml` o k6 locale)

2. Se degradazione legata a provider specifici:
- disabilitare provider instabile (`DISABLED_PROVIDERS`)
- confermare che la completion risale sopra soglia

## Exit Criteria

- `stream_completion.completion_rate >= 0.98` stabile per almeno 30 minuti
- Nessun alert `stream_completion_low` attivo
