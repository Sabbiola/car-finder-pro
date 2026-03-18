# AGENTS.md - CarFinder Pro

Questo file contiene le istruzioni operative permanenti per agenti di coding, Codex e assistenti che lavorano sul repository.

L'obiettivo non è generare codice "creativo", ma **mantenere il progetto coerente, verificabile e pronto al go-live**.

---

# 1. Missione del repository

CarFinder Pro è una piattaforma di **search + decision intelligence per auto usate**.

Il repository serve a:

- aggregare listing da più provider
- normalizzare e deduplicare i dati
- esporre API coerenti per search, detail, analysis e user data
- offrire un frontend React orientato ai journey utente core
- mantenere un runtime ibrido controllato durante la transizione FastAPI-first
- portare il progetto a uno stato **go-live ready con evidenza operativa**

---

# 2. Regole non negoziabili

## 2.1 Non riscrivere l'architettura
Non introdurre una nuova architettura globale.
Non spostare il progetto verso una nuova piattaforma o framework.
Non riscrivere il boundary tra FastAPI e Supabase.

## 2.2 Mantieni il boundary ufficiale
Boundary canonico:
- `Auth` = Supabase-direct
- journey dati core = backend FastAPI in `fastapi` mode
- edge functions = compatibilità / proxy / fallback dove previsto

## 2.3 Nessuna macro-feature fuori roadmap
Non introdurre nuove macro-feature se non richieste esplicitamente.
Priorità assoluta:
- stabilità
- contratti
- test
- env
- docs
- readiness

## 2.4 Fail-safe prima di clever
Preferire:
- modifiche piccole
- codice esplicito
- contratti chiari
- verifiche pratiche

Evitare:
- astrazioni premature
- layer nuovi non necessari
- "fix" che spostano il problema senza chiarirlo

## 2.5 Nessun segreto nel codice
Mai hardcodare:
- API keys
- tokens
- service role keys
- webhook URLs sensibili
- secret di deploy

Tutto deve vivere in env vars o sistemi segreti esterni.

---

# 3. Come lavorare su questo repo

## Workflow obbligatorio
Prima di modificare:
1. analizza la struttura della cartella coinvolta
2. identifica i file toccati
3. verifica i contratti già esistenti
4. fai un piano piccolo e concreto
5. implementa
6. esegui test/lint/build rilevanti
7. aggiorna docs/env se il comportamento cambia
8. chiudi con report finale

## Output atteso da un agente
Ogni task deve chiudersi con:
- mini piano
- file modificati
- cosa è stato cambiato
- test/lint/build eseguiti
- esito
- rischi residui / follow-up

## Cosa non fare
- non fare commit
- non creare branch
- non fare push
- non cambiare naming o struttura senza motivo forte
- non aggiornare docs in modo ottimistico se il codice non supporta ancora quel comportamento

---

# 4. Mappa del repository

## Root
Contiene:
- documentazione principale
- workflow CI/CD
- profili env edge
- docker compose
- documenti readiness

## `frontend/`
Applicazione utente React/Vite.

Responsabilità:
- search UX
- detail UX
- compare
- favorites
- profile
- alerts UI
- runtime config
- integrazione Supabase lato client
- consumo backend FastAPI

## `backend/`
API provider-based FastAPI.

Responsabilità:
- search sync/stream
- providers
- metadata
- listing detail
- analysis
- user data APIs
- alerts
- ops endpoints
- orchestration, scoring, dedup, normalizzazione

## `supabase/`
Contiene:
- config Supabase
- edge functions
- migrations
- test/contract condivisi lato proxy

## `docs/`
Contiene:
- piano d'azione
- backlog readiness
- checklist produzione
- checklist go-live
- SLO baseline
- profili env

---

# 5. Invarianti architetturali

Queste regole devono restare vere.

## 5.1 Frontend runtime config
La precedence è:

1. `localStorage`
2. env
3. fallback

Valida per:
- `backendMode`
- `apiBaseUrl`

Non introdurre un nuovo sistema parallelo di config.

## 5.2 FastAPI-first per i journey core
In `fastapi` mode, questi journey devono passare per backend API:
- search
- detail
- analysis
- favorites
- saved searches
- listings batch
- alerts

