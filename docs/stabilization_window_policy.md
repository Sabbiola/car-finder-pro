# Stabilization Window Policy (Fase 6)

Questa policy governa la finestra post go-live/canary per minimizzare regressioni.

## Durata

- Durata standard: `14 giorni` dalla promozione canary -> full traffic.
- Estensione: consentita di altri `7 giorni` se i KPI restano instabili o se ci sono incidenti aperti.

## Obiettivo

Mantenere i KPI entro soglia e chiudere bug critici senza introdurre rischio da cambi non necessari.

KPI monitorati:
- `search sync p95 < 5s`
- `search stream error rate < 2%`
- `stream completion >= 98%`
- assenza di alert `critical` persistenti su `ops/alerts`

## Change Policy Durante Stabilization

Consentito:
- fix Sev1/Sev2 su journey core (`search`, `stream`, `detail`, `compare`, `favorites`, `saved searches`, `alerts`)
- fix sicurezza e remediation segreti/config
- tuning timeout/retry/concurrency/config operative
- fix osservabilita e alerting necessari a detection/recovery
- fix docs/runbook quando il comportamento reale cambia

Non consentito:
- nuove macro-feature
- refactor architetturali non necessari al fix
- cambi contratto pubblico non backward-compatible
- migrazioni ad alto rischio non legate a incident remediation

## Release Control in Finestra

- Deploy preferiti in slot a basso traffico.
- Ogni deploy richiede smoke journey core pre/post.
- Per regressioni gravi usare rollback immediato secondo:
  - `docs/runbooks/rollback_runtime_mode.md`

## Exit Criteria Stabilization

La finestra si chiude quando sono tutte vere:
- KPI in soglia per almeno `7 giorni` consecutivi
- nessun Sev1 aperto
- nessun blocker P0 aperto
- almeno un rollback drill documentato e superato
- runbook operativi confermati dal team on-call

