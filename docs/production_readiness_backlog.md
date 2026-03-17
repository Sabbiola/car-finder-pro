# Production Readiness Backlog

Questo backlog traccia i gap reali che restano dopo il lavoro di migrazione FastAPI gia presente nel codice.

## P0 - Da Chiudere Prima di Una Dichiarazione Seria di Production Ready

- Rendere FastAPI il default runtime esplicito end-to-end dove questa e la direzione voluta, non solo una modalita disponibile.
- Raccogliere evidenza staging per `fastapi_only`, canary rollout e rollback drill.
- Verificare il bootstrap locale con toolchain correnti:
  - Python 3.14
  - Node 22
  - npm
  - Deno v2
- Validare secret di deploy, health check e uso runbook negli ambienti target.
- Chiudere definitivamente il drift documentale e i problemi di encoding.

## P1 - Hardening

- Portare l'observability oltre i raw ops endpoint:
  - sink reale
  - ownership dashboard
  - alert azionabili
- Provare operativamente il delivery alerts:
  - send in staging
  - retry behavior
  - audit visibility
- Estendere la copertura E2E oltre l'attuale spec centrata sullo stream:
  - detail
  - compare
  - favorites
  - saved searches
  - alerts
- Documentare lo stato branch protection e required checks fuori dal repo e linkarlo dalla release documentation.

## P2 - Pulizia Boundary

- Ridurre ulteriormente il peso dei flussi edge legacy che restano fuori dal path primario FastAPI.
- Decidere se altri user journey Supabase-direct debbano restare ibridi o passare dietro backend API.
- Aggiungere un passo ricorrente di documentation audit per evitare nuovo drift tra contratti pubblici e codice.
