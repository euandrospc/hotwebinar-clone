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

## Offer (sub-plan D2)

- Step 5 redesigned to match original Hotwebinar single-Offer UI. Multi-CTA model dropped.
- Webinar adds 15 offer columns + 5 lead UTM columns + 3 webhook flag columns (`webhookOnOfferView`, `webhookOnOfferClick`, `webhookOnRaffleEntry`).
- EventKind values `CTA_VIEW`/`CTA_CLICK` renamed in-place to `OFFER_VIEW`/`OFFER_CLICK`. New value `RAFFLE_ENTRY`.
- WebhookEvent gains `lead_entrou_sorteio`.
- Image upload via `/api/upload/offer-image` (presigned PUT, MIME `image/jpeg|png|webp`, 2 MiB cap, key `offer/<webinarId>/<kind>.<ext>`).
- UTMs captured at opt-in (`utm_source/medium/campaign/term/content`) and re-appended at offer click when `offerPassUtms=true`.
- Schema migration: `20260505180000_d2_offer_rebuild`.

## Chat + Vendas (sub-plan D3)

- Step 6 (Chat) redesigned: 2-column layout, accordion 3 sections (AI stub / file XLSX / individual editor), search-filterable preview aside with always-editable rows + per-row delete + bulk delete + Export XLSX + "Testar no player".
- Step 7 (Vendas) — new: same layout. Schema `Hora | Minuto | Segundo | Nome do comprador | Produto | Preço`. Persists to new `SaleNotification` table.
- Player `/[slug]/live`: avisos de compra aparecem dentro do chat quando a reprodução cruza `showAtSec`, uma vez por aviso/sessão.
- AI generation buttons present but disabled (`disabled={true}` + tooltip "Em breve") in both steps; reserved for a future sub-plan.
- Schema migration: `20260505220000_d3_sales_notifications`.

## Audiência + GeoIP (sub-plan D4)

- Step 8 (Audiência) — new sub-plan: 3 modos (NONE / FIXED / DYNAMIC), min/max participantes, switch "AO VIVO" badge, prévia da curva (Recharts).
- Player `/[slug]/live` header: `<AudienceBadge>` mostra `🔴 AO VIVO · 1.234 assistindo` quando `audienceMode != NONE`. Counter determinístico via hash(`webinarId:leadId`); DYNAMIC tick 5 s.
- Lead enrichment: opt-in dispara `enrichLeadGeo(leadId, ip)` (fire-and-forget) — busca city/region/lat/lng via ipapi.co. Falha silenciosa em IP privado / rede / rate-limit.
- Schema migration: `20260505230000_d4_audience_and_geo` — enum `AudienceMode`, 4 cols Webinar (`audienceMode/Min/Max/LiveBadge`), 4 cols Lead (`city/region/lat/lng`).
- Mapa de leads = futuro D5.

## Mapa de Leads (sub-plan D5)

- Nova rota `/dashboard/webinars/[id]/leads-map` exibe mapa Leaflet (OpenStreetMap tiles) com pins individuais até 500 leads, cluster (`react-leaflet-cluster`) acima.
- Sidebar mostra total + geo count + top 5 países (com flag emoji) + top 5 cidades + leads sem geo.
- Mapa lazy-loaded via `next/dynamic({ ssr: false })` (Leaflet usa `window`).
- Tabs `<WebinarTabs>` adicionadas em `/leads`, `/leads-map`, `/metrics`, `/webhooks` — Editor / Leads / Mapa / Métricas / Webhooks.
- Sem schema novo — consome `Lead.city/region/country/lat/lng` populados em D4.

## Deploy (Coolify)

1. Conecta repo Git no Coolify
2. App type: Dockerfile (`apps/web/Dockerfile`)
3. Postgres service no mesmo project
4. Env vars do `.env.example`
5. Domain + SSL automatic

## Chat e presença em tempo real

- `apps/web/server.ts` inicia Next.js e Socket.IO na mesma porta. Use `pnpm dev -- --port 3010` (ou `pnpm --filter web dev --port 3010`) e `pnpm --filter web start` em produção. Iniciar com `next start` diretamente não inicia o WebSocket.
- O navegador usa WebSocket em `/socket.io/`. Cookies autenticam a conexão e as permissões são revalidadas a cada30s. Cada lead recebe somente sua conversa; atendimento mantém o acesso global de admin/atendente já existente. Métricas usam canais restritos ao proprietário.
- Mensagens são persistidas por HTTP no PostgreSQL antes de serem publicadas. `clientMessageId` permite repetir um envio sem duplicar a mensagem. Ao reconectar, os chats recuperam o histórico; uma reconciliação a cada60s cobre eventual evento perdido. Se o WebSocket/Redis estiver indisponível, os chats consultam a cada4s.
- Redis compartilha eventos entre instâncias e presença entre conexões. O player sinaliza reprodução logo no primeiro avanço, renova a cada15s e remove sua conexão ao pausar/sair; leases expiram em45s se a conexão desaparecer. Duas abas do mesmo lead contam uma pessoa. Os ticks históricos de30s continuam preservados; players antigos usam presençaHTTP.
- A aba **Tempo real** recebe mudanças por WebSocket e atualiza mapa/dispositivos juntos. **Métricas** continua mostrando resultados do período. Pessoas sem geolocalização continuam no total; audiência simulada nunca entra no painel administrativo.

Infra local:

```bash
docker compose up -d redis
# .env: REDIS_URL=redis://127.0.0.1:6382
pnpm db:migrate:deploy
pnpm db:generate
pnpm --filter web dev --port 3010
```

No Coolify, configure `REDIS_URL` para um Redis privado dedicado e mantenha o encaminhamento de WebSocket no mesmo domínio/porta da aplicação. A migration `20261030200500_chat_message_idempotency` é aditiva e preserva as mensagens existentes. Sem Redis, a aplicação permanece disponível com atualização periódica.

Os testes Redis são opt-in e usam prefixo separado do ambiente de desenvolvimento:

```bash
REALTIME_REDIS_TEST_URL=redis://127.0.0.1:6382 pnpm --filter web test src/test/lib/realtime-presence.test.ts src/test/lib/realtime-bus.test.ts src/test/lib/realtime-gateway.test.ts
```

## Testes locais

A suíte Vitest web usa exclusivamente o banco `hotwebinar_test` em
`localhost:5452`, separado do banco de desenvolvimento. Os testes limpam tabelas.
A configuração fica em `apps/web/vitest.config.ts`.

Preparação inicial (PostgreSQL local já em execução):

```bash
docker exec hotwebinar-pg createdb -U hotwebinar hotwebinar_test
DATABASE_URL="postgresql://hotwebinar:hotwebinar@localhost:5452/hotwebinar_test?schema=public" pnpm db:migrate:deploy
pnpm db:generate
pnpm --filter scraper exec playwright install chromium
```

Reaplique as migrations nesse banco após mudanças de schema. Para validar:

```bash
pnpm test
pnpm typecheck
```

O comando `pnpm test` executa as suítes Vitest web e scraper; E2E tem comando e
configuração próprios (`pnpm test:e2e`).
