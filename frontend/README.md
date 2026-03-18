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
npm run build
```

## Note architetturali

- runtime config centralizzata in `src/lib/runtimeConfig.ts`
- precedenza runtime esplicita: `localStorage > env > fallback`
- fallback mode di sicurezza: `fastapi` quando `VITE_BACKEND_MODE` manca o e invalida
- in `backendMode=fastapi` i journey core falliscono in modo esplicito se `VITE_API_BASE_URL` manca (no fallback implicito a Supabase)
- code splitting mirato attivo su route principali (`SearchResults`, `CarDetail`, `Confronta`, `Profile`) e su sezioni non-first-render (map view e insights panel)
- metadata filtri avviati in modalita backend-driven (`/api/filters/metadata`)
- cartella `src/features` usata per separare orchestrazione da componenti UI