## 5.3 Auth resta Supabase-direct
Non spostare l'auth nel backend senza richiesta esplicita.
Non introdurre proxy auth inutili.

## 5.4 Provider boundary
Ogni provider deve:
- vivere nel suo namespace
- avere parsing/local logic isolata
- non sporcare router o orchestrator con branching inutile
- fallire senza bloccare l'intera ricerca

## 5.5 Route handlers sottili
Backend:
- router = validazione + orchestration call + response
- logica di business = services
- shape dei payload = models

## 5.6 Il frontend non deve conoscere dettagli interni del backend
Il frontend usa:
- client API
- tipi applicativi
- metadata
- error contract pubblici

Non deve dipendere da struttura interna dei provider.

---

# 6. Contratti canonici

## 6.1 Search sync
Endpoint:
- `POST /api/search`

Il contratto deve restare stabile e tipizzato.

## 6.2 Search stream
Endpoint:
- `POST /api/search/stream`

Eventi canonici:
- `progress`
- `result`
- `complete`
- `error`

Non cambiare i nomi o la semantica degli eventi senza aggiornare:
- backend
- frontend
- eventuale proxy edge
- test
- docs

## 6.3 Metadata
Endpoint:
- `GET /api/filters/metadata`

Deve restare la fonte canonica dei metadata backend-driven.

## 6.4 Provider catalog
Endpoint:
- `GET /api/providers`
- `GET /api/providers/health`

Deve comunicare chiaramente:
- provider disponibili
- provider configurati
- provider abilitati/disabilitati
- health

## 6.5 Alerts
API canoniche:
- `GET /api/alerts`
- `POST /api/alerts`
- `POST /api/alerts/{alert_id}/deactivate`
- `POST /api/alerts/process`

## 6.6 Runtime config frontend
Campi canonici:
- `backendMode`
- `apiBaseUrl`

Non cambiare il loro significato senza aggiornare tutto il percorso.

---

# 7. Regole specifiche frontend

## 7.1 Struttura
Usa la struttura corrente:
- `components/`
- `features/`
- `hooks/`
- `lib/`
- `services/api/`
- `pages/`

## 7.2 Dove mettere cosa
### `pages/`
Solo orchestrazione di pagina e layout ad alto livello.

### `components/`
Componenti UI riusabili o cross-feature.

### `features/`
Logica verticale di una feature, compresi hook e componenti associati.

### `hooks/`
Hooks cross-feature o di stato locale applicativo.

### `lib/`
Utility pure, config runtime, trasformazioni, helper tecnici.

### `services/api/`
Client HTTP/API per dominio funzionale.

## 7.3 Regole di codice frontend
- no `any` senza motivo documentato
- hooks solo in posti validi
- niente side effect nascosti in utilità
- niente logica di business grossa dentro i componenti pagina
- niente URL hardcodate
- niente bypass casuali del runtime config
- niente import circolari

## 7.4 Gestione errori UI
Ogni journey core deve avere almeno:
- loading state
- empty state
- error state
- partial failure visibility quando applicabile

## 7.5 Testing frontend
Quando tocchi frontend, valuta sempre:
- `npm run lint`
- `npm run test`
- `npm run build`

Se tocchi journey o routing, considera anche Playwright.

---

# 8. Regole specifiche backend

## 8.1 Struttura
Usa la struttura esistente:
- `api/`
- `core/`
- `models/`
- `providers/`
- `services/`
- `normalizers/`
- `dedup/`
- `ranking/`

## 8.2 Dove mettere cosa
### `api/`
Solo router e dipendenze HTTP.

### `core/`
Settings, request context, metrics, registry, wiring.

### `models/`
Contratti pubblici e modelli interni stabili.

### `providers/`
Codice provider-specifico e parser.

### `services/`
Business logic e orchestration.

### `normalizers/`
Normalizzazione di listing e payload grezzi.

### `dedup/`
Regole e servizi di deduplicazione.

### `ranking/`
Scoring, reason codes, ranking helpers.

## 8.3 Regole di codice backend
- type hints su tutto
- route handlers sottili
- Pydantic per input/output pubblici
- error handling esplicito
- provider failure non blocca la request globale
- nessun branching provider-heavy dentro i router
- no valori sensibili hardcodati
- timeout e retry bounded

