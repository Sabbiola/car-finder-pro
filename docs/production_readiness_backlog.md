# Production Readiness Backlog

Questo backlog traccia i gap reali che restano dopo il lavoro di migrazione FastAPI gia presente nel codice.

## P0 - Da Chiudere Prima di Una Dichiarazione Seria di Production Ready

- Verificare con evidenza operativa (staging/canary) il comportamento runtime gia implementato: fastapi default e fail-closed sui journey core.
- Raccogliere evidenza staging per `fastapi_only`, canary rollout e rollback drill.
- Eseguire almeno un ciclo completo:
  - soak staging 5-7 giorni
  - canary con gate documentati
  - rollback drill con evidenza pre/post
- Verificare il bootstrap locale con toolchain correnti:
  - Python 3.14
  - Node 22
  - npm
  - Deno v2
- Validare secret di deploy, health check e uso runbook negli ambienti target.
- Chiudere definitivamente il drift documentale e i problemi di encoding.

## P1 - Hardening

- Portare l'observability oltre i raw ops endpoint:
  - consumo dashboard esterna continuativo su payload `ops-metrics/ops-alerts`
  - ownership e on-call stabile dei runbook
- Provare operativamente il delivery alerts:
  - send in staging
  - retry behavior
  - audit visibility
- Stabilizzare in CI/staging la nuova copertura E2E journey core (oltre lo stream):
  - search fastapi mode
  - detail
  - compare
  - favorites
  - saved searches
  - alerts
  - auth non-auth redirect path
- Documentare lo stato branch protection e required checks fuori dal repo e linkarlo dalla release documentation.

## P2 - Pulizia Boundary

- Ridurre ulteriormente il peso dei flussi edge legacy che restano fuori dal path primario FastAPI.
- Decidere se altri user journey Supabase-direct debbano restare ibridi o passare dietro backend API.
- Aggiungere un passo ricorrente di documentation audit per evitare nuovo drift tra contratti pubblici e codice.
