# hotwebinar-clone

Monorepo. Next.js 15 + Better Auth + Prisma + Postgres. Deploy Coolify.

## Layout

```
apps/
  web/        Next.js 15 (App Router, TS, Tailwind, shadcn)
  scraper/    Playwright (captura plataforma original)
packages/
  db/         Prisma schema + client
```

## Setup

```bash
pnpm install
cp .env.example .env
# preencher DATABASE_URL + BETTER_AUTH_SECRET + TARGET_*
pnpm db:generate
pnpm db:push
```

## Scraper

```bash
pnpm scrape -- --routes routes.txt
# output: apps/scraper/capture/<timestamp>/
```

## Dev

```bash
pnpm dev
```

## Public routes (sub-plan C)

- `/<slug>` — capture form for a published webinar
- `/<slug>/live` — live-style synchronized HLS player (requires opt-in cookie `hw_lead`)

Reserved slugs (cannot be used as webinar slug): `login`, `dashboard`, `api`, `_next`, `admin`, `signup`, `register`, `static`, `favicon.ico`, `robots.txt`, `sitemap.xml`.

## New env vars (sub-plan C)

- `LEAD_SESSION_SECRET` — HMAC secret for the public lead-session cookie. Min 16 chars; generate with `openssl rand -base64 32`.

## Deploy (Coolify)

1. Conecta repo Git no Coolify
2. App type: Dockerfile (`apps/web/Dockerfile`)
3. Postgres service no mesmo project
4. Env vars do `.env.example`
5. Domain + SSL automatic
