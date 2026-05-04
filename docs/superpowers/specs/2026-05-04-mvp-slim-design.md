# MVP Slim Design — hotwebinar-clone

**Project:** hotwebinar-clone
**Date:** 2026-05-04
**Status:** Approved (pending user review of written spec)
**Phase:** 2 of N — first deliverable replacing the original platform incrementally
**Predecessor:** [Capture Phase Design](2026-05-03-capture-phase-design.md)

## Goal

Build the smallest production-quality slice of HotWebinar that can replace the existing platform incrementally. The MVP delivers an evergreen-webinar product (recorded video that simulates live) with admin authoring (CRUD webinars + uploads), a public lead-capture player, scripted chat overlays, synchronized CTAs, and a complete analytics dashboard. The release runs on a self-hosted VPS via Coolify.

## Non-goals

- Multi-tenant isolation (no `Company` entity in v1)
- Recurring schedules ("toda seg/qua 20h")
- Evergreen on-demand (lead clicks → video plays from t=0 immediately)
- Custom landing/waiting pages (use built-in default only)
- A/B testing
- External integrations (WhatsApp/Z-API, Cloudflare DNS, Firepay, FB/TikTok Pixel, Tag Manager)
- Chatbot / AI agent
- Roles beyond `admin`
- Inviting other admins
- Custom domain per webinar
- Real-time chat between leads (chat is scripted only)
- Audit log UI
- Billing / plan limits
- WebSocket/SSE; admin polling is enough

These are sequenced into future phases per the user's "replace prod gradually" goal.

## Context

The capture phase produced [REPORT.md](../../../apps/scraper/capture/2026-05-04T04-40-20/analysis/REPORT.md) describing the original React-SPA platform: 32 unique API endpoints, 16 entities, multi-tenant by `Company`, video CDN via Bunny.net + Mux, integrations across WhatsApp/Cloudflare/Firepay/pixels. The original is far larger than the user's brief implied. This MVP picks the smallest slice that delivers webinar value and converts leads.

Modes selected (evidenced in original UI screenshots):

- **Webinar único** — single scheduled event with start/end/timezone. Lead arriving before start sees waiting room, during window joins from t=0, after end sees "encerrado".
- **Just in time** — same start/end window, but video plays in real time. Lead arriving 10 minutes after start sees the video at minute 10. Synchronized to wall clock.

Storage decision: configurable driver. EXTERNAL = paste URL. UPLOAD = stream to S3-compatible (MinIO / Cloudflare R2 / AWS S3). Uploads are transcoded to HLS by a background worker.

## Architecture

Single Next.js App Router monolith for the web layer + a separate worker process for video transcoding + shared Prisma package for DB access. One Postgres, one Redis (BullMQ), S3-compatible object storage. Coolify orchestrates everything.

