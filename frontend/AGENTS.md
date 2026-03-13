# CarFinder Pro — Frontend AGENTS.md

## Scope

Questo file si applica a tutto il lavoro dentro `frontend/` (app React).

## Missione

Il frontend aiuta l'utente a decidere su un'auto usata rispondendo a quattro domande:

1. **Questo annuncio è interessante?** → Deal scoring, prezzo vs mercato.
2. **Perché è interessante?** → Top reasons, confronto comparabili.
3. **Quali sono i rischi?** → Trust signals, flags, seller history.
4. **Cosa devo fare dopo?** → Target price, leve di negoziazione, TCO stimato.

## Stack tecnologico

| Tecnologia              | Versione | Uso                                    |
|-------------------------|----------|----------------------------------------|
| React                   | 18.3     | UI framework                           |
| TypeScript              | 5.8      | Type safety                            |
| Vite                    | 5.4      | Build tool                             |
| Tailwind CSS            | 3.x      | Utility-first styling                  |
| shadcn/ui (Radix)       | —        | Componenti UI base                     |
| React Router            | 6.30     | Routing                                |
| @tanstack/react-query   | —        | Server state (disponibile, da integrare)|
| Supabase.js             | 2.97     | Auth, realtime                         |
| Leaflet + react-leaflet | —        | Mappa risultati                        |
| recharts                | 2.15     | Grafici                                |
| Zod                     | 3.25     | Validazione schema                     |
| vitest + RTL            | 3.2      | Unit/component testing                 |
| Playwright              | —        | E2E testing                            |

## Struttura directory

```
frontend/src/
├── pages/                    # Route pages (thin, delegano a hook/componenti)
│   ├── Index.tsx             # Home con SearchFilters
│   ├── SearchResults.tsx     # Risultati streaming + skeleton + filter chips
│   ├── CarDetail.tsx         # Dettaglio con lightbox, SEO, JSON-LD
│   ├── Confronta.tsx         # Comparazione side-by-side (2-4 auto)
│   ├── Preferiti.tsx         # Listing salvati (localStorage)
│   ├── Profile.tsx           # Profilo, ricerche salvate, alert prezzo
│   └── NotFound.tsx          # 404
├── features/
│   ├── search/
│   │   ├── hooks/
│   │   │   ├── useSearchStream.ts    # Hook streaming SSE
│   │   │   └── useFilterMetadata.ts  # Metadata filtri dal backend
│   │   └── types.ts                  # Tipi ricerca frontend
│   └── results/
│       ├── components/
│       │   ├── ListingResultCard.tsx      # Card risultato arricchita
│       │   ├── ListingInsightsPanel.tsx   # Pannello insight deal
│       │   ├── WhyThisCarPanel.tsx        # "Perché questa auto"
│       │   └── NegotiationDrawer.tsx      # Drawer negoziazione
│       └── hooks/
│           └── useListingAnalysis.ts      # Hook analisi listing
├── components/               # Componenti riutilizzabili
│   ├── SearchFilters.tsx     # Form filtri con validazione min<=max
│   ├── CarCard.tsx           # Card listing base
│   ├── CarCardSkeleton.tsx   # Skeleton loading pulse
│   ├── ActiveFilterChips.tsx # Chip filtri attivi rimovibili
│   ├── Header.tsx            # Header con navigazione
│   ├── CompareBar.tsx        # Barra confronto sticky
│   ├── CompareButton.tsx     # Toggle confronto su card
│   ├── FavoriteButton.tsx    # Toggle preferito
│   ├── PriceAlertButton.tsx  # Creazione alert prezzo
│   ├── SaveSearchDialog.tsx  # Dialog salva ricerca
│   ├── LoanCalculator.tsx    # Calcolatore rata
│   ├── ListingsMap.tsx       # Mappa Leaflet risultati
│   ├── ApiConfigBanner.tsx   # Config runtime (solo DEV)
│   ├── AuthModal.tsx         # Login/signup Supabase
│   ├── ErrorBoundary.tsx     # Error boundary globale
│   └── ui/                   # shadcn/ui components
├── hooks/                    # Hook generici
│   ├── useCompare.tsx        # Context + hook confronto (CompareProvider)
│   ├── useFavorites.ts       # Preferiti (localStorage)
│   ├── useRecentlyViewed.ts  # Visti di recente (localStorage)
│   └── useSavedSearches.ts   # Ricerche salvate
├── contexts/
│   └── AuthContext.tsx        # Supabase Auth context
├── lib/
│   ├── runtimeConfig.ts      # Config runtime centralizzata
│   ├── api/
│   │   ├── listings.ts       # buildFastApiRequest, fetchListings, tipi
│   │   └── fetchByIds.ts     # Fetch listing per ID (Confronta, Preferiti)
│   ├── constants.ts          # FALLBACK_IMAGE, PAGE_SIZE, MAX_COMPARE, etc.
│   ├── toCardListing.ts      # Trasformazione API → CardListing
│   ├── rating-config.ts      # Configurazione rating prezzo
│   ├── requestId.ts          # Generazione request ID
│   ├── mock-data.ts          # Dati mock per sviluppo
│   └── utils.ts              # Utility generiche (cn, etc.)
├── services/api/             # Client API per features
│   ├── searchStream.ts       # Client streaming ricerca
│   ├── listingDetail.ts      # Client dettaglio listing
│   ├── listingAnalysis.ts    # Client analisi on-demand
│   ├── metadata.ts           # Client metadata filtri
│   ├── alerts.ts             # Client alert prezzo
│   └── userData.ts           # Client dati utente
├── integrations/supabase/
│   ├── client.ts             # Supabase client singleton
│   └── types.ts              # Tipi database generati
└── tests/                    # Test suite vitest
```

