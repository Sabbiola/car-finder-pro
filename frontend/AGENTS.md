# CarFinder Pro - Frontend AGENTS.md

## Scope

Questo file si applica al lavoro dentro `frontend/`.

Il frontend e responsabile di:
- esperienza di ricerca e visualizzazione risultati
- UX del lifecycle stream
- UX del listing detail
- UX di favorites, saved searches, compare, recently viewed e price alerts
- selezione runtime tra percorsi FastAPI e percorsi Supabase-backed

## Verita sul Runtime

La runtime config e definita in `src/lib/runtimeConfig.ts`.

Comportamento corrente:
- `backendMode` supporta `supabase | fastapi`
- `apiBaseUrl` e opzionale
- la precedenza e:
  - override localStorage
  - env vars
  - fallback default
- se `VITE_BACKEND_MODE` manca o non e valido, l'app va in fallback su `supabase`

Non hardcodare URL backend in pagine, hook o moduli feature.

## Boundary Ibrido Corrente

In modalita FastAPI il frontend usa il backend per:
- search e search stream
- filter metadata
- listing detail
- listing analysis
- alerts API
- favorites API
- saved searches API
- listings batch API

Supabase resta diretto per:
- Auth via `AuthContext`

Comportamento di fallback:
- quando `backendMode != "fastapi"` o `apiBaseUrl` manca, alcuni flussi continuano a usare Supabase o local storage
- non rimuovere questi branch finche il task non chiude esplicitamente il boundary ibrido

## Regole Architetturali

Tenere chiare le responsabilita:
- le pagine orchestrano hook e componenti
- i componenti renderizzano stato e interazioni
- le chiamate API vivono in `src/services/api/` o `src/lib/api/`
- le decisioni di runtime arrivano da `runtimeConfig.ts`
- la persistenza locale resta in hook dedicati

Non duplicare parsing o mapping contrattuali tra componenti. Estrarre la logica condivisa in helper tipizzati.

## Regole UX Search

La search deve restare allineata ai contratti backend.

Regole:
- usare comportamento capability-driven basato su metadata
- rispettare la semantica strict delle capability provider
- mantenere lo stream allineato agli eventi SSE stabili:
  - `progress`
  - `result`
  - `complete`
  - `error`
- mantenere sync e stream allineati a `SearchRequest v1`
- i filtri estesi correnti includono:
  - `is_new`
  - `color`
  - `doors`
  - `emission_class`
  - `seller_type`

Se cambia il contratto backend, aggiornare insieme request building, gestione stato UI e test.

## Regole UX e Stato

- Preferire client API tipizzati a `fetch` inline.
- Rendere espliciti gli error state per partial provider failures e unsupported filters.
- Auth resta Supabase-direct finche l'architettura non cambia.
- Compare, favorites, saved searches e alerts devono rispettare la runtime mode invece di assumere un solo backend.

## Regole di Test

Aspettative minime frontend:
- serializzazione request e comportamento runtime config
- gestione stato search stream
- gestione capability filter
- fetch path di detail e analysis
- comportamento favorites e saved searches per runtime mode
- comportamento UI alerts

Se cambi boundary runtime o payload pubblici, aggiorna test e documentazione nello stesso change.
