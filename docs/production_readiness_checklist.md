# Production Readiness Checklist

Questo documento e la matrice canonica di stato per il production readiness a livello repo.

Significato degli stati:
- `done` -> implementato in codice o workflow e visibile nel repo
- `partial` -> implementato in parte, ma boundary o prova operativa sono ancora incompleti
- `missing proof` -> il repo non lo dimostra ancora

## Matrice di Stato

| Area | Stato | Evidenza nel repo | Cosa manca ancora |
| --- | --- | --- | --- |
| FastAPI search core | done | esistono `/api/search`, `/api/search/stream`, orchestrazione provider e contratti SSE | prova runtime live |
| Provider migration per search | done | esistono provider per `autoscout24`, `subito`, `ebay`, `automobile`, `brumbrum` | resta solo la prova di rollout |
| Search contract v1 | done | filtri estesi e strict capability semantics sono in backend e frontend | prova regressioni in ambiente live |
| Listing detail e analysis API | done | esistono `/api/listings/{listing_id}` e `/api/listings/analyze` | smoke live |
| Alerts API surface | done | esistono alerts CRUD e `/api/alerts/process` | prova delivery live |
| Alerts operations | partial | scheduler workflow con parsing outcome, smoke sintetico opzionale, retry metadata e audit migration | secret runtime reali + prova delivery email in staging |
| Frontend runtime boundary | done | runtime fail-closed sui journey core in fastapi mode, Auth Supabase-direct intenzionale | prova rollout stabile in staging/canary |
| Observability plumbing | partial | `/api/ops/*` con token opzionale, summary alerts processor, workflow snapshot/perf con artifact | sink webhook live + dashboard esterna con evidenza continuativa |
| Automated test coverage | partial | esistono suite backend/frontend, 2 Playwright spec (stream + journey core) e test edge | prova di esecuzione locale e stabilita E2E in CI/staging |
| Staging soak/canary playbook | done | esistono runbook + script per soak, canary e rollback drill con evidenza JSON | esecuzione reale in staging/canary |
| CI e release gate | done | esistono `ci.yml` e release gate aggregato | lo stato branch protection non e provabile dal solo repo |
| DB migrations | done | esistono 15 migration in `supabase/migrations` | prova di applicazione negli ambienti target |
| Staging canary e rollback | missing proof | esistono docs e workflow di supporto | evidenza registrata di canary, rollback drill e accettazione |
| Local developer bootstrap | missing proof | esistono istruzioni di installazione | bootstrap verificato su macchina reale con toolchain corrente |
| Branch protection | missing proof | e documentata come necessaria | la prova delle impostazioni GitHub e esterna al repo |

## Release Gates

Gate minimi prima del go-live:
- preflight locale eseguito con `scripts/validate-go-live-readiness.ps1`
- job `frontend`, `backend`, `edge-functions`, `e2e` e `release-gate` verdi
- staging in `fastapi_only` per il path search primario
- soak staging 5-7 giorni con success rate >= 98%
- canary con 3 smoke consecutive verdi
- secret ed env presenti per workflow deploy e ops
- migration applicate, inclusa `20260313000000_alert_delivery_attempts.sql`
- rollback drill eseguito e documentato
- nessun blocker P0 aperto in `docs/production_readiness_backlog.md`
- nessun Sev1 aperto

## Gate Finali Fase 6 (Go/No-Go)

Target minimi da provare con evidenza operativa:
- `search sync p95 < 5s`
- `search stream error rate < 2%`
- `stream completion >= 98%`
- CI verde completa
- staging stabile (soak 5-7 giorni)
- rollback drill completato
- nessun blocker P0 aperto

Checklist approvazione finale:
- `docs/release_approval_checklist.md`

## Bootstrap Verified (Fase 1)

Per chiudere la fase "Bootstrap reale e baseline operativa", servono tutte queste evidenze:

- toolchain target disponibili:
  - Python 3.14
  - Node 22
  - npm
  - Deno v2
- bootstrap coerente verificato per:
  - frontend
  - backend
  - edge functions
  - test suite minima
- profili env `local/staging/production` usati come unica fonte operativa
- secret matrix workflow verificata e aggiornata in `docs/runtime_env_profiles.md`

## Evidenze Richieste Prima di Dire "Production Ready"

Il repo da solo non basta. Per una dichiarazione seria servono:
- install e startup riusciti con toolchain correnti
- CI verde sul branch corrente e su quello target
- staging smoke su search, detail, alerts, favorites, saved searches e compare
- smoke provider reali staging eseguito:
  - `docs/staging_provider_smoke_checklist.md`
- evidenza di canary piu evidenza di rollback
- verifica live di SLO e alerting
- validazione observability/alerts operativa:
  - `docs/observability_operations.md`
- runbook incident validati in esercitazione:
  - `docs/runbooks/staging_soak_canary.md`
  - `docs/runbooks/provider_failure_spike.md`
  - `docs/runbooks/stream_completion_drop.md`
  - `docs/runbooks/alerts_processor_failure.md`
  - `docs/runbooks/rollback_runtime_mode.md`
- checklist finale compilata:
  - `docs/release_approval_checklist.md`
- policy stabilization approvata:
  - `docs/stabilization_window_policy.md`

Finche queste prove non esistono, il modo corretto di descrivere il progetto e:
- FastAPI-first per la search
- hybrid bounded nel complesso
- production hardening in corso

## Known Risks / Residual Risks

- evidenza operativa staging/canary/rollback non allegata nel repo come stato corrente
- observability esterna ancora lean e dipendente da secret/sink reali fuori repo
- test e bootstrap locali non verificati in questo ambiente (toolchain non completa)
- backlog P0 ancora aperto finche non chiuso con evidenza

## Decisione Raccomandata Corrente

Con lo stato attuale della sola evidenza in repo:
- `NO-GO`
