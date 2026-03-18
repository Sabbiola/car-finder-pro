# Runbook - Provider Failure Spike

## Trigger

- `GET /api/ops/alerts` contiene `provider_error_rate_high` o `provider_not_configured`.
- Errori utente in crescita su `provider_timeout` / `provider_failure`.

## Diagnostica Rapida

1. Verifica salute provider:
```bash
curl -H "x-ops-token: <OPS_TOKEN>" "<FASTAPI_BASE_URL>/api/providers/health"
```
2. Verifica alert correnti:
```bash
curl -H "x-ops-token: <OPS_TOKEN>" "<FASTAPI_BASE_URL>/api/ops/alerts"
```
3. Ispeziona log per provider:
- eventi `provider_search_completed` con `status=timeout|error`
- eventi `search_completed` con `provider_errors > 0`

## Mitigazione

1. Se provider non configurato:
- correggere secret/config provider nell'ambiente
- rieseguire smoke su `/api/providers` e `/api/providers/health`

2. Se provider instabile:
- disabilitare temporaneamente provider via `DISABLED_PROVIDERS`
- deploy config
- confermare riduzione errori su `/api/ops/alerts`

## Exit Criteria

- Nessun `provider_not_configured` in `/api/ops/alerts`
- Error rate provider sotto soglia (`<= 2%`) per almeno 30 minuti
