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
- flusso ricerca con stream SSE + fallback legacy
- metadata filtri avviati in modalita backend-driven (`/api/filters/metadata`)
- cartella `src/features` usata per separare orchestrazione da componenti UI
