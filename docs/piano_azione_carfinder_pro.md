# Refactor Completo CarFinder Pro (Wave Unica con Transizione FastAPI)

## Summary

Obiettivo: completare il refactor strutturale end-to-end con FastAPI come backend primario, mantenendo una release di transizione con proxy legacy attivo.

Risultato atteso della wave:
- split fisico frontend
- provider architecture backend
- SSE stabile
- CI/CD frontend+backend+edge
- deploy backend su Railway

## Scope Wave

### 1. Split repository e toolchain

- Spostare il frontend in `frontend/` con update completo di:
  - build
  - lint
  - test
  - alias TS/Vite
  - workflow CI
- Mantenere `supabase/` in root per migrazioni e funzioni legacy
- Consolidare governance docs (`AGENTS`, README, piano azione)
- Gestire catalogo marketplace globale come artefatto versionato

### 2. Backend FastAPI completo (`backend/`)

- Architettura provider-based con separazione:
  - API
  - orchestrazione
  - provider adapters
  - normalizzazione
  - dedup
  - ranking
- Migrazione provider core:
  - AutoScout24
  - Subito
- Orchestratore concorrente con timeout e partial failure handling
- Endpoint prodotto:
  - `POST /api/search`
  - `POST /api/search/stream`
  - `GET /api/providers`
  - `GET /api/providers/health`
  - `GET /api/filters/metadata`
- Ranking/dedup base lato backend con reason codes espliciti

### 3. Transizione runtime con proxy legacy

- Tenere `supabase/functions/scrape-listings` come proxy attivo verso FastAPI
- Fallback automatico a legacy in caso errore backend
- Provider non migrati serviti via path legacy nella release di transizione
- Feature flag/env per switch controllato:
  - FastAPI primary
  - fallback on error
  - rollback immediato

### 4. Frontend su nuovo assetto

- Runtime config unica (mode + base URL) senza hardcode residui
- Integrazione stream SSE reale:
  - `progress`
  - `result`
  - `complete`
  - `error`
- Gestione trasparente progress + partial failure
- Contratti backend tipizzati nel flow di ricerca
- Metadata dinamici backend-driven (inizio sostituzione statici)

### 5. CI/CD e deploy

- GitHub Actions:
  - frontend pipeline
  - backend pipeline
  - edge proxy contract checks
- Deploy FastAPI su Railway con env management e rollout progressivo
- Mantenere deploy edge functions in modalita proxy transitoria

## Public APIs / Interfaces

- `POST /api/search`
  - `total_results`
  - `listings`
  - `providers_used`
  - `provider_errors`
- `POST /api/search/stream`
  - eventi SSE stabili: `progress`, `result`, `complete`, `error`
- `GET /api/providers`
  - catalogo provider + capability/supported filters
- `GET /api/providers/health`
  - `enabled`, `configured`, `latency_ms`, `error_rate`
- `GET /api/filters/metadata`
  - metadata dinamici per form frontend
- Contratto proxy legacy invariato lato client (`success`, `count`) con campo `source`

## Test Plan

- Unit backend:
  - provider selector
  - orchestrator
  - normalizzazione
  - dedup
  - scoring
  - mapping provider
- Integration backend:
  - shape e ordering eventi SSE
  - partial failure
  - timeout/cancellazione
  - endpoint contracts
- Contract tests:
  - compatibilita FastAPI <-> Edge proxy
- Frontend tests:
  - stream hook
  - transizioni stato ricerca
  - fallback error path
  - rendering progress/merge risultati
- E2E smoke:
  - ricerca provider core
  - fallback provider non migrati
  - export/sorting invariati

## Assumptions / Defaults

- FastAPI primario con transizione di 1 release
- Proxy legacy attivo in produzione durante transizione
- Split frontend fisico in questa wave
- Scope provider implementativo: 2 core provider ora + catalogo roadmap versionato
- CI/CD backend incluso nella wave con target Railway
- Supabase resta datastore condiviso in fase di transizione

## Delivery Checklist (Wave)

- [x] Split frontend fisico in `frontend/`
- [x] Pipeline CI aggiornata per frontend/backend/edge
- [x] Pipeline deploy FastAPI su Railway
- [x] API FastAPI target implementate
- [x] Provider core migrati su backend FastAPI (AutoScout24/Subito)
- [x] Orchestrazione concorrente + timeout + partial failure
- [x] Proxy Edge con fallback controllato e feature mode
- [x] Contract helper proxy + test Deno
- [x] Runtime config frontend consolidata
- [x] Stream SSE integrato nel search flow frontend
- [x] Metadata dinamici backend-driven avviati
- [ ] Hardening finale con test runtime completi in ambiente con toolchain installata
