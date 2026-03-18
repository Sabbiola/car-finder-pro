# AGENTS.md - Frontend

Questo file contiene istruzioni specifiche per agenti che lavorano nella cartella `frontend/`.

Si applica in aggiunta al file `AGENTS.md` presente nella root del repository.
Se c'e conflitto, valgono prima le istruzioni piu vicine alla directory su cui stai lavorando.

---

# 1. Missione del frontend

Il frontend di CarFinder Pro e l'interfaccia utente del prodotto.

Responsabilita:

- raccogliere input utente per la ricerca
- mostrare risultati, progresso ed errori
- visualizzare detail page, compare, favorites, saved searches e alerts
- consumare le API backend FastAPI nei journey core
- usare Supabase lato client per auth e contesto utente dove previsto
- rispettare il runtime mode configurato senza fallback impliciti casuali

Il frontend non deve:
- duplicare la business logic del backend
- conoscere dettagli interni dei provider
- introdurre logica di orchestrazione search lato client
- bypassare le API backend sui journey core che devono essere FastAPI-first

---

# 2. Boundary ufficiale del frontend

## Auth
`Auth` resta Supabase-direct.

Il frontend puo usare Supabase per:
- sessione
- stato utente
- login/logout
- eventuale contesto auth client-side

## Journey core dati
In `fastapi` mode, questi journey devono usare il backend:

- search
- search stream
- detail
- analysis
- favorites
- saved searches
- listings batch
- alerts

Se trovi un percorso che continua ad andare su Supabase/edge per default senza motivo esplicito, trattalo come un bug o come debito tecnico da documentare.

---

# 3. Struttura da rispettare

## Directory principali

### `src/pages/`
Pagine di routing.
Devono contenere:
- composizione di layout
- wiring di hooks e componenti
- minima orchestrazione di pagina

Non devono contenere:
- parsing payload complesso
- logica business core
- request construction avanzata
- duplicazione di logica gia in `services` o `lib`

### `src/components/`
Componenti UI riusabili, layout, shell e componenti cross-feature.

### `src/features/`
Feature verticali.
Qui vanno:
- componenti strettamente legati a una feature
- hooks locali della feature
- logica di presentazione di una feature

### `src/hooks/`
Hooks condivisi o applicativi, non strettamente confinati a una sola feature.

### `src/lib/`
Utility pure, config runtime, helper di trasformazione, serializzazione request, helper di dominio senza dipendenze UI dirette.

### `src/services/api/`
Client API orientati al dominio.
Qui devono vivere:
- chiamate fetch/http
- adapter di request/response
- gestione errori HTTP a livello service

### `src/integrations/supabase/`
Client Supabase, configurazione integrazione e tipi generati.

### `src/tests/`, `src/test/`
Test unit e integration lato frontend.

---

# 4. Regole di implementazione

## 4.1 Runtime config
La config runtime del frontend e critica.

Fonte canonica:
- `src/lib/runtimeConfig.ts`

Precedence obbligatoria:
1. `localStorage`
2. env
3. fallback

Campi canonici:
- `backendMode`
- `apiBaseUrl`

Regole:
- non introdurre una seconda fonte di verita
- non hardcodare URL backend nei componenti
- non leggere env direttamente nei componenti se il valore e gia astratto nella runtime config
- non introdurre nuovi backend mode senza richiesta esplicita

## 4.2 API usage
Il frontend deve consumare il backend tramite i client in `src/services/api/`.

Non fare:
- `fetch(...)` sparsi nelle pagine se il dominio ha gia un service dedicato
- costruzione manuale duplicata di URL endpoint
- gestione custom incoerente di errori HTTP file-per-file

## 4.3 Supabase usage
Usa Supabase solo dove il boundary lo consente.

Consentito:
- auth
- dati utente dove il contratto del progetto lo prevede ancora direttamente
- integrazione client correlata a sessione/utente

Non consentito:
- usare Supabase per bypassare FastAPI nei journey core "per comodita"
- creare nuovi path dati direct-to-db se il progetto ha gia la relativa API

## 4.4 Stato e hooks
Regole:
- i componenti devono restare il piu possibile presentational
- gli hooks devono contenere la logica di stato, side-effect e integrazione
- non nascondere side-effect importanti in utility pure
- evitare hooks condizionali
- dependency array `useEffect/useMemo/useCallback` devono essere corretti, non "aggiustati per far tacere il lint"

## 4.5 Tipi TypeScript
Regole:
- preferire `type`/`interface` espliciti
- evitare `any`
- usare type import dove possibile
- i tipi API devono riflettere il contratto backend, non ipotesi locali
- il frontend non deve assumere che tutti i campi opzionali di listing analysis siano sempre presenti

