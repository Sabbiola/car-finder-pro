# Frontend

Frontend React + TypeScript + Vite di CarFinder Pro.

## Avvio locale

```bash
npm install
npm run dev
```

## Comandi utili

```bash
npm run lint
npm run test
npm run test:e2e
npm run test:e2e:staging-smoke
npm run build
```

## Playwright lanes

Lane locale/stub (CI veloce, backend locale con `TEST_STUB_MODE=true`):

```bash
npm run test:e2e:stub
```

Lane staging smoke (frontend staging + backend reale, nessun backend locale avviato da Playwright):

```bash
PLAYWRIGHT_STAGING_FRONTEND_URL="https://<frontend-staging-url>" npm run test:e2e:staging-smoke
```

Variabili supportate per la lane staging smoke:

- `PLAYWRIGHT_STAGING_FRONTEND_URL` (obbligatoria): base URL frontend staging.
- `PLAYWRIGHT_STAGING_SEARCH_PATH` (opzionale): path/query iniziale per la smoke search.
  - default: `/risultati?brand=BMW&model=320d&sources=autoscout24,subito`

## Security Headers e Service Worker

Header CSP in `vercel.json`:
- `script-src` ora e limitato a `'self'` (rimosso `unsafe-inline` e `unsafe-eval`).
- restano eccezioni intenzionali:
  - `style-src 'unsafe-inline'` per style inline usati dalla UI React/Tailwind.
  - `img-src https: data: blob:` per immagini listing da provider esterni e immagini generate localmente.
  - `connect-src` su FastAPI production/staging (`https://api.carfinderpro.app`, `https://api-staging.carfinderpro.app`) e Supabase HTTPS/WSS per auth/realtime.

Service worker (`public/sw.js`):
- naming cache allineato a `carfinder-pro`.
- versioning esplicito via `SW_CACHE_VERSION` per busting/rollback governabile.
- cleanup cache legacy supportato (`autodeal-*`, `carfinder-pro-v*`).

## Note architetturali

- runtime config centralizzata in `src/lib/runtimeConfig.ts`
- precedenza runtime esplicita: `localStorage > env > fallback`
- fallback mode di sicurezza: `fastapi` quando `VITE_BACKEND_MODE` manca o e invalida
- in `backendMode=fastapi` i journey core falliscono in modo esplicito se `VITE_API_BASE_URL` manca (no fallback implicito a Supabase)
- code splitting mirato attivo su route principali (`SearchResults`, `CarDetail`, `Confronta`, `Profile`) e su sezioni non-first-render (map view e insights panel)
- metadata filtri avviati in modalita backend-driven (`/api/filters/metadata`)
- cartella `src/features` usata per separare orchestrazione da componenti UI
