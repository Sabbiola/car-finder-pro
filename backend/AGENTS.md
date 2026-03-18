# AGENTS.md - Backend

Questo file contiene istruzioni specifiche per agenti che lavorano nella cartella `backend/`.

Si applica in aggiunta al file `AGENTS.md` presente nella root del repository.
Se c'e conflitto, valgono prima le istruzioni piu vicine alla directory su cui stai lavorando.

---

# 1. Missione del backend

Il backend e il cuore applicativo di CarFinder Pro.

Responsabilita principali:

- esporre API coerenti per i journey dati core
- orchestrare la search multi-provider
- selezionare provider in base a configurazione/capabilities
- normalizzare e deduplicare i listing
- fornire ranking e segnali di analisi
- gestire detail, batch, metadata, favorites, saved searches e alerts
- offrire osservabilita minima e endpoint operativi
- mantenere un boundary chiaro con Supabase e il frontend

Il backend non deve:
- duplicare funzioni frontend
- inglobare l'auth utente se non richiesto
- accoppiare i router ai dettagli dei provider
- diventare una nuova piattaforma generica fuori scope

---

# 2. Boundary architetturale del backend

## Direzione ufficiale
Il backend e FastAPI-first per i journey dati core.

Journey core che devono passare da qui in fastapi mode:
- search
- search stream
- detail
- analysis
- favorites
- saved searches
- listings batch
- alerts

## Cosa non spostare qui senza richiesta esplicita
- auth completa
- session management client-side
- logica Supabase che il progetto ha deciso di tenere diretta

## Ruolo delle edge functions Supabase
Le edge functions esistenti vanno trattate come:
- compatibilita
- proxy
- fallback
- supporto transitorio

Non devono essere reintrodotte come path primari dei journey core gia migrati.

---

# 3. Struttura da rispettare

## `app/api/`
Contiene router HTTP, dependency wiring e minimale orchestration call.

Regole:
- handler sottili
- nessuna business logic grossa
- nessun parsing provider-specifico qui
- validazione request/response tramite modelli espliciti

## `app/core/`
Contiene:
- settings
- registry
- request context
- metrics
- observability
- utility infrastrutturali condivise

Regole:
- qui stanno le fonti canoniche di configurazione runtime
- evitare dipendenze circolari
- evitare di mischiare settings e business logic

## `app/models/`
Contiene i contratti dati canonici:
- request
- response
- provider config
- listing models
- user data models
- alerts models

Regole:
- usare Pydantic
- evitare shape anonime sparse
- ogni endpoint pubblico deve avere modelli chiari

## `app/providers/`
Ogni provider deve vivere nel proprio namespace.

Regole:
- logica provider-specifica confinata qui
- niente branching gigante centralizzato
- parsing, capability e trasformazioni locali
- un provider non deve sporcare altri provider

## `app/services/`
Business logic e orchestration.

Qui devono stare:
- search orchestration
- analysis
- comparables
- alerts processing
- favorites / saved searches business flow
- negotiation/trust/ownership logic

## `app/normalizers/`
Normalizzazione dei listing grezzi in modello canonico.

## `app/dedup/`
Deduplicazione e fingerprinting.

## `app/ranking/`
Scoring, reason codes, ranking helpers.

---

# 4. Invarianti del backend

## 4.1 Route handlers sottili
Ogni route deve:
- validare input
- chiamare il service corretto
- restituire output tipizzato

Non deve:
- contenere logica provider-specifica
- contenere dedup o ranking inline
- costruire manualmente shape non modellate

## 4.2 Provider failures non bloccano la ricerca globale
Il fallimento di un provider deve produrre:
- errori provider-specifici
- partial failure visibility
- completamento della request se possibile

Non deve:
- abbattere l'intera search salvo casi realmente fatali

## 4.3 Modelli canonici
I contratti pubblici devono essere modellati con Pydantic e riutilizzati.
Non creare payload ad hoc direttamente nei router se esiste gia un modello.

## 4.4 Settings sono la fonte di verita runtime
La configurazione backend deve vivere in `app/core/settings.py` e negli env profile ufficiali.

Non introdurre:
- variabili ambiente lette in modo sparso in file casuali
- fallback non documentati
- parsing env incoerente tra file

## 4.5 SSE contract stabile
Per `/api/search/stream` gli eventi canonici restano:
- `progress`
- `result`
- `complete`
- `error`

Non cambiare questa semantica senza aggiornare:
- frontend
- test backend
- eventuale proxy
- docs

---

# 5. Search orchestration

La search e il cuore del prodotto.

## Responsabilita della search orchestration
- validare request
- risolvere provider attivi/configurati
- dispatchare le query ai provider
- raccogliere risultati
- normalizzare
- deduplicare
- arricchire
- ranking / reason codes
- comporre response sync o stream

## Regole
- no accoppiamento forte tra orchestrator e singolo provider
- provider selection centralizzata
- timeouts bounded
- retry bounded
- concorrente ma controllata
- output consistente anche in caso di failure parziali

## SearchRequest
Il contratto va mantenuto coerente e additivo.

Campi rilevanti:
- query di ricerca base
- filtri veicolo
- `is_new`
- `color`
- `doors`
- `emission_class`
- `seller_type`
- compatibilita additiva `private_only`

Se modifichi il contratto:
- aggiorna modelli
- aggiorna test
- aggiorna docs
- aggiorna frontend request builder

---

# 6. Provider architecture

Ogni provider deve:
- avere responsabilita isolate
- dichiarare capabilities in modo coerente
- restituire shape grezza o normalizzabile
- non dipendere da dettagli di altri provider

