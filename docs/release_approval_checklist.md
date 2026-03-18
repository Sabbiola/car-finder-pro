# Release Approval Checklist (Fase 6)

Questa checklist e il gate finale di approvazione release.

Regola:
- non approvare GO se manca evidenza operativa.
- se almeno un gate critico e rosso, la decisione e `NO-GO`.

## 1. Gate Critici (obbligatori)

Compilare con stato `pass` o `fail` e link evidenza.

| Gate | Target | Stato | Evidenza |
| --- | --- | --- | --- |
| CI verde | `frontend`, `backend`, `edge-functions`, `e2e`, `release-gate` verdi | `pending` | run GitHub Actions |
| Staging stabile | soak 5-7 giorni con smoke success rate `>= 98%` | `pending` | `soak-summary.json` + smoke artifacts |
| Search latency | `search sync p95 < 5s` | `pending` | `ops-metrics.json` + `perf-load-summary.json` |
| Stream error rate | `search stream error rate < 2%` | `pending` | `ops-metrics.json` + perf/load evidence |
| Stream completion | `stream completion >= 98%` | `pending` | `ops-metrics.json` |
| Rollback drill | drill completato con evidenza pre/post | `pending` | `rollback-drill-summary.json` + `pre/post-smoke.json` |
| Backlog blocker | nessun blocker P0 aperto | `pending` | review `docs/production_readiness_backlog.md` |
| Sev1 | nessun Sev1 aperto in finestra canary | `pending` | incident log/team log |

## 2. Evidence Pack Minimo

- CI run URLs per job richiesti.
- `soak-summary.json` + serie `smoke-*.json`.
- `canary-smoke.json` (almeno 3 run verdi) + `ops-metrics.json`/`ops-alerts.json`.
- `perf-load-summary.json` su staging.
- `rollback-drill-summary.json` + smoke pre/post.
- Nota operativa con:
  - data/ora UTC
  - operatore responsabile
  - decisione GO/NO-GO
  - motivazione sintetica.

## 3. Decision Record (obbligatorio)

Compilare al termine della review finale:

- Release candidate:
- Data/ora UTC:
- Reviewer:
- Esito gate critici:
- Evidenze linkate:
- Blocker residui:
- Decisione finale: `GO` oppure `NO-GO`
- Note:

## 4. Decisione Corrente (stato repo)

In assenza di evidenze operative complete nel repository, la decisione raccomandata resta:
- `NO-GO`

