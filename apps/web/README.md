# web

Next.js 15 admin + public webinar app.

## Setup

```bash
pnpm install
docker run -d --name hotwebinar-pg -e POSTGRES_USER=hotwebinar -e POSTGRES_PASSWORD=hotwebinar -e POSTGRES_DB=hotwebinar -p 5432:5432 postgres:16-alpine
cp ../../.env.example ../../.env.local
# Edit .env.local — set DATABASE_URL, BETTER_AUTH_SECRET, SEED_ADMIN_*

pnpm db:migrate:dev
pnpm seed
pnpm dev
```

Open http://localhost:3000/login.

## Tests

```bash
pnpm --filter web test         # unit + integration (vitest)
pnpm --filter web test:e2e     # Playwright smoke
pnpm --filter web typecheck
```

## Sub-plans

This package is built incrementally. Sub-plan A (Foundation) ships login + empty dashboard. See `docs/superpowers/plans/2026-05-04-mvp-A-foundation.md`.