```
hotwebinar-clone/
├── apps/
│   ├── web/                        Next.js 15 App Router (web container)
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── (auth)/login/                public — admin login
│   │   │   │   ├── dashboard/                   private — admin area
│   │   │   │   │   ├── page.tsx                          KPIs + funil + dispositivos
│   │   │   │   │   ├── webinars/
│   │   │   │   │   │   ├── page.tsx                      list
│   │   │   │   │   │   ├── new/                          wizard 6 steps
│   │   │   │   │   │   └── [id]/
│   │   │   │   │   │       ├── page.tsx                  edit (same wizard)
│   │   │   │   │   │       ├── leads/page.tsx            leads list
│   │   │   │   │   │       └── metrics/page.tsx          analytics
│   │   │   │   │   ├── videos/page.tsx                   library + uploads
│   │   │   │   │   └── settings/page.tsx
│   │   │   │   ├── w/[slug]/                    PUBLIC player
│   │   │   │   │   ├── page.tsx                          waiting / opt-in / ended
│   │   │   │   │   └── play/page.tsx                     authenticated lead → player
│   │   │   │   ├── api/
│   │   │   │   │   ├── auth/[...all]/route.ts            Better Auth handler
│   │   │   │   │   ├── leads/route.ts                    POST opt-in (public)
│   │   │   │   │   ├── events/route.ts                   POST watch/click events (public)
│   │   │   │   │   ├── upload/route.ts                   POST upload (admin)
│   │   │   │   │   ├── videos/route.ts                   GET status polling (admin)
│   │   │   │   │   └── health/route.ts
│   │   │   │   └── layout.tsx
│   │   │   ├── lib/
│   │   │   │   ├── auth.ts                               Better Auth instance
│   │   │   │   ├── auth-client.ts                        client SDK
│   │   │   │   ├── storage/                              driver abstraction
│   │   │   │   │   ├── index.ts                          StorageDriver interface
│   │   │   │   │   ├── external.ts                       URL-only driver
│   │   │   │   │   └── s3.ts                             S3-compat (MinIO/R2/AWS)
│   │   │   │   ├── geo/                                  IP → country (MaxMind GeoLite2)
│   │   │   │   ├── ua/                                   UA → device
│   │   │   │   ├── time.ts                               computeOffset(mode, start, watched, now)
│   │   │   │   ├── rate-limit.ts                         Redis sliding window
│   │   │   │   └── utils.ts
│   │   │   ├── server/
│   │   │   │   └── actions/                              server actions (CRUD)
│   │   │   ├── components/                               shadcn/ui base + custom
│   │   │   ├── styles/globals.css
│   │   │   └── middleware.ts                             session guard /dashboard
│   │   ├── public/
│   │   ├── Dockerfile                                    standalone build
│   │   └── next.config.mjs
│   ├── worker/                     NEW — BullMQ + ffmpeg
│   │   ├── src/
│   │   │   ├── index.ts                                  bootstrap, register processors
│   │   │   └── jobs/
│   │   │       └── transcode-video.ts                    ffmpeg pipeline → HLS
│   │   ├── Dockerfile                                    base node + ffmpeg binary
│   │   └── package.json
│   └── scraper/                    intact from capture phase
└── packages/
    ├── db/                         Prisma schema + client
    │   └── prisma/schema.prisma
    └── jobs/                       NEW — shared queue client
        └── src/
            ├── queue.ts                                  BullMQ Queue setup
            └── types.ts                                  job payload types
```

### Principles

