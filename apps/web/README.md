# web

Next.js 15 admin + public webinar app.

## Setup

```bash
pnpm install
pnpm exec playwright install chromium  # one-time, needed for E2E
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

E2E expects an admin seeded with the email/password defaults declared in `playwright.config.ts` (`admin@example.com` / `test-password-min-12`). If you seeded with different creds, override via `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD` env vars or re-seed to match.

## Known issues

- **Windows + OneDrive `pnpm build` symlink failure.** `next build` with `output: "standalone"` may fail with `EPERM: operation not permitted, symlink` when the repo lives under OneDrive. Use `pnpm dev` for local development; production builds happen inside the Coolify Docker container (Linux), where this is not an issue. Workarounds: enable Windows Developer Mode, run terminal as Administrator, or move the repo out of OneDrive.

## Sub-plans

This package is built incrementally. Sub-plan A (Foundation) ships login + empty dashboard. See `docs/superpowers/plans/2026-05-04-mvp-A-foundation.md`.
