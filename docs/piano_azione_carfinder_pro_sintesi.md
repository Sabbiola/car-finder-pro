# Piano Azione CarFinder Pro (Sintesi Operativa)

Documento sintetico basato su `docs/piano_azione_carfinder_pro.md` per uso esecutivo nel repository.

## Obiettivo
Portare CarFinder Pro da MVP aggregatore a piattaforma decisionale multi-provider con backend modulare, contratti stabili e UX trasparente.

## Priorita
1. Sistemare base architetturale (config runtime, separazione responsabilita, contratti tipizzati).
2. Introdurre provider architecture backend (registry, orchestratore, moduli provider).
3. Esporre API prodotto (`/api/providers`, `/api/providers/health`, `/api/filters/metadata`).
4. Rafforzare dedup/ranking e test coverage.
5. Espandere provider in modo API-first, con scraping solo dove necessario.

## Step esecutivi
1. Frontend
- centralizzare runtime config backend
- evitare hardcode URL/count/timing
- preparare hook/servizi per stream SSE

2. Backend
- separare API, orchestrazione, provider, normalizzazione, dedup, ranking
- mantenere eventi SSE stabili: `progress`, `result`, `complete`, `error`
- gestire failure parziali senza interrompere la ricerca globale

3. Governance
- usare `AGENTS.md` root e nested (`frontend/AGENTS.md`, `backend/AGENTS.md`)
- mantenere allineamento tra stato reale backend e copy UI

## Criteri di completamento
- contratti API tipizzati e coerenti frontend/backend
- nessuna credenziale hardcodata
- timeout/retry bounded su provider esterni
- test minimi su validazione, orchestrazione e stream event shape

