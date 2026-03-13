# CarFinder Pro — Backend AGENTS.md

## Scope

Questo file si applica a tutto il lavoro dentro `backend/` (app FastAPI).

## Missione

Il backend è la source of truth per:
- Esecuzione dei provider e raccolta annunci
- Orchestrazione della ricerca (sync e streaming)
- Normalizzazione dei listing in un contratto unico
- Deduplicazione e ranking
- Analisi avanzata (deal scoring, trust, negoziazione, ownership cost)
- Persistenza snapshot e alert di prezzo

## Struttura directory

```
backend/
├── app/
│   ├── api/              # Route FastAPI (thin handlers)
│   │   ├── search.py     # POST /search, POST /search/stream
│   │   ├── providers.py  # GET /providers, GET /providers/health
│   │   ├── metadata.py   # GET /filters/metadata
│   │   ├── listings.py   # GET /listings/{id}
│   │   ├── analysis.py   # POST /analysis/listing
│   │   ├── ops.py        # GET /ops/metrics, GET /ops/alerts (protetti)
│   │   ├── alerts.py     # POST /alerts/process
│   │   ├── user.py       # Endpoint utente (alert, saved searches)
│   │   └── health.py     # GET /health
│   ├── core/
│   │   ├── settings.py          # Pydantic Settings (env-based, lru_cache)
│   │   ├── provider_registry.py # Registry con stats runtime per provider
│   │   ├── dependencies.py      # FastAPI Depends factories
│   │   ├── metrics.py           # RuntimeMetrics singleton
│   │   ├── observability.py     # log_event + webhook telemetria
│   │   ├── request_context.py   # ContextVar per request_id
│   │   └── domain_metadata.py   # Metadati dominio (marche, modelli, filtri)
│   ├── models/
│   │   ├── search.py            # SearchRequest, SearchResponse, SearchMode
│   │   ├── vehicle.py           # VehicleListing (modello normalizzato)
│   │   ├── analysis.py          # DealSummary, TrustSummary, NegotiationSummary, OwnershipEstimate
│   │   ├── analysis_request.py  # AnalyzeListingRequest
│   │   ├── listing_detail.py    # ListingDetail (extended)
│   │   ├── events.py            # SSE event models
│   │   ├── alerts.py            # AlertRule, AlertDeliveryAttempt
│   │   └── user_data.py         # UserPreferences, SavedSearch
│   ├── providers/
│   │   ├── base/                # BaseProvider ABC + ProviderInfo, ProviderHealth
│   │   ├── autoscout24/         # Parser + Provider
│   │   ├── subito/              # Parser + Provider
│   │   ├── ebay/                # Client + Provider (API eBay Finding)
│   │   ├── automobile/          # Parser + Provider
│   │   ├── brumbrum/            # Parser + Provider
│   │   └── common/              # ScrapingBee client, text_utils
│   ├── services/
│   │   ├── search_orchestrator.py        # Orchestratore concorrente con timeout/retry
│   │   ├── provider_selector.py          # Selezione provider per capabilities
│   │   ├── analysis_service.py           # Coordina deal/trust/negotiation/ownership
│   │   ├── supabase_market_repository.py # Data access (Supabase REST)
│   │   ├── deal_explainer.py             # Scoring e motivazioni deal
│   │   ├── trust_service.py              # Segnali di affidabilità
│   │   ├── negotiation_service.py        # Target price e leve negoziali
│   │   ├── ownership_service.py          # Stima TCO 24 mesi
│   │   ├── comparables_service.py        # Listing comparabili per contesto
│   │   ├── alert_delivery_service.py     # Invio notifiche alert
│   │   └── price_alert_processor.py      # Processamento batch alert prezzo
│   ├── normalizers/
│   │   └── vehicle_normalizer.py  # Normalizzazione campi listing
│   ├── ranking/
│   │   ├── scoring.py       # Calcolo score e ranking
│   │   └── reason_codes.py  # Codici motivazione deal
│   └── dedup/
│       └── deduplicator.py  # Deduplicazione cross-provider
├── tests/                   # pytest suite (44 test)
├── main.py                  # Entry point uvicorn
├── requirements.txt
├── Dockerfile
└── pytest.ini
```

## Regole architetturali

### Separazione responsabilità

Sei layer distinti, ognuno con un compito preciso:

1. **API layer** (`app/api/`) — route handler sottili. MAI logica di orchestrazione nei handler.
2. **Orchestratore** (`search_orchestrator.py`) — gestisce concorrenza, timeout, retry, aggregazione risultati.
3. **Provider** (`app/providers/`) — adapter isolati per ogni fonte. Ogni provider implementa `BaseProvider.search()`.
4. **Normalizzazione** (`vehicle_normalizer.py`) — trasformazione in modello unificato.
5. **Deduplicazione** (`deduplicator.py`) — rimozione duplicati cross-provider.
6. **Ranking** (`scoring.py`) — calcolo score basato su prezzo, km, anno, dealer trust.

