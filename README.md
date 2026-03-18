# CarFinder Pro

CarFinder Pro è una piattaforma di **search intelligence per auto usate**.

Il progetto aggrega annunci da più provider, normalizza i dati, li deduplica, li arricchisce con insight e li presenta all'utente attraverso un'esperienza orientata non solo alla ricerca, ma anche alla **decisione d'acquisto**.

L'idea non è "mostrare più annunci", ma aiutare l'utente a capire:

- quali auto sono realmente interessanti
- quali annunci sono affidabili
- quali prezzi sono coerenti o sospetti
- quali listing meritano una trattativa
- quali rischi e costi ci sono oltre al prezzo iniziale

## Product thesis

> **Find the right car. Know the real deal.**

CarFinder Pro si posiziona come motore di ricerca e supporto decisionale per il mercato dell'usato.

---

# Stato del progetto

Il repository è organizzato come **monorepo** con tre aree principali:

- **frontend** -> applicazione React/Vite per l'esperienza utente
- **backend** -> API FastAPI provider-based per ricerca, dettaglio, analisi e dati utente
- **supabase** -> database, auth, migrations ed edge functions in modalità legacy/proxy/fallback

Il sistema è oggi **FastAPI-first ma ancora hybrid bounded**:

- `Auth` resta **Supabase-direct**
- i journey dati core stanno convergendo su **FastAPI**
- le edge functions Supabase restano presenti per compatibilità, fallback e percorsi ancora in transizione

Questo repository **non deve essere interpretato come "riscrittura completa away from Supabase"**.  
La direzione corretta è:

- mantenere Supabase dove ha senso
- portare search/data journeys core dietro backend API FastAPI
- ridurre gradualmente il peso del fallback legacy
- arrivare a uno stato **go-live ready con evidenza operativa**

---

# Obiettivi del prodotto

## Obiettivi core
- ricerca multi-provider
- filtri coerenti e backend-driven
- listing normalizzati
- deduplicazione
- streaming progressivo dei risultati
- detail page con contenuti più ricchi
- preferiti
- saved searches
- alerts
- insight di analisi su singolo listing

## Obiettivi differenzianti
- deal scoring
- trust / suspicious signals
- negotiation support
- ownership cost insight
- comparables-driven reasoning

---

# Architettura del repository

## Albero ad alto livello

```text
car-finder-pro/
|-- AGENTS.md
|-- README.md
|-- docker-compose.yml
|-- docs/
|   |-- marketplace_catalog.tsv
|   |-- piano_azione_carfinder_pro.md
|   |-- piano_azione_carfinder_pro_sintesi.md
|   |-- production_readiness_backlog.md
|   |-- production_readiness_checklist.md
|   |-- release_go_live_checklist.md
|   |-- runtime_env_profiles.md
|   `-- slo_baseline.md
|-- backend/
|   |-- AGENTS.md
|   |-- Dockerfile
|   |-- README.md
|   |-- requirements.txt
|   |-- pytest.ini
|   |-- main.py
|   `-- app/
|       |-- api/
|       |-- core/
|       |-- dedup/
|       |-- models/
|       |-- normalizers/
|       |-- providers/
|       |-- ranking/
|       `-- services/
|-- frontend/
|   |-- AGENTS.md
|   |-- README.md
|   |-- package.json
|   |-- eslint.config.js
|   |-- vite.config.ts
|   |-- vitest.config.ts
|   |-- playwright.config.ts
|   |-- vercel.json
|   `-- src/
|       |-- components/
|       |-- contexts/
|       |-- features/
|       |-- hooks/
|       |-- integrations/
|       |-- lib/
|       |-- pages/
|       |-- services/
|       |-- test/
|       `-- tests/
`-- supabase/
    |-- config.toml
    |-- functions/
    `-- migrations/
