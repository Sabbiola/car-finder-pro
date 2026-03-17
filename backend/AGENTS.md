# CarFinder Pro - Backend AGENTS.md

## Scope

Questo file si applica al lavoro dentro `backend/`.

Il backend FastAPI e la source of truth per:
- esecuzione provider
- orchestrazione search sync e stream
- contratti listing normalizzati
- dedup e ranking
- listing analysis
- alerts processing API
- user data API lato backend

## Ruolo Attuale del Backend

Stato reale:
- la search e FastAPI-first
- esistono provider FastAPI per `autoscout24`, `subito`, `ebay`, `automobile` e `brumbrum`
- listing detail, listing analysis, alerts, favorites, saved searches e listings batch sono esposti come API backend
- Supabase resta datastore e auth backend, ma non deve diventare il posto in cui spostare orchestrazione search o logica provider

Non spostare logica provider, ranking o normalizzazione contratti nel frontend.

## Regole Architetturali

Tenere separate le responsabilita:
1. `app/api/` -> route handler FastAPI sottili
2. `app/services/search_orchestrator.py` -> concorrenza, esecuzione provider, aggregazione risultati, emissione SSE
3. `app/providers/` -> fetch e parse specifici per provider
4. `app/normalizers/` -> normalizzazione listing
5. `app/dedup/` -> deduplicazione cross-provider
6. `app/ranking/` -> scoring e reason codes
7. `app/services/analysis_service.py` e servizi correlati -> deal, trust, negotiation, ownership, comparables
8. `app/services/supabase_market_repository.py` -> accesso datastore e basta

I route handler devono restare sottili. I provider adapter non devono possedere policy di ranking o orchestrazione.

## Inventory API Pubbliche

Rotte backend correnti:
- `POST /api/search`
- `POST /api/search/stream`
- `GET /api/providers`
- `GET /api/providers/health`
- `GET /api/filters/metadata`
- `GET /api/metadata/ownership`
- `GET /api/listings/{listing_id}`
- `POST /api/listings/analyze`
- `GET /api/alerts`
- `POST /api/alerts`
- `POST /api/alerts/{alert_id}/deactivate`
- `POST /api/alerts/process`
- `GET /api/user/favorites`
- `POST /api/user/favorites`
- `DELETE /api/user/favorites/{listing_id}`
- `GET /api/user/saved-searches`
- `POST /api/user/saved-searches`
- `DELETE /api/user/saved-searches/{search_id}`
- `POST /api/listings/batch`
- `GET /api/ops/metrics`
- `GET /api/ops/alerts`
- `GET /healthz`

Quando documenti o test citano nomi rotta obsoleti, aggiornarli al contratto reale.

## Regole sul Contratto Search

`SearchRequest v1` e il modello canonico.

Regole:
- validazione request sempre esplicita in modelli Pydantic tipizzati
- preservare la compatibilita additiva di `private_only`
- i filtri estesi correnti includono:
  - `is_new`
  - `color`
  - `doors`
  - `emission_class`
  - `seller_type`
- la semantica di capability provider e strict per i filtri attivi non post-filter
- `provider_error_details` fa parte del contratto pubblico sync e stream
- i nomi evento SSE restano stabili:
  - `progress`
  - `result`
  - `complete`
  - `error`

## Settings e Regole Operative

Le impostazioni operative correnti includono:
- timeout, retry e concorrenza provider
- concorrenza analysis
- webhook di observability
- token e retry policy per alerts processor
- impostazioni Resend
- URL e chiavi Supabase
- `FASTAPI_PROXY_MODE`
- `OPS_TOKEN` opzionale per `/api/ops/*`

Regole:
- segreti solo da env
- chiamate outbound sempre con timeout e retry bounded
- non loggare token o credenziali raw
- preservare request id e errori machine-readable

## Boundary Ibrido

FastAPI possiede il contratto backend, ma il prodotto resta hybrid bounded.

Boundary noto oggi:
- search e search-stream sono FastAPI-first
- alerts processor e user data API vivono in FastAPI
- Supabase Auth resta frontend-direct
- le Edge Functions restano per proxy, fallback e flussi legacy non core

Non documentare il backend come unico runtime del prodotto finche frontend e prove di rollout non confermano la stessa cosa.

## Regole di Test

Aspettative minime backend:
- request validation
- provider selection e strict capability behavior
- normalizzazione e dedup
- ranking e scoring
- shape del contratto sync e stream
- partial provider failure handling
- comportamento listing analysis
- comportamento alerts processor
- comportamento user data API

Se cambi un contratto backend, aggiorna test e documentazione nello stesso change.