### Provider

- Ogni provider è una classe che estende `BaseProvider`.
- Il provider NON fa ranking — restituisce listing normalizzati e basta.
- Il registry (`ProviderRegistry`) tiene traccia di stats runtime: `total_calls`, `successful_calls`, `failed_calls`, `avg_latency_ms`, `error_rate`.
- Provider disabilitabili via env: `DISABLED_PROVIDERS=autoscout24,ebay` (stringa CSV, parsata da `settings.disabled_provider_list`).
- Ogni provider failure viene catturato e restituito in `provider_errors[]`. Non blocca la ricerca.

### Settings

`app/core/settings.py` usa `pydantic-settings` con `lru_cache`:

- `disabled_providers: str` — stringa CSV, accessibile come lista via `@property disabled_provider_list`.
- `ops_token: str | None` — se configurato, protegge `/api/ops/*` con header `X-Ops-Token`.
- `cors_origins: list[str]` — parsato con `field_validator` da stringa CSV.
- `fastapi_proxy_mode` — controlla il runtime ibrido.
- Tutti i segreti (`scrapingbee_api_key`, `ebay_client_id`, `ebay_client_secret`, `supabase_service_role_key`, `ops_token`) solo da env, mai hardcoded.

### Analisi listing

`AnalysisService` coordina cinque sub-servizi:

| Servizio               | Output                    | Scopo                                   |
|------------------------|---------------------------|-----------------------------------------|
| `deal_explainer`       | `DealSummary`             | Score deal, headline, top_reasons       |
| `trust_service`        | `TrustSummary`            | Risk level, flags, seller trust signals |
| `negotiation_service`  | `NegotiationSummary`      | Target price, leve, script suggeriti    |
| `ownership_service`    | `OwnershipEstimate`       | TCO 24 mesi (assicurazione, bollo, etc)|
| `comparables_service`  | Lista comparabili         | Contesto prezzo di mercato              |

`enrich_search_results()` arricchisce in-place con concorrenza limitata (`analysis_max_concurrency`).

Il repository (`SupabaseMarketRepository`) fornisce:
- `seller_stats_key()` — chiave composita per fingerprint venditore.
- `fetch_analysis_snapshot()` / `upsert_analysis_snapshot()` — cache snapshot analisi con TTL.
- `fetch_comparable_rows()` — listing comparabili per contesto pricing.

### Streaming SSE

Il flusso `/api/search/stream` usa `StreamingResponse` con formato SSE:

```
event: progress
data: {"provider": "autoscout24", "status": "searching", "message": "..."}

event: result
data: {"listing": {...}}

event: complete
data: {"total": 42, "providers_ok": ["autoscout24","subito"], "providers_failed": []}
```

### Search modes

`SearchMode = Literal["fast", "full"]`:
- `fast` — limit ridotto per provider (es. 20 risultati eBay), risposta rapida.
- `full` — limit esteso (es. 50), più completo ma più lento.

## Sicurezza

- Nessun segreto nel codice. Tutto da `.env`.
- Endpoint ops protetti con `_verify_ops_token()` dependency.
- Timeout bounded su ogni provider call.
- Retry con backoff esponenziale (`provider_retry_backoff_ms`).
- Request ID propagato via `ContextVar` per tracing.
- URL input sanitizzati prima del fetch.

## Testing

Suite pytest con 44 test:

| File test                  | Cosa testa                                          |
|----------------------------|-----------------------------------------------------|
| `test_api.py`              | Contratti API, status code, payload shape            |
| `test_orchestrator.py`     | Concorrenza, timeout, partial failure                |
| `test_analysis_service.py` | Enrichment, all summaries, fake repository contract  |
| `test_provider_registry.py`| Disabilitazione provider, health, circuit breaker    |
| `test_provider_selector.py`| Selezione provider per capabilities                 |
| `test_provider_urls.py`    | URL generation per ogni provider                     |
| `test_parsers.py`          | Parsing HTML per ogni provider                       |
| `test_ebay_provider.py`    | Client eBay, gestione errori API                     |
| `test_dedup.py`            | Deduplicazione cross-provider                        |
| `test_scoring.py`          | Calcolo score e ranking                              |

**Regola:** il `FakeRepository` nei test deve implementare lo stesso contratto del `SupabaseMarketRepository` reale, incluso `seller_stats_key()`.

## Comandi utili

```bash
# Avvio locale
cd backend && uvicorn app.main:app --reload --port 8000

# Test
cd backend && pytest -v

# Test singolo
cd backend && pytest tests/test_analysis_service.py -v

# Deploy edge functions
npx supabase functions deploy scrape-detail --project-ref $PROJECT_REF
```
