# CarFinder Pro — Root AGENTS.md

## Progetto

CarFinder Pro è un motore di ricerca e supporto alla decisione per auto usate.
Aggrega annunci da più provider (AutoScout24, Subito, eBay, Automobile.it, BrumBrum),
li normalizza, li deduplica, li classifica e li presenta con insight di analisi
(deal scoring, trust, negoziazione, ownership cost).

## Architettura monorepo

```
car-finder-pro/
├── frontend/          # React 18 + TypeScript + Vite + Tailwind + shadcn/ui
├── backend/           # FastAPI + Pydantic + httpx (provider-based)
├── supabase/          # Edge Functions (Deno) — fallback/proxy + migrations
├── docs/              # Piano d'azione, checklist, SLO, profili env
└── docker-compose.yml # Orchestrazione locale
```

### Runtime ibrido

Il sistema opera in tre modalità configurabili via `FASTAPI_PROXY_MODE`:

| Modalità                  | Comportamento                                      |
|---------------------------|-----------------------------------------------------|
| `fastapi_only`            | Solo backend FastAPI                                |
| `primary_with_fallback`   | FastAPI primario, edge functions come fallback       |
| `legacy_only`             | Solo Supabase Edge Functions (compatibilità)         |

Il frontend decide il path tramite `backendMode` in `runtimeConfig.ts`.

## Contratti API condivisi

### Streaming SSE

Tutti i flussi di ricerca (sync e stream) usano quattro eventi stabili:

| Evento     | Payload                                      |
|------------|----------------------------------------------|
| `progress` | `{ provider, status, message }`              |
| `result`   | `{ listing: VehicleListing }`                |
| `complete` | `{ total, providers_ok, providers_failed }`  |
| `error`    | `{ code, message, provider? }`               |

I nomi e la struttura di questi eventi NON devono cambiare senza aggiornare
contemporaneamente backend, frontend e edge functions.

### Modello listing normalizzato

Ogni listing attraversa `VehicleNormalizer` e contiene almeno:
`provider`, `market`, `title`, `url`, `price_amount`, `year`, `make`, `model`,
`mileage_value`, `fuel_type`, `transmission`, `images[]`.

Campi opzionali di analisi: `deal_summary`, `trust_summary`,
`negotiation_summary`, `ownership_estimate`, `listing_hash`.

## Linee guida di sviluppo

### Principi generali

1. **Cambiamenti piccoli e sicuri** — preferire diff minimali, non riscritture massive.
2. **Contratti tipizzati** — ogni endpoint e ogni modello ha un tipo Pydantic (backend) o TypeScript (frontend). Mai `any` o `dict` generico senza motivo.
3. **Single responsibility** — route handler sottili, logica nel service layer, provider isolati.
4. **Fail gracefully** — il fallimento di un singolo provider non deve bloccare la ricerca. Errori restituiti in `provider_errors[]`.
5. **Nessun segreto nel codice** — credenziali solo via env vars. Il campo `ops_token` in settings protegge gli endpoint operativi.

### Sicurezza

- Credenziali (`SCRAPINGBEE_API_KEY`, `EBAY_CLIENT_ID/SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `OPS_TOKEN`) solo in `.env`, mai committate.
- Input utente sempre validato (Pydantic lato backend, Zod/TypeScript lato frontend).
- Timeout e retry bounded su ogni provider (`provider_timeout_seconds`, `provider_retry_attempts`).
- URL sanitizzati prima di passarli a ScrapingBee o httpx.
- Endpoint `/api/ops/*` protetti con header `X-Ops-Token` (opzionale, attivo se `OPS_TOKEN` è configurato).

### Testing

| Layer       | Framework       | Focus                                                    |
|-------------|-----------------|----------------------------------------------------------|
| Backend     | pytest + asyncio | Validazione request, provider selection, normalizzazione, dedup, scoring, SSE, partial failure |
| Frontend    | vitest + RTL     | Hook di streaming, runtime config, serializzazione form, sorting/filter, state transitions |
| E2E         | Playwright       | Flusso search-stream completo                            |
| Edge Fn     | Deno test        | Contratto proxy                                          |

**Regola:** ogni PR deve mantenere la test suite verde (44 backend, 0 ESLint errors frontend).

### Convenzioni codice

- Python: type hints su tutto, `ruff` per formatting, nomi snake_case.
- TypeScript: strict mode, nomi camelCase per variabili/funzioni, PascalCase per componenti/tipi.
- Commit: conventional commits (`feat:`, `fix:`, `refactor:`, `docs:`, `test:`).
- Branch: `feature/xxx`, `fix/xxx`, `refactor/xxx`.

## Endpoint principali

| Metodo | Path                        | Descrizione                          |
|--------|-----------------------------|--------------------------------------|
| POST   | `/api/search`               | Ricerca sincrona                     |
| POST   | `/api/search/stream`        | Ricerca streaming SSE                |
| GET    | `/api/providers`            | Catalogo provider                    |
| GET    | `/api/providers/health`     | Health check provider                |
| GET    | `/api/filters/metadata`     | Metadati filtri (capabilities, union)|
| GET    | `/api/listings/{id}`        | Dettaglio singolo listing            |
| POST   | `/api/analysis/listing`     | Analisi on-demand di un listing      |
| GET    | `/api/ops/metrics`          | Metriche runtime (protetto)          |
| GET    | `/api/ops/alerts`           | Alert operativi (protetto)           |

## Pagine frontend

| Route           | Componente       | Scopo                                    |
|-----------------|------------------|------------------------------------------|
| `/`             | Index            | Home con SearchFilters                   |
| `/search`       | SearchResults    | Risultati con streaming, skeleton, chips |
| `/car/:id`      | CarDetail        | Dettaglio con lightbox, insights, SEO    |
| `/confronta`    | Confronta        | Comparazione side-by-side                |
| `/preferiti`    | Preferiti        | Listing salvati                          |
| `/profilo`      | Profile          | Profilo utente, ricerche salvate, alert  |