## Regole architetturali

### Runtime config

**Regola fondamentale:** NESSUN URL backend hardcoded nel codice delle feature.

`runtimeConfig.ts` è l'unico punto di verità per:
- `backendMode`: `"supabase"` | `"fastapi"`
- `apiBaseUrl`: URL del backend FastAPI

Ordine di precedenza: `localStorage` override > variabili d'ambiente > default.

`ApiConfigBanner.tsx` (visibile solo in DEV) usa le stesse funzioni `setRuntimeBackendMode` / `setRuntimeApiBaseUrl`.

### Componenti e pagine

- **Pagine sottili** — la pagina orchestra hook e componenti, non contiene logica di business.
- **Componenti puri** — i componenti presentazionali ricevono dati via props, non fetch.
- **Logica di dominio fuori dal JSX** — trasformazioni, calcoli e parsing in utility/hook dedicati.
- **Nessuna duplicazione di parsing** — se due componenti hanno bisogno della stessa trasformazione, estrarre in `lib/` o `hooks/`.

### Stato

- **Server state** separato da **UI state**.
- Hook dedicati per streaming search (`useSearchStream`), non stato globale.
- Preferiti, confronto, visti di recente: `localStorage` con hook dedicati.
- Le dependency array degli `useEffect` usano variabili primitive stabili (es. `idsKey = ids.join(",")`) invece di espressioni complesse inline.

### Flusso ricerca (streaming)

```
1. Utente compila filtri → validazione (min <= max)
2. buildFastApiRequest(filters, { mode }) → payload tipizzato
3. POST /api/search/stream → SSE connection
4. useSearchStream consuma eventi:
   - progress → aggiorna stato provider
   - result  → merge incrementale nei risultati
   - complete → chiudi stream, mostra stats
   - error   → mostra errore parziale o totale
5. UI: skeleton → risultati progressivi → stato finale
```

### SEO

- `react-helmet-async` per meta tag dinamici su ogni pagina.
- JSON-LD `Product` schema su `CarDetail` (prezzo, immagine, marca, modello).
- `robots.txt` e `manifest.json` in `public/`.

### UX patterns

| Pattern             | Componente          | Comportamento                            |
|---------------------|---------------------|------------------------------------------|
| Skeleton loading    | `CarCardSkeleton`   | 8 placeholder pulse durante caricamento  |
| Filter chips        | `ActiveFilterChips` | Badge viola rimovibili + "Cancella tutto"|
| Lightbox            | `yet-another-react-lightbox` | Zoom fullscreen su gallery      |
| Compare bar         | `CompareBar`        | Sticky bar con max 4 auto selezionate    |
| Error boundary      | `ErrorBoundary`     | Catch errori React, fallback UI          |

## Sicurezza

- Nessuna credenziale nel frontend. Solo `SUPABASE_ANON_KEY` (public by design).
- Auth via Supabase (`signInWithOAuth`, `signInWithPassword`).
- Redirect URL per OAuth configurato nel dashboard Supabase (non in codice).
- `vercel.json` con security headers: CSP, X-Frame-Options, X-Content-Type-Options.

## Testing

Suite vitest:

| File test                              | Cosa testa                                    |
|----------------------------------------|-----------------------------------------------|
| `toCardListing.test.ts`               | Trasformazione API → CardListing (10 test)    |
| `useSearchStream.test.tsx`            | Hook streaming, eventi, stato (3 test)        |
| `useCompare.test.ts`                  | CompareProvider, add/remove, max items        |
| `useFavorites.test.ts`                | Toggle, persistenza localStorage              |
| `runtimeConfig.test.ts`               | Risoluzione config, precedenze                |
| `fastapiSearchRequestContract.test.ts`| Serializzazione form → payload API            |
| `listingDetailApi.test.ts`            | Client dettaglio listing                      |
| `listingsFastapiMode.test.ts`         | Comportamento in modalità FastAPI             |
| `listingsStreamReconciliation.test.ts`| Riconciliazione risultati streaming           |
| `WhyThisCarPanel.test.tsx`            | Rendering pannello insight                    |
| `useListingAnalysis.test.tsx`         | Hook analisi listing                          |

**Regola ESLint:** 0 errori richiesti. I warning `react-refresh/only-export-components` su file shadcn/ui sono accettati.

## Build e bundle

```bash
# Dev
cd frontend && npm run dev

# Build
cd frontend && npx vite build

# Lint
cd frontend && npx eslint src/

# Type check
cd frontend && npx tsc --noEmit

# Test
cd frontend && npx vitest run
```

Il bundle attuale è ~1.5 MB minificato. Code splitting consigliato per:
- `CarDetail` (dettaglio + lightbox)
- `Confronta` (comparazione + analisi)
- `NegotiationDrawer` / pannelli analisi

## Convenzioni

- Componenti: PascalCase, un componente per file, export default.
- Hook: `use` prefix, camelCase.
- Tipi: in file dedicato o co-locati nel modulo.
- Stili: solo Tailwind utility classes, no CSS custom (tranne `index.css` per tema).
- Import path: alias `@/` mappato a `src/`.
