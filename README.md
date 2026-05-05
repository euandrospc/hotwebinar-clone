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

## Wizard redesign (sub-plan D1)

- Steps 1, 2, 3 redesigned to match original Hotwebinar UI.
- 9-step horizontal nav with Lucide icons and connecting progress line (`apps/web/src/components/wizard/wizard-shell.tsx`).
- Step 1 — adds **Acesso facilitado** + **Sincronizar vídeo com início** toggles.
- Step 2 — `TimezoneSelect` (auto-detect via `Intl.DateTimeFormat` + ~20 zones) and `WaitingTemplatePicker` with 5 templates (`DEFAULT`, `WITH_THUMB`, `IMMERSIVE`, `MINIMAL`, `FEATURES`). Public `/[slug]` countdown branches by template.
- Step 3 — full 3-column layout: logo align (left/center/right), customizable progress bar (start %, colors, text token `{percent}`), reorderable + togglable form fields (`name`, `email`, `phone`), and live `LoginPreview` aside.
- Schema migration: `20260505174125_d1_wizard_redesign` (enums `WaitingTemplate`, `LogoAlign`; 10 new `Webinar` columns).

## Deploy (Coolify)

1. Conecta repo Git no Coolify
2. App type: Dockerfile (`apps/web/Dockerfile`)
3. Postgres service no mesmo project
4. Env vars do `.env.example`
5. Domain + SSL automatic
