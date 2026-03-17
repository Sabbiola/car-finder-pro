# CarFinder Pro - Root AGENTS.md

## Progetto

CarFinder Pro e un prodotto di ricerca multi-provider e decision support per auto usate.

Stato reale del repo:
- `frontend/` contiene l'app React 18 + TypeScript + Vite
- `backend/` contiene il backend FastAPI che gestisce provider, contratti normalizzati, orchestrazione search e servizi di analisi
- `supabase/` contiene migrazioni PostgreSQL e le Edge Functions ancora usate per proxy, fallback e flussi legacy
- `docs/` contiene stato operativo e materiale di rollout, ma codice, manifest e workflow restano la source of truth quando la documentazione diverge

## Runtime Reale

Il sistema oggi e **hybrid bounded**.

- FastAPI e l'implementazione primaria per search, search streaming, listing detail, listing analysis, alerts API e user data API.
- Supabase Auth resta frontend-direct per scelta architetturale.
- L'edge `scrape-listings` continua a supportare proxy e fallback tramite `FASTAPI_PROXY_MODE`.
- Alcuni flussi frontend continuano a dipendere dalla runtime mode o ad andare in fallback quando `backendMode != "fastapi"`.

Non descrivere il sistema come completamente migrato finche codice, configurazione di deploy e prove di rollout non lo dimostrano insieme.

## Contratti Condivisi

Eventi search stream stabili:
- `progress`
- `result`
- `complete`
- `error`

Regole sul contratto search:
- I contratti devono restare espliciti e versionabili.
- `SearchRequest v1` include `is_new`, `color`, `doors`, `emission_class`, `seller_type`, piu compatibilita additiva per `private_only`.
- `GET /api/filters/metadata` e il punto canonico per i metadata di capability:
  - `canonical_filters`
  - `backend_post_filters`
  - `provider_filter_union`
  - `provider_filter_intersection`
  - `provider_filter_semantics = strict_all_active_non_post_filters`
- Preferire modifiche additive a cambi semantici silenziosi.

## Regole di Lavoro

Prima di modificare codice:
1. Identifica se il cambiamento appartiene a `frontend/`, `backend/` o `supabase/`.
2. Leggi il `AGENTS.md` piu vicino prima di modificare dentro `frontend/` o `backend/`.
3. Preserva il comportamento runtime finche il task non cambia esplicitamente un contratto o uno step di migrazione.
4. Evita riscritture opportunistiche non richieste.

Regole generali:
- Preferire contratti tipizzati a payload ad-hoc.
- Non hardcodare segreti, credenziali live o endpoint production-only.
- Trattare payload provider e HTML scraped come input non fidato.
- Aggiornare la documentazione quando cambiano API pubbliche, default runtime o assunzioni di rollout.

## Documentazione Production Readiness

Riferimenti canonici:
- `README.md` -> sezione "Where We Are"
- `docs/production_readiness_checklist.md`
- `docs/production_readiness_backlog.md`
- `docs/release_go_live_checklist.md`

Regole documentali:
- Distinguere sempre tra **implementato** e **operativamente provato**.
- Non marcare il sistema come production-ready senza prove su test, rollout, rollback e monitoring.
- Se un documento diverge da codice o workflow, aggiornare il documento in base alla verita del repo.
