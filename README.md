# Car Finder Pro

Web app per cercare, confrontare e salvare annunci auto usate da piu fonti (AutoScout24, Subito.it, Automobile.it, Brumbrum), con scraping via Supabase Edge Functions.

## Stack

- React 18 + Vite + TypeScript
- Tailwind + shadcn/ui
- Supabase (Postgres + Auth + Edge Functions)
- Vitest + Testing Library

## Requisiti

- Node.js 20+
- npm 10+
- Supabase project configurato

## Setup locale

1. Installa dipendenze:

```bash
npm ci
```

2. Crea `.env` da `.env.example` e compila:

```bash
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
VITE_SUPABASE_PROJECT_ID=...
```

3. Avvia l'app:

```bash
npm run dev
```

## Script utili

```bash
npm run lint
npm run test
npm run build
```

## Edge Functions

Funzioni principali in `supabase/functions/`:

- `scrape-listings`
- `scrape-detail`
- `ai-search`
- `firecrawl-scrape`

### Sicurezza

- JWT verification abilitata (`verify_jwt = true`) su tutte le funzioni.
- CORS con allowlist tramite variabile `ALLOWED_ORIGINS` (lista separata da virgole).

Esempio:

```bash
ALLOWED_ORIGINS=https://your-app.com,https://staging.your-app.com,http://localhost:5173
```

## CI/CD

- `.github/workflows/ci.yml`: lint, test, build frontend + typecheck Edge Functions.
- `.github/workflows/deploy-functions.yml`: deploy delle Edge Functions su `main`.

## Note sicurezza operative

- Non salvare PAT/Git token dentro URL remote Git.
- Se un token e stato committato o salvato in `.git/config`, ruotalo subito.