---

# 5. Journey principali del frontend

## Search
Include:
- input utente
- costruzione request
- sync mode
- stream mode
- rendering risultati
- gestione progress
- partial failures visibili

Regole:
- il frontend non deve rompere se un provider fallisce
- `provider_error_details` deve poter emergere in modo leggibile
- nessun fallback implicito a provider legacy non documentato

## Detail
Deve consumare l'API detail/listing analysis correttamente e gestire:
- loading
- not found
- incomplete data
- analysis opzionali

## Compare
Deve usare contratti coerenti per batch/detail senza reinventare modelli ad hoc.

## Favorites / Saved Searches / Alerts
Devono usare il path previsto dal progetto e non una miscela non intenzionale di backend e Supabase.

## Auth
Deve restare compatibile con Supabase direct auth.
Non rompere session bootstrap, route protection o contesto utente.

---

# 6. Error handling UI

Ogni journey core deve avere almeno:
- loading state
- empty state
- error state
- partial failure visibility quando applicabile

Regole:
- errori tecnici non devono essere completamente silenziati
- non mostrare stack trace grezze all'utente
- differenziare tra:
  - nessun risultato
  - provider parzialmente falliti
  - errore di request completa
  - configurazione mancante

---

# 7. Regole su performance e bundle

Il bundle frontend e gia significativo.
Quando lavori sul frontend:

- evita di importare moduli pesanti nel first render se non servono
- preferisci lazy loading per pagine o pannelli secondari
- non introdurre librerie nuove senza motivo forte
- non duplicare utility gia esistenti

Code splitting consigliato soprattutto per:
- detail page
- compare page
- pannelli insight/negotiation
- aree non necessarie all'homepage

---

# 8. ESLint / code quality

Il frontend usa una configurazione ESLint rigorosa.

Obiettivo:
- zero errori
- warning ridotti al minimo
- nessun disable globale non motivato

Regole:
- non disabilitare `react-hooks/exhaustive-deps` per comodita
- non disabilitare `react-refresh/only-export-components` globalmente
- se una regola segnala un problema strutturale, correggi la struttura del file
- mantieni i file coerenti con il boundary components/hooks/lib/services

---

# 9. Test frontend

Quando tocchi il frontend, considera questi comandi minimi:

```bash
npm run lint
npm run test
npm run build
```

Se tocchi journey di navigazione o path utente, considera anche:

```bash
npm run test:e2e
```

## Cosa testare

- runtime config
- search fastapi mode
- search stream
- listing detail
- compare
- favorites
- saved searches
- alerts
- partial provider failure
- auth non rotto

## Regola

Se cambi comportamento utente o contratto di una service API, devi adeguare i test.

---

# 10. File critici da trattare con attenzione

## `src/lib/runtimeConfig.ts`

File canonico per modalita backend e base URL.
Ogni modifica qui puo cambiare il routing runtime dell'intera app.

## `src/lib/listingsFastapi.ts` e file simili

Qui si gioca il boundary della migrazione FastAPI.
Non cambiare comportamento senza allineare test e docs.

## `src/services/api/*`

Sono la fonte canonica delle chiamate backend.
Non creare duplicati silenziosi altrove.

## `src/integrations/supabase/*`

Non trattarli come scorciatoie per bypassare il backend.

---

# 11. Anti-pattern vietati

- URL hardcodate nei componenti
- `fetch` diretto nelle pagine quando esiste gia un service
- logica business pesante in JSX
- hooks chiamati condizionalmente
- `any` introdotti senza motivo
- fallback impliciti Supabase/legacy per "far funzionare al volo"
- test aggiornati per adattarsi a bug invece che a comportamento corretto
- import relativi profondi fragili se esistono alias migliori

---

# 12. Definizione di done per una modifica frontend

Una modifica frontend e "done" solo se:

- rispetta il boundary del progetto
- mantiene la runtime config coerente
- non introduce regressioni sui journey core
- passa lint/test/build rilevanti
- aggiorna docs o env example se il comportamento cambia
- rende il frontend piu chiaro, non piu ambiguo

---

# 13. Priorita attuali lato frontend

Ordine corretto:

1. chiudere lint e warning strutturali
2. chiudere test falliti o incoerenze su fastapi mode
3. consolidare runtime config
4. coprire i journey core con test migliori
5. ridurre ambiguita legacy/fallback
6. migliorare bundle e code splitting
7. rifinire UX secondarie

Nuove feature non hanno precedenza su questi punti.