```

---

# Architettura logica

## Frontend

Stack:

* React 18
* TypeScript
* Vite
* Tailwind CSS
* shadcn/ui
* React Query
* React Router
* Vitest
* Playwright

Responsabilità principali:

* raccolta input utente
* routing e rendering delle pagine
* gestione runtime config
* orchestrazione chiamate API
* stato UI per search, detail, compare, favorites, alerts
* presentazione insight lato listing

### Pagine principali

* `/` -> home / entry search
* `/search` -> risultati e streaming
* `/car/:id` -> dettaglio listing
* `/confronta` -> confronto listing
* `/preferiti` -> favorites
* `/profilo` -> profilo utente, saved searches e alert

### Aree chiave del frontend

* `src/components/` -> componenti UI riusabili e layout
* `src/features/` -> funzionalità verticali per search/results
* `src/hooks/` -> hooks applicativi
* `src/lib/` -> utilità, request helpers, runtime config, trasformazioni
* `src/services/api/` -> client API organizzati per dominio
* `src/integrations/supabase/` -> client Supabase e tipi generati

## Backend

Stack:

* Python
* FastAPI
* Pydantic v2
* Pydantic Settings
* httpx
* pytest / pytest-asyncio

Responsabilità principali:

* validazione request
* orchestrazione ricerca multi-provider
* selezione provider
* normalizzazione dati
* deduplicazione
* ranking e reason codes
* detail endpoints
* metadata backend-driven
* dati utente e alerts
* observability di base
* API di ops

### Aree chiave del backend

* `app/api/` -> router HTTP pubblici
* `app/core/` -> settings, registry, request context, metrics, observability
* `app/models/` -> contratti dati
* `app/providers/` -> adapter provider-based
* `app/services/` -> orchestration, comparables, analysis, alerts
* `app/normalizers/` -> normalizzazione payload listing
* `app/dedup/` -> deduplicazione
* `app/ranking/` -> scoring e reason codes

## Supabase

Responsabilità:

* Auth
* database
* migrations
* edge functions
* compatibilità runtime ibrida
* supporto a fallback/proxy durante la transizione

### Funzioni presenti

* `scrape-listings`
* `scrape-detail`
* `ai-search`
* `firecrawl-scrape`
* test/contract shared nel folder `_shared`

---

# Runtime modes

Il sistema supporta una fase di transizione controllata tra architettura legacy e path FastAPI.

## Modalità rilevanti

* `fastapi_only`
* `primary_with_fallback`
* `legacy_only`

## Regola progettuale

Il progetto deve convergere verso:

* **FastAPI come default reale** per i journey dati core
* Supabase diretto per `Auth`
* fallback legacy solo dove esplicitamente supportato e documentato

## Regola di precedence runtime frontend

Il frontend deve leggere la config in questo ordine:

1. `localStorage`
2. variabili env
3. fallback hardcoded di sicurezza

Questo vale per:

* `backendMode`
* `apiBaseUrl`

---

# Journey core

I journey che contano per il go-live sono:

* search sync
* search stream
* detail listing
* compare
* favorites
* saved searches
* alerts
* auth non rotto

Questi journey devono funzionare in `fastapi` mode senza dipendere accidentalmente da fallback legacy.

---

# API principali

## Search

### `POST /api/search`

Ricerca sincrona.

Response prevista:

* `total_results`
* `listings`
* `providers_used`
* `provider_errors`
* `provider_error_details`

### `POST /api/search/stream`

Ricerca streaming via SSE.

Eventi canonici:

* `progress`
* `result`
* `complete`
* `error`

## Metadata e provider

* `GET /api/providers`
* `GET /api/providers/health`
* `GET /api/filters/metadata`

## Listing

* `GET /api/listings/{listing_id}`
* `POST /api/listings/batch`
* `POST /api/analysis/listing`

## User data

* `GET /api/user/favorites`

* `POST /api/user/favorites`

* `DELETE /api/user/favorites/{listing_id}`

* `GET /api/user/saved-searches`

* `POST /api/user/saved-searches`

* `DELETE /api/user/saved-searches/{search_id}`

## Alerts

* `GET /api/alerts`
* `POST /api/alerts`
* `POST /api/alerts/{alert_id}/deactivate`
* `POST /api/alerts/process`

## Ops

* `GET /healthz`
* `GET /api/ops/metrics`
* `GET /api/ops/alerts`

Gli endpoint ops vanno considerati operativi e protetti tramite token quando configurato.

---

# Provider supportati

Il catalogo provider è gestito nel backend con struttura provider-based.

Provider presenti nel repository:

* AutoScout24
* Subito
* eBay
* Automobile
* BrumBrum

## Regole provider

* ogni provider ha confini chiari
* ogni provider deve restituire dati normalizzabili
* il fallimento di un provider non deve bloccare l'intera ricerca
* il frontend deve poter ricevere errori provider-specifici in forma leggibile
* provider non configurati devono risultare visibili come tali

---

# Listing model e normalizzazione

Ogni listing attraversa un processo di normalizzazione.

Campi chiave attesi:

* `provider`
* `market`
* `title`
* `url`
* `price_amount`
* `currency`
* `year`
* `make`
* `model`
* `trim`
* `mileage_value`
* `fuel_type`
* `transmission`
* `images`

Campi di analisi opzionali:

* `deal_score`
* `reason_codes`
* `deal_summary`
* `trust_summary`
* `negotiation_summary`
* `ownership_estimate`

Il frontend non deve assumere che tutti i campi opzionali siano sempre presenti.

---

# Toolchain richiesta

## Frontend

* Node 22
* npm

## Backend

* Python 3.14 target
* virtualenv/venv

## Supabase / Edge

* Supabase CLI
* Deno v2

---

# Setup locale

## Frontend

```bash
cd frontend
npm install
npm run dev
```

Build:

```bash
npm run build
```

Lint:

```bash
npm run lint
npm run lint:strict
```

Test unit/integration:

```bash
npm run test
```

E2E:

```bash
npm run test:e2e
```

## Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Test:

```bash
pytest -q
```

## Docker compose

Per ambienti locali semplificati è disponibile:

```bash
docker compose up --build
```

## Supabase / Edge

Le edge functions e le migration vanno gestite con Supabase CLI e i profili env dedicati.

---

# Profili environment

La strategia environment è profile-based e deve restare coerente tra locale, staging e production.

## Frontend

* `frontend/.env.example`
* `frontend/.env.local.example`
* `frontend/.env.staging.example`
* `frontend/.env.production.example`

## Backend

* `backend/.env.example`
* `backend/.env.local.example`
* `backend/.env.staging.example`
* `backend/.env.production.example`

## Edge / Infra

* `.env.edge.local.example`
* `.env.edge.staging.example`
* `.env.edge.production.example`

## Documento canonico

Il riferimento principale è:

* `docs/runtime_env_profiles.md`

Regola:

* nessun valore sensibile hardcodato
* i profili `.example` devono restare sempre aggiornati al comportamento reale

---

# Testing strategy

## Backend

Framework:

* pytest
* pytest-asyncio

Focus:

* route core
* modelli request/response
* provider selection
* normalizzazione
* dedup
* scoring
* SSE
* partial failures
* alerts processor
* settings / env behavior

## Frontend

Framework:

* Vitest
* Testing Library

Focus:

* runtime config
* search stream
* serializzazione request
* listing detail API
* compare/favorites hooks
* analysis hooks
* reconciler stream/listings
* contratti fastapi mode

## E2E

Framework:

* Playwright

Focus:

* smoke journey core
* search in fastapi mode
* detail
* compare
* favorites
* saved searches
* alerts
* auth non rotto

## Performance

Workflow:

* `perf-load.yml`

Scope atteso:

* `/api/search`
* `/api/search/stream`

---

# CI/CD e workflow

Workflow principali:

* `.github/workflows/ci.yml`
* `.github/workflows/deploy-fastapi.yml`
* `.github/workflows/deploy-functions.yml`
* `.github/workflows/ops-snapshot.yml`
* `.github/workflows/perf-load.yml`
* `.github/workflows/process-alerts.yml`

## Scopo dei workflow

* lint, test e build
* deploy backend FastAPI
* deploy edge functions
* snapshot ops
* load test
* processing alert schedulato

Regola:
i workflow non sono documentazione "aspirazionale"; devono riflettere il comportamento reale del sistema.

---

# Deploy target

## Frontend

Target consigliato:

* Vercel

## Backend

Target consigliato:

* Railway

## Data/Auth

Target:

* Supabase

## Domini

Pattern consigliato:

* `https://app.example.com` -> frontend
* `https://api.example.com` -> backend