## 8.4 Testing backend
Quando tocchi backend, esegui almeno:
- `pytest -q`

Se tocchi:
- settings/env -> aggiungi test settings
- provider logic -> aggiungi test provider/normalizer
- SSE -> verifica contratti stream
- alerts -> testa create/process/retry se applicabile

---

# 9. Regole specifiche Supabase / Edge

## 9.1 Non reintrodurre edge-first per i journey core
Se una route è già FastAPI-first, non rimetterla indirettamente su edge function per comodità.

## 9.2 Quando toccare edge functions
Toccale solo se:
- sono ancora parte del boundary supportato
- servono a compatibilità/fallback/proxy
- c'è un task specifico su di esse

## 9.3 Migration e RLS
Se tocchi migrations:
- non rompere dati esistenti
- documenta il perché
- verifica che auth/favorites/saved searches/alerts restino coerenti

---

# 10. Regole environment e configurazione

## 10.1 I file `.example` sono parte del prodotto
Ogni volta che cambia un env consumato dal codice:
- aggiorna il relativo `.env*.example`
- aggiorna `docs/runtime_env_profiles.md` se necessario

## 10.2 Nessuna configurazione ombra
Non introdurre:
- nuovi env con naming ambiguo
- fallback non documentati
- doppia fonte di verità non necessaria

## 10.3 Settings backend
I settings in `backend/app/core/settings.py` sono la fonte canonica dei parametri runtime backend.

---

# 11. Sicurezza

## Regole
- mai loggare segreti
- mai esporre token nel frontend
- mai committare credenziali
- validare tutto l'input utente
- proteggere gli endpoint ops con `X-Ops-Token` se configurato
- mantenere CORS restrittivo in staging/production
- non esporre dettagli interni provider al client se non necessari

## Quando lavori su provider esterni
- mantieni timeout chiari
- non introdurre retry infiniti
- non costruire URL non sanitizzate
- rispetta il contratto corrente di error handling

---

# 12. Observability e readiness

Il repository contiene già:
- metrics runtime
- ops endpoints
- alert workflows
- perf workflow
- readiness docs

Regola fondamentale:
**non considerare il progetto production-ready solo perché il codice esiste.**

Serve evidenza reale:
- test verdi
- staging stabile
- provider reali verificati
- alerts verificati
- perf e soak dimostrati
- rollback documentato e provato

Quando tocchi questa area:
- aggiorna runbook o checklist se necessario
- non sovrastimare lo stato di readiness nei docs

---

# 13. Cosa evitare assolutamente

- refactor globale non richiesto
- nuova architettura "più pulita" ma fuori roadmap
- sostituire FastAPI/Supabase senza task esplicito
- rinominare API pubbliche senza motivo forte
- introdurre `any` o payload non tipizzati
- aggiungere feature non critiche prima di chiudere il go-live path
- nascondere problemi reali dietro doc ottimistiche

---

# 14. Come chiudere un task bene

Ogni task deve finire con:
1. mini piano
2. file modificati
3. modifica effettuata
4. test/lint/build eseguiti
5. risultato
6. rischi residui
7. eventuali follow-up

Se una parte non può essere verificata:
- dichiaralo esplicitamente
- prepara codice/docs/env per quella verifica
- non dire che è "pronto" se non lo è

---

# 15. Definizione di done per questo repo

Una modifica è "done" solo se:
- è coerente con l'architettura attuale
- mantiene i contratti stabili
- non introduce debito strutturale inutile
- aggiorna docs/env se il comportamento cambia
- passa i controlli rilevanti
- lascia il repository più vicino, non più lontano, al go-live

---

# 16. Priorità del momento

Priorità corrente del progetto:
1. hardening frontend
2. coerenza FastAPI-first sui journey core
3. provider/config smoke reale
4. alerts/observability operativi
5. E2E journey core
6. staging soak / canary / rollback
7. closed beta readiness

Queste priorità hanno precedenza su nuove feature.

---

# 17. Regola finale

Se sei in dubbio tra:
- fare qualcosa di "elegante"
- fare qualcosa di coerente con il progetto, testabile e sicuro

scegli sempre la seconda.



