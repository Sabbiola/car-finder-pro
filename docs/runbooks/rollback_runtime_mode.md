# Runbook - Rollback Runtime Mode

## Obiettivo

Eseguire un rollback tecnico esplicito e verificabile quando il rollout FastAPI-first degrada in modo non accettabile.

Il rollback e valido solo se:
- il percorso tecnico usato e documentato
- i check pre/post sono salvati come evidenza
- il ripristino della mode target e pianificato

## Trigger

- Sev1 su journey core (`search`, `stream`, `detail`, `compare`, `favorites`, `saved searches`, `alerts`)
- SLO fuori soglia durante canary:
  - `search sync p95 >= 5s`
  - `error rate >= 2%`
  - `stream completion < 98%`
- `ops-snapshot` con alert `critical` ripetuto

## Prerequisiti

- URL target disponibili:
  - `FASTAPI_BASE_URL`
  - `EDGE_SCRAPE_LISTINGS_URL` (se si usa rollback sul proxy edge)
- Token opzionali:
  - `OPS_TOKEN`
  - `ALERTS_PROCESSOR_TOKEN`
- Tooling:
  - `pwsh` per script locali
  - `supabase` CLI solo se si applica switch mode da CLI

## Percorsi di Rollback Supportati

### Percorso A - Rollback deploy FastAPI (consigliato per journey core)

1. Rollback deployment Railway all'ultima release stabile (console Railway o procedura team).
2. Rieseguire smoke matrix su backend ripristinato.
3. Confermare recovery SLO su `ops/metrics` e assenza `critical` su `ops/alerts`.

Nota:
- Questo percorso non cambia l'architettura.
- E il rollback primario quando il problema e nel backend FastAPI.

### Percorso B - Rollback proxy edge mode (fallback controllato)

Usare solo se il problema e sul path proxy edge o su client legacy.

Mode supportate da `scrape-listings`:
- `fastapi_only`
- `primary_with_fallback`
- `legacy_only`

Comando CLI (se policy team lo consente):

```bash
supabase secrets set FASTAPI_PROXY_MODE=primary_with_fallback --project-ref <PROJECT_REF>
```

Rollback aggressivo:

```bash
supabase secrets set FASTAPI_PROXY_MODE=legacy_only --project-ref <PROJECT_REF>
```

Ripristino mode target:

```bash
supabase secrets set FASTAPI_PROXY_MODE=fastapi_only --project-ref <PROJECT_REF>
```

## Drill Operativo (obbligatorio in canary)

Script consigliati:
- `scripts/run-core-journey-smoke.ps1`
- `scripts/run-rollback-drill.ps1`

Nota exit code `run-rollback-drill.ps1`:
- `0` drill completo con mode switch applicato via CLI
- `1` drill fallito
- `2` smoke pre/post ok ma mode switch non applicato automaticamente (richiesta evidenza manuale)

Drill minimo:
1. Eseguire pre-check smoke:
```powershell
pwsh -File scripts/run-core-journey-smoke.ps1 -FastApiBaseUrl "<FASTAPI_BASE_URL>" -OutputFile "artifacts/pre-smoke.json"
```
2. Applicare rollback path scelto (A o B).
3. Eseguire post-check smoke:
```powershell
pwsh -File scripts/run-core-journey-smoke.ps1 -FastApiBaseUrl "<FASTAPI_BASE_URL>" -OutputFile "artifacts/post-smoke.json"
```
4. Salvare evidenza decisione + timestamp + operatore + mode prima/dopo.

## Criteri Pass/Fail del Rollback Drill

Pass:
- pre-check fallito o degradato come atteso dal trigger
- post-check tutto verde
- nessun alert `critical` persistente dopo rollback
- check `search`/`stream`/`detail`/`compare`/`favorites`/`saved searches`/`alerts` riusciti

Fail:
- rollback eseguito senza evidenza pre/post
- percorso tecnico non ripetibile
- journey core ancora degradati dopo rollback
- impossibilita di ripristinare mode target a fine drill

## Evidenza Richiesta

Per chiudere un drill servono questi artifact:
- output smoke pre (`pre-smoke.json`)
- output smoke post (`post-smoke.json`)
- eventuale output script drill (`rollback-drill-summary.json`)
- estratto `ops-metrics.json` e `ops-alerts.json`
- nota operativa con:
  - data/ora UTC
  - path scelto (A o B)
  - motivo
  - risultato
