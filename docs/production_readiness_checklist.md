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
| Alerts operations | partial | esistono scheduler workflow, retry metadata e audit migration | verifica send reali, retry behavior e prove staging |
| Frontend runtime boundary | partial | esiste il branching per runtime config | FastAPI come default inequivocabile end-to-end |
| Observability plumbing | partial | esistono `/api/ops/metrics`, `/api/ops/alerts`, workflow snapshot e perf | sink reale, dashboard, alert consumption e runbook proof |
| Automated test coverage | partial | esistono 44 test backend, 39 test frontend, 1 Playwright spec e test edge | prova di esecuzione locale e E2E piu ampi |
| CI e release gate | done | esistono `ci.yml` e release gate aggregato | lo stato branch protection non e provabile dal solo repo |
| DB migrations | done | esistono 15 migration in `supabase/migrations` | prova di applicazione negli ambienti target |
| Staging canary e rollback | missing proof | esistono docs e workflow di supporto | evidenza registrata di canary, rollback drill e accettazione |
| Local developer bootstrap | missing proof | esistono istruzioni di installazione | bootstrap verificato su macchina reale con toolchain corrente |
| Branch protection | missing proof | e documentata come necessaria | la prova delle impostazioni GitHub e esterna al repo |

## Release Gates

Gate minimi prima del go-live:
- job `frontend`, `backend`, `edge-functions`, `e2e` e `release-gate` verdi
- staging in `fastapi_only` per il path search primario
- secret ed env presenti per workflow deploy e ops
- migration applicate, inclusa `20260313000000_alert_delivery_attempts.sql`
- rollback drill eseguito e documentato
- nessun Sev1 aperto

## Evidenze Richieste Prima di Dire "Production Ready"

Il repo da solo non basta. Per una dichiarazione seria servono:
- install e startup riusciti con toolchain correnti
- CI verde sul branch corrente e su quello target
- staging smoke su search, detail, alerts, favorites, saved searches e compare
- evidenza di canary piu evidenza di rollback
- verifica live di SLO e alerting

Finche queste prove non esistono, il modo corretto di descrivere il progetto e:
- FastAPI-first per la search
- hybrid bounded nel complesso
- production hardening in corso