---

# Security

Regole non negoziabili:

* nessuna credenziale nel codice
* nessun secret committato
* env example aggiornati ma senza valori reali
* input validati lato backend
* nessun `any` introdotto nel frontend senza motivazione
* CORS stretto per staging/production
* timeout e retry bounded sui provider
* protezione token per endpoint ops quando configurata
* nessun log con segreti o token
* nessun fallback implicito non documentato

---

# Observability, alerts e readiness

L'obiettivo del progetto non è solo "avere codice", ma arrivare a **evidenza operativa reale**.

I documenti di riferimento sono:

* `docs/production_readiness_backlog.md`
* `docs/production_readiness_checklist.md`
* `docs/release_go_live_checklist.md`
* `docs/slo_baseline.md`

## Gate finali attesi

* CI verde
* staging stabile
* FastAPI path verificato
* SLO minimi verificati
* canary provato
* rollback drill provato
* nessun P0 aperto

Fino a quando questi gate non sono chiusi con evidenza, il repository non va descritto come "production-ready" in senso forte.

---

# Regole di sviluppo

## Quando tocchi il frontend

* non introdurre logica di business pesante nelle pagine
* sposta la logica in hook, servizi o feature module
* usa tipi espliciti
* mantieni la precedence runtime config coerente
* non reintrodurre hardcode di env o URL

## Quando tocchi il backend

* route handler sottili
* logica nei services
* parsing provider isolato nei provider
* modelli Pydantic per tutti i contratti pubblici
* nessun accoppiamento inutile tra provider e router

## Quando tocchi Supabase

* non usarlo per bypassare FastAPI sui journey che devono essere FastAPI-first
* documenta chiaramente se una edge function resta fallback, proxy o path attivo
* mantieni compatibili migration e RLS

## Quando tocchi docs/env/workflow

* aggiorna docs se il comportamento cambia davvero
* aggiorna i file `.example`
* non lasciare docs incoerenti con il codice

---

# Non-goals

Questo repository **non** deve:

* diventare un'altra riscrittura completa
* reintrodurre ambiguità tra FastAPI e Supabase
* nascondere fallback impliciti
* vendersi come "production-ready" senza evidenza operativa
* inseguire nuove macro-feature prima di chiudere il go-live path

---

# Stato target

Il target corretto del repository è:

* FastAPI default reale per search/data journeys core
* Supabase usato intenzionalmente dove serve
* observability e alerts operativi davvero
* test e workflow affidabili
* documentazione coerente con il comportamento reale
* closed beta readiness prima del public go-live

---

# License

Definire qui la licenza finale del progetto.

Esempi:

* MIT
* Proprietary
* Custom internal license