## Regole provider
- nessun secret hardcodato
- health/configuration state leggibile
- no retry infiniti
- no parsing fragile sparso fuori dal provider
- errori espliciti
- output leggibile per orchestrator

## Provider configured / enabled
La differenza tra:
- presente nel catalogo
- abilitato
- configurato
- healthy

deve restare chiara tramite:
- settings
- registry
- `/api/providers`
- `/api/providers/health`

---

# 7. Favorites, saved searches, alerts

Queste aree esistono per supportare journey reali utente.

## Favorites / Saved searches
Regole:
- contratto chiaro
- error handling coerente
- non mischiare storage path in modo ambiguo
- mantenere coerenza con boundary Auth/Supabase

## Alerts
Gli endpoint canonici:
- `GET /api/alerts`
- `POST /api/alerts`
- `POST /api/alerts/{alert_id}/deactivate`
- `POST /api/alerts/process`

Il flusso alerts deve supportare:
- create
- process
- retry
- audit

Non trattare alerts come solo endpoint presente.
Se lavori su quest'area, pensa anche a operativita e osservabilita.

---

# 8. Analysis / Trust / Negotiation / Ownership

Questi servizi differenziano il prodotto.

Regole:
- devono stare nei services dedicati
- nessuna logica pesante nei router
- output chiaro e degradabile
- il listing puo esistere anche se l'analisi e parziale

## Campi opzionali accettabili
- `deal_score`
- `reason_codes`
- `deal_summary`
- `trust_summary`
- `negotiation_summary`
- `ownership_estimate`

Non rompere il contratto se un campo opzionale non e disponibile.

---

# 9. Observability e ops

Il backend contiene:
- request id
- metrics runtime
- ops endpoints
- eventuali webhook sink
- workflow snapshot/perf

## Regole
- non introdurre metriche scollegate dal prodotto
- non chiamare operativo qualcosa che esiste solo nel codice ma non e configurato
- proteggi endpoint ops quando previsto
- mantieni runbook e docs coerenti col comportamento reale

## Endpoint ops
- `/healthz`
- `/api/ops/metrics`
- `/api/ops/alerts`

Se tocchi questi endpoint:
- verifica auth/token
- verifica shape output
- verifica docs
- non esporre dati sensibili inutilmente

---

# 10. Security backend

Regole non negoziabili:
- niente segreti nel codice
- niente log di token/chiavi
- validation input rigorosa
- timeout bounded
- retry bounded
- CORS coerente con env
- no stack trace grezze nelle response pubbliche
- no accesso diretto a provider esterni senza sanitizzazione minima degli input

Quando tocchi settings/env:
- aggiorna i file `.env*.example`
- mantieni i nomi coerenti
- non introdurre fallback nascosti

---

# 11. Testing backend

Comando minimo:

```bash
pytest -q
```

## Quando aggiungere test

Aggiungi o aggiorna test se tocchi:

- route pubbliche
- settings/env
- provider registry
- provider logic
- normalizers
- dedup/ranking
- SSE
- alerts processor
- analysis services

## Tipi di test importanti

- unit test services
- unit test normalizers/providers
- route contract tests
- SSE contract tests
- settings/env parsing tests
- partial failure tests

## Regola

Il backend deve puntare a suite verde completa.
Non lasciare test rotti temporaneamente se il fix e nello scope del task.

---

# 12. Environment e settings

I file environment example sono parte del contratto operativo del backend.

Profili principali:

- `.env.example`
- `.env.local.example`
- `.env.staging.example`
- `.env.production.example`

Documento canonico:

- `docs/runtime_env_profiles.md`

## Regole

- ogni env usata dal codice deve comparire nel profilo appropriato
- ogni env critica deve essere documentata
- il parsing deve essere robusto e testato
- evita naming ambiguo o duplicato

Attenzione speciale a:

- provider credentials
- timeouts
- concurrency
- fallback/runtime mode
- observability token/webhook
- alert processor settings

---

# 13. Anti-pattern vietati

- leggere env sparse fuori dai settings senza necessita
- business logic nei router
- provider branching gigante in un solo file
- catch-all exception che nascondono errori reali
- restituire payload incoerenti o non tipizzati
- trattare una failure provider come errore globale se non necessario
- cambiare il contratto pubblico senza aggiornare tutto il percorso
- segnare docs come production-ready senza evidenza operativa

---

# 14. Cosa fare quando modifichi il backend

Workflow obbligatorio:

1. analizza router/service/model/provider coinvolti
2. identifica il contratto da mantenere o correggere
3. applica la modifica minima corretta
4. aggiorna test
5. esegui `pytest -q`
6. aggiorna docs/env se il comportamento cambia
7. chiudi con report finale

Output finale atteso:

- mini piano
- file modificati
- cosa cambiato
- test eseguiti
- esito
- rischi residui

---

# 15. Definizione di done per una modifica backend

Una modifica backend e done solo se:

- rispetta il boundary architetturale
- mantiene i contratti pubblici stabili o li aggiorna in modo esplicito
- non aumenta l'accoppiamento tra provider, router e services
- passa i test rilevanti
- aggiorna docs/env se necessario
- porta il backend piu vicino al go-live, non piu vicino a una nuova transizione

---

# 16. Priorita attuali lato backend

Ordine corretto:

1. mantenere test backend completamente verdi
2. consolidare FastAPI-first sui journey core
3. rendere chiara la configurazione dei provider reali
4. rendere alerts e observability operativi davvero
5. consolidare contratti metadata/search/alerts
6. supportare staging soak / canary / rollback
7. solo dopo pensare a espansioni non critiche

Nuove feature non hanno precedenza su questi punti.