- One web image, one worker image, one DB, one Redis. Coolify project groups all four.
- **Server Actions** for all admin mutations (CRUD webinars, edit chat/CTAs, upload metadata).
- **Route Handlers** for client-initiated public calls (lead opt-in, watch events) and admin polling (video status).
- **RSC** for all admin reads (lists, dashboards, metrics).
- **Better Auth** with email/password, sessions in DB, single super-admin seeded via env.
- **Prisma client** in `packages/db` (workspace), reused by web + worker.
- **BullMQ** in `packages/jobs` (workspace), queue typed payloads.
- **HLS playback** via `hls.js` on the player (Chrome/Firefox don't natively support HLS).

## Data model (Prisma)

```prisma
generator client { provider = "prisma-client-js" }
datasource db    { provider = "postgresql"; url = env("DATABASE_URL") }

// ============ Better Auth ============
model User {
  id            String    @id
  name          String
  email         String    @unique
  emailVerified Boolean   @default(false)
  image         String?
  role          String    @default("admin")
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  sessions      Session[]
  accounts      Account[]
  webinars      Webinar[]
  videos        Video[]
  @@map("user")
}
model Session {
  id        String   @id
  userId    String
  token     String   @unique
  expiresAt DateTime
  ipAddress String?
  userAgent String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@map("session")
}
model Account {
  id                    String    @id
  userId                String
  accountId             String
  providerId            String
  password              String?
  accessToken           String?
  refreshToken          String?
  accessTokenExpiresAt  DateTime?
  refreshTokenExpiresAt DateTime?
  scope                 String?
  idToken               String?
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt
  user                  User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@map("account")
}
model Verification {
  id         String   @id
  identifier String
  value      String
  expiresAt  DateTime
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
  @@map("verification")
}

// ============ Domain ============
enum WebinarMode    { UNICO  JIT }
enum WebinarStatus  { DRAFT  ACTIVE  ARCHIVED }
enum VideoSource    { EXTERNAL  UPLOAD }
enum VideoStatus    { QUEUED  PROCESSING  READY  FAILED }
enum EventKind      { OPTIN  PAGE_VIEW  VIDEO_START  VIDEO_TICK  VIDEO_END  CTA_CLICK  PITCH_REACHED }

model Video {
  id           String      @id @default(cuid())
  ownerId      String
  name         String
  source       VideoSource
  originalUrl  String?
  hlsUrl       String?
  status       VideoStatus @default(QUEUED)
  progress     Int         @default(0)
  durationSec  Int?
  bytes        BigInt?
  errorMessage String?
  createdAt    DateTime    @default(now())
  updatedAt    DateTime    @updatedAt
  owner        User        @relation(fields: [ownerId], references: [id], onDelete: Cascade)
  webinars     Webinar[]
  @@index([ownerId, createdAt])
}

model Webinar {
  id               String         @id @default(cuid())
  ownerId          String
  videoId          String?
  slug             String         @unique
  name             String
  title            String
  language         String         @default("pt-BR")
  status           WebinarStatus  @default(DRAFT)
  mode             WebinarMode
  startDate        DateTime
  endDate          DateTime
  timezone         String         @default("America/Sao_Paulo")
  waitingTitle     String         @default("Sala de Espera")
  waitingSubtitle  String         @default("Estamos prestes a começar")
  logoUrl          String?
  primaryColor     String?
  loginButtonText  String         @default("Entrar")
  loginButtonColor String         @default("#16a34a")
  nameEnabled      Boolean        @default(true)
  nameRequired     Boolean        @default(true)
  emailEnabled     Boolean        @default(true)
  emailRequired    Boolean        @default(true)
  phoneEnabled     Boolean        @default(true)
  phoneRequired    Boolean        @default(false)
  namePlaceholder  String         @default("Seu nome")
  emailPlaceholder String         @default("Seu e-mail")
  phonePlaceholder String         @default("Seu telefone")
  pitchAtSec       Int?
  createdAt        DateTime       @default(now())
  updatedAt        DateTime       @updatedAt
  owner            User           @relation(fields: [ownerId], references: [id], onDelete: Cascade)
  video            Video?         @relation(fields: [videoId], references: [id])
  chatMessages     ChatMessage[]
  ctas             Cta[]
  leads            Lead[]
  events           Event[]
  @@index([ownerId, status])
}

model ChatMessage {
  id         String   @id @default(cuid())
  webinarId  String
  authorName String
  text       String
  showAtSec  Int
  isOwner    Boolean  @default(false)
  webinar    Webinar  @relation(fields: [webinarId], references: [id], onDelete: Cascade)
  @@index([webinarId, showAtSec])
}

model Cta {
  id         String   @id @default(cuid())
  webinarId  String
  label      String
  url        String
  showAtSec  Int
  hideAtSec  Int?
  createdAt  DateTime @default(now())
  webinar    Webinar  @relation(fields: [webinarId], references: [id], onDelete: Cascade)
  @@index([webinarId, showAtSec])
}

model Lead {
  id           String    @id @default(cuid())
  webinarId    String
  name         String
  email        String
  phone        String?
  ip           String?
  userAgent    String?
  device       String?
  country      String?
  watchedSec   Int       @default(0)
  reachedPitch Boolean   @default(false)
  ctaClicks    Int       @default(0)
  sessionStart DateTime  @default(now())
  lastSeenAt   DateTime  @default(now())
  webinar      Webinar   @relation(fields: [webinarId], references: [id], onDelete: Cascade)
  events       Event[]
  @@unique([webinarId, email])
  @@index([webinarId, sessionStart])
}

model Event {
  id        String    @id @default(cuid())
  webinarId String
  leadId    String?
  kind      EventKind
  videoSec  Int?
  ctaId     String?
  metadata  Json?
  createdAt DateTime  @default(now())
  webinar   Webinar   @relation(fields: [webinarId], references: [id], onDelete: Cascade)
  lead      Lead?     @relation(fields: [leadId], references: [id], onDelete: SetNull)
  @@index([webinarId, kind, createdAt])
  @@index([leadId, kind])
}
```

Notes:

- `Lead.email` unique per webinar (returning lead reuses record, max-merges `watchedSec`).
- `Event` is append-only and feeds the funnel. `Lead` carries denormalized counters for fast dashboard reads.
- `pitchAtSec` lets the owner mark the moment that counts as "reached pitch" for the funnel.
- `Video` is many-to-many with `Webinar` (one library video can back several webinars).
- No soft-delete in v1; deletes are hard. Audit trail lives in `Event`.

## Critical flows

### Auth (admin)

```
Seed:    pnpm seed → creates User {email: SEED_ADMIN_EMAIL, password: hash(SEED_ADMIN_PASSWORD)}
Login:   /login → form → Better Auth signIn → cookie session → redirect /dashboard
Guard:   middleware on /dashboard/** → redirect /login if no session
```

Rate limit `/api/auth/sign-in` at 5 fails per IP per minute via Redis sliding window.

### Lead opt-in

```
GET /w/[slug] (RSC):
  fetch Webinar by slug (60s cache).
  switch by clock vs (startDate, endDate):
    now < startDate          → <WaitingRoom countdown=startDate>
    inside window, no cookie → <OptInForm webinar>
    inside window, has lead  → redirect /w/[slug]/play
    now >= endDate           → <Ended>

POST /api/leads {webinarId, name, email, phone, referrer}:
  parse UA → device; geoip(ip) → country.
  upsert Lead by (webinarId, email).
  insert Event {kind: OPTIN, leadId}.
  set httpOnly cookie hw_lead=<leadId>, secure, sameSite=lax, expires=endDate.
  return {leadId, watchedSec, serverNow}.

Browser redirect → /w/[slug]/play (RSC reads cookie, hydrates <Player>).
```

### Player (UNICO and JIT)

```
<Player> client component:
  function computeOffset(mode, startMs, watchedSec, nowMs):
    UNICO: return Math.max(0, watchedSec)
    JIT:   return Math.max(0, (nowMs - startMs) / 1000)

  hls.js.attachMedia(<video>); loadSource(webinar.video.hlsUrl)
  video.currentTime = computeOffset(...)
  video.play()

  No seek control. UNICO: pause/resume allowed. JIT: pause does nothing visible — on resume, recompute offset.

  setInterval 1s:
    sec = video.currentTime
    lead.watchedSec = max(lead.watchedSec, sec)
    reveal chatMessages where showAtSec ≤ sec
    show ctas where showAtSec ≤ sec ≤ (hideAtSec ?? duration)
    if sec ≥ pitchAtSec && !pitchSent:
      POST /api/events {kind: PITCH_REACHED, leadId, videoSec: sec}
      pitchSent = true
    every 10s: POST /api/events {kind: VIDEO_TICK, leadId, videoSec: sec}

  CTA click: POST /api/events {kind: CTA_CLICK, leadId, ctaId, videoSec}
  video onended: POST /api/events {kind: VIDEO_END, leadId, videoSec}

POST /api/events denormalizes:
  PITCH_REACHED → Lead.reachedPitch = true
  VIDEO_TICK    → Lead.watchedSec = max(current, videoSec); lastSeenAt = now()
  CTA_CLICK     → Lead.ctaClicks += 1
```

### Upload + HLS transcode

```
Owner UI uploads → POST /api/upload (multipart):
  storage.upload(stream) → s3 key `originals/<videoId>/raw.mp4`
  insert Video {status: QUEUED, source: UPLOAD, originalUrl: <s3-key>}
  queue.add('transcode-video', {videoId})
  return {videoId}

Worker (apps/worker, separate process):
  on 'transcode-video':
    update Video {status: PROCESSING}
    download `originals/<videoId>/raw.mp4` → /tmp/<videoId>.mp4
    ffprobe → durationSec
    ffmpeg pipeline:
      ladder 360p (800k) + 720p (2500k) + 1080p (5000k) + 1440p (8000k)
      HLS, segment 6s, master.m3u8 + variant playlists + .ts segments
      stderr → progress callback → update Video {progress} every 5%
    upload outputs → `hls/<videoId>/{master,360p,720p,1080p,1440p}.m3u8 + *.ts`
    update Video {status: READY, hlsUrl: <S3 URL>, durationSec, progress: 100}
    rm /tmp/<videoId>.mp4
  on error:
    retry up to 2x with backoff (30s, 5min). After 3 failures:
    update Video {status: FAILED, errorMessage: stderr-tail}

UI polls GET /api/videos every 3s while any video is QUEUED or PROCESSING.
```

External URLs skip transcoding entirely: `Video {status: READY, source: EXTERNAL, originalUrl: <user URL>, hlsUrl: <user URL>}`.

### Funnel dashboard

```
GET /dashboard (RSC), range = querystring (?from&to), default 30d:
  Visitas         = COUNT Event WHERE kind=PAGE_VIEW
  Acessou webinar = COUNT DISTINCT Lead WHERE Event.kind=OPTIN
  Chegou no pitch = COUNT Lead WHERE reachedPitch=true
  Clicou na oferta= COUNT Lead WHERE ctaClicks > 0
  Comprou         = (out of MVP — placeholder "—")

  Tempo médio = AVG(Lead.watchedSec)
  Devices      = COUNT Lead GROUP BY device
  Países       = COUNT Lead GROUP BY country (top 10)
```

Per-webinar metrics page mirrors the same computation scoped by `webinarId` plus a CTA-click heatmap (count of CTA_CLICK events bucketed by `videoSec` of the click).

## UI screens

The admin shell is sidebar + header + content.

```
<AdminShell>
  <Sidebar collapsible>
    <Logo>Hotwebinar</Logo>     // red wordmark
    Dashboard | Webinars | Vídeos | Configurações
    <UserMenu>                  // avatar, logout
  <Header>
    <PageTitle />
    <PeriodPicker />            // URL-driven date range
  </Header>
  {children}
</AdminShell>
```

| Route | Type | Components |
|---|---|---|
| `/login` | RSC + client form | `<LoginForm>` (Better Auth) |
| `/dashboard` | RSC | `<KpiCards>` (4) + `<FunnelChart>` (Recharts) + `<ParticipantsChart>` + `<DevicesDonut>` + `<CountriesTop>` |
| `/dashboard/webinars` | RSC | `<WebinarsTable>` (search, status/type/period filters, row actions: copy public link, edit, metrics, leads, duplicate, delete) + `<NewWebinarButton>` |
| `/dashboard/webinars/new` | client wizard | `<WizardSteps>` (6 steps) + `<StepNav>` |
| `/dashboard/webinars/[id]` | RSC + wizard prefilled | same wizard, edit mode |
| `/dashboard/webinars/[id]/leads` | RSC | `<LeadsTable>` (paginated, filter, CSV export) |
| `/dashboard/webinars/[id]/metrics` | RSC | per-webinar funnel + CTA heatmap + leads list |
| `/dashboard/videos` | RSC + client polling | `<UsageBars>` (storage + bandwidth) + `<VideosTable>` (status badge, progress, actions) + `<UploadButton>` |
| `/dashboard/settings` | RSC + form | brand: account name, default language, default timezone |

### Wizard 6 steps

1. **Início** — name, title, slug (URL friendly), language
2. **Webinar** — mode (Tabs `Único` / `Just in time`), startDate, endDate, timezone, waitingTitle, waitingSubtitle
3. **Login** — logoUrl, primaryColor, login button text/color, name/email/phone enabled/required/placeholders
4. **Vídeo** — Tabs `URL externa` / `Selecionar da biblioteca`. Library uses `<VideoPicker>` filtered to `status: READY`. Field: `pitchAtSec`.
5. **Oferta** — `<CtaTable>` editable rows (label, url, showAtSec, hideAtSec) + add row
6. **Chat** — `<ChatTable>` editable rows (authorName, text, showAtSec) + paste-import (TSV) into table

Draft persisted to `localStorage` while wizard is open. Final submit calls server action `createWebinar` (or `updateWebinar`) inside a transaction (Webinar + ChatMessage[] + Cta[] together).

### Public player

```
<PlayerShell>     // full-screen, brand color from webinar
  if now < startDate:
    <WaitingRoom title subtitle countdownTo=startDate />
  elif !leadCookie:
    <OptInForm webinar />
  elif now >= endDate:
    <Ended />
  else:
    <PlayerView>
      <VideoCanvas />        // <video> + hls.js, currentTime computed
      <ChatOverlay />        // messages reveal by timestamp
      <CtaOverlay />         // CTA visible while sec in (show, hide)
    </PlayerView>
</PlayerShell>
```

`<VideoCanvas>` is a Client Component receiving webinar + lead via props (RSC pre-fetches and passes). Controls hls.js attach, initial seek via `computeOffset`, the 1s tick loop, pause/resume per-mode behavior, and onended.

### shadcn/ui components used
`Button`, `Input`, `Label`, `Form`, `Tabs`, `Dialog`, `DropdownMenu`, `Select`, `Switch`, `Calendar`, `Table`, `Toast` (Sonner), `Progress`, `Card`, `Separator`, `ScrollArea`, `Tooltip`, `Badge`, `Avatar`.

## Error handling and edge cases

### Auth and sessions

- Login failure → toast "Credenciais inválidas". Same message regardless of cause (anti-enumeration).
- Session expiry → middleware redirects `/login?from=<orig>`.
- `/api/auth/sign-in` rate limited at 5 fails per IP per minute (Redis sliding window).
- Admin password hashed by Better Auth (bcrypt). `BETTER_AUTH_SECRET` rotatable.

### Lead opt-in

- Returning lead (same email + webinar) → silent upsert, updates `lastSeenAt`, reuses `watchedSec`.
- Form validation Zod (email format, optional phone E.164, name min 2). Field-level errors.
- Bot/spam: hidden honeypot input + `Origin` header check + `/api/leads` rate limit (10/IP/min).
- Cookie `hw_lead`: httpOnly, sameSite=lax, secure (prod), expires `endDate`.

### Player

- `Video.status != READY` while editing → warning "Vídeo ainda processando, webinar não publicável". Publishing anyway and the public player resolves to "Vídeo indisponível".
- HLS load failure → hls.js error handler → fallback to `<video src=originalUrl>` if EXTERNAL + mp4. Otherwise full-screen error "Erro ao carregar vídeo, recarregue".
- No JS browser → `<noscript>` link to download. Edge case.
- Owner swaps video while live → leads reloading pick up the new one. Acceptable.
- Clock skew: server returns `serverNow` in `/api/leads` response; client uses `serverNow` (not `Date.now()`) as the truth for `computeOffset`. The 1s tick re-syncs drift.
- JIT lead arrives after `endDate` → `<Ended>`. No replay.
- UNICO lead arrives after `endDate` even with prior `watchedSec > 0` → `<Ended>` for everyone.
- Webinar with `status != ACTIVE` → 404 publicly.

### Watch events

- Tick every 10s (not 1s). Reduces API load. `Lead.watchedSec` is monotonic max.
- Network blip → tick fails silently; one retry; then drop. Next tick recovers (max-merge).
- Two tabs same lead → last write wins for `watchedSec`. Both inputs are valid.
- CTA click always recorded, independent of tick.

### Upload + transcode

- Upload > `MAX_UPLOAD_BYTES` env (default 10 GiB) → 413. Stream pre-checks with size header.
- Upload abort → S3 multipart abort cleanup; no job enqueue.
- ffmpeg crash → BullMQ retry 2x with backoff (30 s, 5 min). Three failures → `status: FAILED`, `errorMessage` carries truncated stderr.
- Worker OOM → BullMQ stalled detection re-enqueues. Concurrency = 1 per worker (CPU-bound).
- Orphan job (Video deleted before processing) → worker checks existence, skips silently.
- Mid-pipeline S3 failure → mark FAILED. Partial segments stay (cleanup via cron, future).
- Source < 1440p → ladder skips variants larger than source. ffmpeg never upscales.

### Database

- Migrations: `prisma migrate deploy` runs as a Coolify pre-deploy step.
- Connection pool: web 10, worker 5. Use Prisma's pool or PgBouncer in front if needed later.

### Security

- Server Actions wrap a session check; throw `Unauthorized` without one.
- `/api/leads` and `/api/events` accept only `Origin` matching the configured public host.
- File upload: MIME `video/*` allowlist + magic-bytes verification + filename sanitization.
- Prisma everywhere; no raw SQL.
- Chat text rendered as text (JSX `{message.text}`); no `dangerouslySetInnerHTML`.
- Rate limits via Redis (already a dependency for BullMQ).
- Secrets via Coolify env vars; `.env.local` gitignored.
- HTTPS only in prod; `secure` cookies.

### Observability

- Pino structured logs (web + worker).
- Health check `GET /api/health` returns `{db, redis}` for Coolify probes.
- Sentry optional via `SENTRY_DSN`.
- Worker exposes `/api/admin/queue-stats` (BullMQ stats: jobs/min, failure rate).

## Testing

| Module | Tests |
|---|---|
| `lib/time.ts` | `computeOffset(UNICO, …)` permutations; JIT tracks now-start; floors to 0; clips to endDate |
| `lib/storage/s3.ts` | upload returns URL; presign read; delete; custom endpoint (MinIO/R2) |
| `lib/storage/external.ts` | upload returns URL passed through; idempotent |
| `lib/geo` | IP → country (MaxMind fixture); invalid IP → null |
| `lib/ua` | mobile UA → "mobile"; desktop → "desktop"; bot → null |
| `server/actions/webinar.ts` | `createWebinar` Zod-validated; fails without session; transactional rollback if chat insert fails |
| `server/actions/video.ts` | upload enqueues job; status transitions |
| `app/api/leads/route.ts` | upsert by email; rate limit; honeypot reject |
| `app/api/events/route.ts` | denormalizes `Lead.watchedSec` (max); PITCH_REACHED idempotent |
| `worker/jobs/transcode.ts` | mocked ffmpeg → progress callbacks; 4 variants uploaded; FAILED on error |
| E2E (Playwright) | golden paths: admin login → create webinar → publish; lead opt-in → player tick → CTA click |

Stack: vitest for unit + integration (Postgres test DB via docker compose), Playwright for E2E.

## Deployment (Coolify)

Resources in one Coolify project:

1. **Postgres 16** service. App reads `DATABASE_URL` from Coolify-provided URL.
2. **Redis 7** service. App reads `REDIS_URL`.
3. **MinIO** service (or external R2/S3). Reads `S3_*` env.
4. **Web** application — Dockerfile `apps/web/Dockerfile`, port 3000, domain + SSL.
5. **Worker** application — Dockerfile `apps/worker/Dockerfile`, no port (long-running). Same DB + Redis + S3 envs.

Pre-deploy hook: `pnpm db:generate && pnpm db:migrate:deploy`.
Health check: `GET /api/health` returns 200 when DB + Redis reachable.

## Definition of Done

1. `pnpm seed` creates the super-admin from env. Login works.
2. Admin creates a webinar via the 6-step wizard, saves DRAFT, publishes to ACTIVE.
3. Upload `.mp4` ≤ 2 GiB → job appears QUEUED → PROCESSING (UI progress bar updates) → READY with valid `hlsUrl`.
4. Public URL `/w/<slug>` before `startDate` shows the waiting room with a countdown.
5. Inside the window: opt-in form → submit → player loads → video plays at the correct offset (UNICO from 0; JIT from now-start).
6. Chat messages reveal at their timestamps. CTAs appear in `[show, hide)`. Click is recorded.
7. After `endDate` the page renders `<Ended>`.
8. `/dashboard` shows correct KPIs (visitas, opt-ins, pitch, cliques) and a renderable funnel.
9. `/dashboard/webinars/[id]/leads` lists leads with `watchedSec`, device, country.
10. `/dashboard/webinars/[id]/metrics` shows per-webinar funnel and CTA heatmap.
11. Coolify redeploy stands up web + worker + Redis + Postgres + MinIO; health checks pass.
12. `pnpm -r test` and `pnpm test:e2e` pass golden paths.
13. `pnpm -r typecheck` clean.
14. README documents local setup and Coolify deploy.

## Out of scope (sequenced for future phases)

- Multi-tenant (`Company` entity, all queries scoped by `companyId`)
- Recurring schedules
- Evergreen on-demand mode
- Custom waiting/landing pages
- A/B testing
- External integrations (Z-API WhatsApp, Firepay, Cloudflare DNS, FB/TikTok pixel, Tag Manager)
- Chatbot, AI agent
- Roles beyond admin; invite flows
- Custom domains per webinar
- Advanced analytics (real-time, country drill-down, video heatmap)
- Billing / plan limits
- Audit log UI
- Real chat between leads (WebSockets)
