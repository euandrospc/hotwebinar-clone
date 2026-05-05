# MVP Sub-plan C — Lead Opt-in + Public Player Design

**Date:** 2026-05-04
**Branch:** `feat/capture-phase`
**Depends on:** A (Foundation) ✅, B1 (Admin CRUD) ✅, B2 (Video pipeline) ✅
**Sub-plan series:** A → B1 → B2 → **C (this)** → E (Analytics) → F (Coolify deploy)

## Goal

Ship the public-facing webinar experience: capture page (`/<slug>`) → live-style synchronized player (`/<slug>/live`) with HLS playback, scripted chat replay, synchronized CTAs, lead capture, anti-cheat tracking, and configurable webhooks per webinar with delivery log + manual replay.

## Architecture

```
Browser (público)
  ├─ /<slug>           captura form (RSC + Server Action)
  └─ /<slug>/live      player (RSC shell + Client componentes)
       ├─ HlsPlayer (hls.js + <video> + custom controls — no scrubber/speed)
       ├─ ChatPanel (passado batch + futuro drip + lead-input persistido)
       ├─ CtaBanner (full-width abaixo do vídeo, sincronizado por currentTime)
       └─ Tracker (POST /api/track 30s + visibility/unload beacon)

Server (Next.js + Prisma)
  ├─ Public Server Actions: submitOptin, submitLeadChat
  ├─ Public API routes: /api/track, /api/cta-click, /api/cta-view,
  │                     /api/track-leave, /api/lead-chat
  ├─ Lead Session: cookie httpOnly assinado HMAC (LEAD_SESSION_SECRET)
  └─ Webhook enqueue: server-side helper → packages/jobs Queue("webhook")

Worker (apps/worker — extends B2)
  ├─ Existing: transcode-video, delete-video-assets
  └─ NEW: dispatch-webhook (BullMQ retry 3x exp 30s)

Schema additions
  ├─ LeadChatMessage table
  ├─ WebhookDelivery table
  ├─ EventKind.CTA_VIEW
  └─ Webinar gains webhookUrl + 7 trigger flags + permanenceThresholdSec
  └─ Lead gains: enterFired, pitchFired, permanenceFired, leaveFired (dedupe flags)
```

## Routing decisions

- `/<slug>` (capture) and `/<slug>/live` (player). Matches the original platform's root namespace.
- **Reserved slug blacklist** (zod refinement on slug schema + check at `publishWebinar`):
  - `login`, `dashboard`, `api`, `_next`, `admin`, `signup`, `register`, `static`, `favicon.ico`, `robots.txt`, `sitemap.xml`
- Wizard step 6 (slug input) and the `slug` zod schema both reject reserved values with message `"Slug reservado, escolha outro"`.

## Schema changes

```prisma
// EXTEND
enum EventKind {
  OPTIN
  PAGE_VIEW
  VIDEO_START
  VIDEO_TICK
  VIDEO_END
  CTA_VIEW       // NEW
  CTA_CLICK
  PITCH_REACHED
}

// EXTEND Webinar
model Webinar {
  // ... existing fields preserved

  webhookUrl                  String?
  webhookOnOptin              Boolean  @default(false)
  webhookOnEnter              Boolean  @default(false)
  webhookOnCtaView            Boolean  @default(false)
  webhookOnCtaClick           Boolean  @default(false)
  webhookOnPitchReached       Boolean  @default(false)
  webhookOnPermanence         Boolean  @default(false)
  webhookOnLeave              Boolean  @default(false)
  permanenceThresholdSec      Int      @default(300)

  leadChatMessages            LeadChatMessage[]
  webhookDeliveries           WebhookDelivery[]
}

// EXTEND Lead — webhook dedupe flags
model Lead {
  // ... existing fields preserved
  enterFired            Boolean  @default(false)
  pitchFired            Boolean  @default(false)
  permanenceFired       Boolean  @default(false)
  leaveFired            Boolean  @default(false)
  leadChatMessages      LeadChatMessage[]
  webhookDeliveries     WebhookDelivery[]
}

// NEW
model LeadChatMessage {
  id         String   @id @default(cuid())
  leadId     String
  webinarId  String
  text       String
  videoSec   Int?
  createdAt  DateTime @default(now())
  lead       Lead     @relation(fields: [leadId], references: [id], onDelete: Cascade)
  webinar    Webinar  @relation(fields: [webinarId], references: [id], onDelete: Cascade)
  @@index([leadId, createdAt])
  @@map("lead_chat_message")
}

enum WebhookDeliveryStatus {
  PENDING
  SUCCESS
  FAILED
}

// NEW
model WebhookDelivery {
  id              String                @id @default(cuid())
  webinarId       String
  leadId          String?
  event           String                // "lead_novo" | "lead_acessou" | "lead_viu_oferta" | "lead_clicou_oferta" | "lead_viu_pitch" | "lead_permaneceu" | "lead_saiu"
  url             String
  payload         Json
  attempt         Int                   @default(0)
  status          WebhookDeliveryStatus @default(PENDING)
  responseStatus  Int?
  responseBody    String?               // truncated 1024
  errorMessage    String?
  createdAt       DateTime              @default(now())
  updatedAt       DateTime              @updatedAt
  webinar         Webinar               @relation(fields: [webinarId], references: [id], onDelete: Cascade)
  lead            Lead?                 @relation(fields: [leadId], references: [id], onDelete: SetNull)
  @@index([webinarId, status, createdAt])
  @@map("webhook_delivery")
}

// NEW dedupe table for CTA_VIEW per (leadId, ctaId)
model CtaView {
  id        String   @id @default(cuid())
  leadId    String
  ctaId     String
  createdAt DateTime @default(now())
  @@unique([leadId, ctaId])
  @@index([ctaId])
  @@map("cta_view")
}
```

Single migration `c_lead_player_webhook` adds enum value, new tables, new columns.

## Capture page `/<slug>`

**Server (RSC):**

```ts
// apps/web/src/app/[slug]/page.tsx
export default async function CapturePage({ params }) {
  const { slug } = await params;
  if (RESERVED_SLUGS.has(slug)) notFound();
  const w = await prisma.webinar.findUnique({ where: { slug } });
  if (!w || w.status !== "ACTIVE") notFound();
  const phase = computePhase(w, new Date()); // "before" | "open" | "closed"
  if (phase === "closed" && w.mode === "UNICO") return <ClosedView w={w} />;
  return <CaptureForm w={publicWebinarDto(w)} />;
}
```

**Client `<CaptureForm>`:**
- React Hook Form + Zod
- Campos render condicional: `nameEnabled/Required`, `emailEnabled/Required`, `phoneEnabled/Required`
- Phone via `react-phone-number-input` (libphonenumber-js, default country BR, `international` style)
- Branding: `logoUrl`, `primaryColor`, `loginButtonText`, `loginButtonColor`
- Submit → server action `submitOptin(slug, formData)` → redirect `/<slug>/live`

**Server action `submitOptin`:**
```ts
"use server";
export async function submitOptin(slug: string, raw: FormData) {
  // 1. Fetch webinar fresh (ACTIVE status check, validates flags)
  // 2. Build dynamic zod schema based on webinar flags
  // 3. Validate input
  // 4. Rate-limit by IP (5/min, in-memory Map MVP)
  // 5. Upsert Lead by [webinarId, email]:
  //    - if exists: update lastSeenAt, ip, ua, name (if changed), phone (if provided)
  //    - if new: create with sessionStart=now
  // 6. Create Event(OPTIN, leadId, metadata={ ip, ua })
  // 7. Sign cookie: HMAC-SHA256(LEAD_SESSION_SECRET, leadId).slice(0,32) + "." + leadId
  //    cookies().set("hw_lead", value, { httpOnly, sameSite: "lax", secure: prod, maxAge: 30d, path: `/${slug}` })
  // 8. enqueueWebhook(webinar, "lead_novo", lead)
  // 9. redirect(`/${slug}/live`)
}
```

## Player page `/<slug>/live`

**Server (RSC):**

```ts
export default async function LivePage({ params }) {
  const { slug } = await params;
  const w = await prisma.webinar.findUnique({
    where: { slug },
    include: { video: true, ctas: true, chatMessages: { orderBy: { showAtSec: "asc" } } }
  });
  if (!w || w.status !== "ACTIVE") notFound();

  const lead = await resolveLeadFromCookie(w.id);
  if (!lead) redirect(`/${slug}`);

  const phase = computePhase(w, new Date());
  if (phase === "before") return <CountdownView w={publicWebinarDto(w)} />;
  if (phase === "closed" && w.mode === "UNICO") return <ClosedView w={publicWebinarDto(w)} />;

  const leadChat = await prisma.leadChatMessage.findMany({
    where: { leadId: lead.id }, orderBy: { createdAt: "asc" }
  });
  const initialOffsetSec = computeInitialOffset(w, lead, new Date());

  // fire lead_acessou webhook (one-shot via lead.enterFired flag)
  await maybeFireEnterWebhook(w, lead);

  return (
    <PlayerShell
      webinar={publicWebinarDto(w)}
      video={publicVideoDto(w.video)}
      ctas={w.ctas}
      ownerChat={w.chatMessages}
      leadChat={leadChat}
      initialOffsetSec={initialOffsetSec}
      lead={publicLeadDto(lead)}
    />
  );
}
```

**`computeInitialOffset(w, lead, now)`:**
- UNICO: `Math.max(0, (now - w.startDate) / 1000)`
- JIT: `Math.max(0, (now - lead.sessionStart) / 1000)`
- Cap at video.durationSec

**Client `<PlayerShell>`:**
- `<HlsPlayer videoSrc startOffsetSec onTimeUpdate />` — hls.js + `<video>` muted-autoplay + custom controls (play/pause/volume + "ativar áudio" overlay). NO scrubber. NO speed selector. `currentTime` set to `startOffsetSec` on mount.
- `<ChatPanel ownerChat leadChat currentTimeSec leadId webinarId />` — composed from `<OwnerChatStream>` + `<LeadChatInput>`.
  - Past owner messages (`showAtSec <= currentTimeSec`): rendered immediately on mount.
  - Future owner messages: held in pending queue, drip out via setInterval check (~250ms tick) when `currentTimeSec >= showAtSec`.
  - Lead's own messages: always visible (sorted by createdAt).
  - Input form: submit → `POST /api/lead-chat {text, videoSec: currentTimeSec}` → optimistic add to UI → server persists.
- `<CtaBanner ctas currentTimeSec leadId />` — full-width banner abaixo do vídeo. Active CTA = max showAtSec where `currentTimeSec >= showAtSec && (hideAtSec === null || currentTimeSec < hideAtSec)`. Background = `webinar.primaryColor`. On show first time per (lead, cta), POST `/api/cta-view`. On click, POST `/api/cta-click` + open `cta.url` em nova aba.
- `<Tracker leadId currentTimeSec durationSec />` — invisible. setInterval 30s POST `/api/track`. visibilitychange → pausa interval. beforeunload → `navigator.sendBeacon('/api/track-leave', ...)`.

## Public API routes

All routes auth via `resolveLeadFromCookie` (404/401 if missing/invalid).

- **`POST /api/track`** — body `{videoSec, watchedSecDelta}`. Throttle: rejects if `now - lead.lastSeenAt < 25s` (returns 429). Creates `Event(VIDEO_TICK)`, updates `Lead.{watchedSec += min(delta, 30), lastSeenAt: now}`. Webhook fires:
  - `lead_viu_pitch` if `videoSec >= webinar.pitchAtSec && !lead.pitchFired` → set `pitchFired=true` → `Event(PITCH_REACHED)` + enqueueWebhook
  - `lead_permaneceu` if `lead.watchedSec >= webinar.permanenceThresholdSec && !lead.permanenceFired` → set `permanenceFired=true` + enqueueWebhook
- **`POST /api/cta-click`** — body `{ctaId}`. Verifies cta belongs to webinar. Creates `Event(CTA_CLICK, ctaId)`. Increments `Lead.ctaClicks`. enqueueWebhook `lead_clicou_oferta`.
- **`POST /api/cta-view`** — body `{ctaId}`. Idempotent insert into `CtaView` via `@@unique([leadId, ctaId])` (catch P2002 = already viewed, return 204 silently). On first insert, create `Event(CTA_VIEW)` + enqueueWebhook `lead_viu_oferta`.
- **`POST /api/track-leave`** — beacon endpoint, `request.body` (text/plain JSON via `navigator.sendBeacon`). Creates `Event(VIDEO_END)`. If `!lead.leaveFired` → set `leaveFired=true` + enqueueWebhook `lead_saiu`. Returns 204.
- **`POST /api/lead-chat`** — body `{text, videoSec}`. Validates: `text.length 1..500`. Rate limit 30/min/leadId (in-memory Map). Persists `LeadChatMessage`. Returns the created row.

## Webhook delivery

**Enqueue helper:**
```ts
// apps/web/src/lib/webhook.ts
export async function enqueueWebhook(
  webinar: Webinar,
  event: WebhookEvent,
  lead: Lead | null,
  context: { videoSec?: number; ctaId?: string } = {}
) {
  if (!webinar.webhookUrl) return;
  if (!isEventEnabled(webinar, event)) return;

  const payload = {
    event,
    webinarId: webinar.id,
    webinarSlug: webinar.slug,
    leadId: lead?.id ?? null,
    lead: lead ? publicLeadDto(lead) : null,
    context,
    timestamp: new Date().toISOString()
  };

  const delivery = await prisma.webhookDelivery.create({
    data: {
      webinarId: webinar.id,
      leadId: lead?.id,
      event,
      url: webinar.webhookUrl,
      payload,
      status: "PENDING"
    }
  });

  await getWebhookQueue().add(JOB_DISPATCH_WEBHOOK, { deliveryId: delivery.id }, {
    attempts: 3,
    backoff: { type: "exponential", delay: 30_000 },
    removeOnComplete: 100,
    removeOnFail: 100
  });
}
```

**`isEventEnabled(webinar, event)`:**
- `lead_novo` → `webinar.webhookOnOptin`
- `lead_acessou` → `webinar.webhookOnEnter`
- `lead_viu_oferta` → `webinar.webhookOnCtaView`
- `lead_clicou_oferta` → `webinar.webhookOnCtaClick`
- `lead_viu_pitch` → `webinar.webhookOnPitchReached`
- `lead_permaneceu` → `webinar.webhookOnPermanence`
- `lead_saiu` → `webinar.webhookOnLeave`

**Worker job `dispatch-webhook` (apps/worker):**
```ts
export async function dispatchWebhook(job: Job<{ deliveryId: string }>) {
  const d = await prisma.webhookDelivery.findUnique({ where: { id: job.data.deliveryId } });
  if (!d) return;
  await prisma.webhookDelivery.update({
    where: { id: d.id },
    data: { attempt: { increment: 1 } }
  });
  try {
    const res = await fetch(d.url, {
      method: "POST",
      headers: { "content-type": "application/json", "user-agent": "hotwebinar-clone/1.0" },
      body: JSON.stringify(d.payload),
      signal: AbortSignal.timeout(10_000)
    });
    const body = (await res.text()).slice(0, 1024);
    if (res.ok) {
      await prisma.webhookDelivery.update({
        where: { id: d.id },
        data: { status: "SUCCESS", responseStatus: res.status, responseBody: body, errorMessage: null }
      });
      return;
    }
    throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await prisma.webhookDelivery.update({
      where: { id: d.id },
      data: { status: "FAILED", errorMessage: msg.slice(0, 1024) }
    });
    throw err; // BullMQ retries (attempts:3)
  }
}
```

**packages/jobs additions:**
- `QUEUE_WEBHOOK = "webhook"` (separate from "video")
- `JOB_DISPATCH_WEBHOOK = "dispatch-webhook"`
- `getWebhookQueue()` cached singleton

**Worker bootstrap (`apps/worker/src/index.ts`):** registers a SECOND `Worker` for QUEUE_WEBHOOK with concurrency=2 (webhooks are I/O-bound, can run higher than transcode).

## Admin UI `/dashboard/webinars/[id]/webhooks`

- Server-side fetched table: `Event | Lead | Status | Attempts | HTTP | Created`
- Filters (URL search params): `?status=FAILED&event=lead_novo`
- Row click expands payload JSON (formatted) + responseBody + errorMessage
- "Reenviar" button per row → server action `retryWebhook(deliveryId)` → creates NEW `WebhookDelivery` row (does not mutate original) + enqueues
- Pagination 50/page (server-driven via `?page=N`)

## Wizard step 6 — webhook config additions

Existing step 6 has `slug` + `loginButtonText/Color`. Adds:
- `webhookUrl` Input (zod url() optional, https-warning in prod)
- 7 checkboxes (PT labels):
  - "Ao captar lead novo" → `webhookOnOptin`
  - "Quando lead acessar o webinar" → `webhookOnEnter`
  - "Quando lead vir a oferta" → `webhookOnCtaView`
  - "Quando lead clicar na oferta" → `webhookOnCtaClick`
  - "Quando lead vir o pitch" → `webhookOnPitchReached`
  - "Quando lead permanecer (threshold abaixo)" → `webhookOnPermanence`
  - "Quando lead sair do webinar" → `webhookOnLeave`
- Number input `permanenceThresholdSec` (visible only if `webhookOnPermanence` checked, default 300)
- "Testar webhook" button → server action sends sample payload synchronously, displays response inline

## Lead session security

**Cookie:**
- Name: `hw_lead`
- Value: `<HMAC-SHA256(LEAD_SESSION_SECRET, leadId).slice(0,32)>.<leadId>`
- httpOnly, sameSite=Lax, secure in prod, maxAge=30d, path=`/<slug>` (per-webinar scope)

**Env var:** `LEAD_SESSION_SECRET` — separate from BETTER_AUTH_SECRET (domain separation). Validated at module load via existing `must()` pattern.

**Resolver:**
```ts
// apps/web/src/lib/lead-session.ts
export async function resolveLeadFromCookie(webinarId: string): Promise<Lead | null> {
  const cookie = (await cookies()).get("hw_lead")?.value;
  if (!cookie) return null;
  const [sig, leadId] = cookie.split(".");
  if (!sig || !leadId) return null;
  const expected = hmacSha256(process.env.LEAD_SESSION_SECRET!, leadId).slice(0, 32);
  if (!timingSafeEqual(sig, expected)) return null;
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead || lead.webinarId !== webinarId) return null;
  return lead;
}
```

## Public DTOs (data leakage prevention)

```ts
// apps/web/src/lib/public-dto.ts
export function publicWebinarDto(w: Webinar) {
  return {
    id: w.id,
    slug: w.slug,
    title: w.title,
    name: w.name,
    mode: w.mode,
    startDate: w.startDate,
    endDate: w.endDate,
    timezone: w.timezone,
    waitingTitle: w.waitingTitle,
    waitingSubtitle: w.waitingSubtitle,
    logoUrl: w.logoUrl,
    primaryColor: w.primaryColor,
    loginButtonText: w.loginButtonText,
    loginButtonColor: w.loginButtonColor,
    nameEnabled: w.nameEnabled, nameRequired: w.nameRequired, namePlaceholder: w.namePlaceholder,
    emailEnabled: w.emailEnabled, emailRequired: w.emailRequired, emailPlaceholder: w.emailPlaceholder,
    phoneEnabled: w.phoneEnabled, phoneRequired: w.phoneRequired, phonePlaceholder: w.phonePlaceholder,
    pitchAtSec: w.pitchAtSec
    // EXCLUDES: webhookUrl, all webhook flags, ownerId, videoId
  };
}

export function publicVideoDto(v: Video | null) {
  if (!v) return null;
  return {
    hlsUrl: v.hlsUrl,
    durationSec: v.durationSec,
    thumbUrl: v.thumbUrl,
    customThumbUrl: v.customThumbUrl
    // EXCLUDES: originalUrl, ownerId, bytes, status, errorMessage
  };
}

export function publicLeadDto(l: Lead) {
  return {
    id: l.id,
    name: l.name
    // EXCLUDES: email, phone, ip, ua, watchedSec, all fired flags
  };
}
```

## Rate limiting (MVP — in-memory)

- Submit opt-in: max 5/min per IP (`Map<ip, {count, resetAt}>`)
- Track endpoint: throttle 25s per leadId (uses existing `Lead.lastSeenAt` column — no extra state)
- Lead chat input: max 30 msgs/min per leadId (`Map<leadId, {count, resetAt}>`)

In-memory is single-instance only. Sub-plan F replaces with Redis SETEX for multi-instance deploy.

## File structure

```
apps/web/src/
├── app/
│   ├── [slug]/
│   │   ├── page.tsx                        capture
│   │   ├── live/page.tsx                   player shell (RSC)
│   │   ├── _components/
│   │   │   ├── capture-form.tsx
│   │   │   ├── countdown-view.tsx
│   │   │   ├── closed-view.tsx
│   │   │   ├── player-shell.tsx
│   │   │   ├── hls-player.tsx
│   │   │   ├── chat-panel.tsx
│   │   │   ├── owner-chat-stream.tsx
│   │   │   ├── lead-chat-input.tsx
│   │   │   ├── cta-banner.tsx
│   │   │   └── tracker.tsx
│   │   └── _lib/
│   │       └── public-types.ts
│   ├── api/
│   │   ├── track/route.ts
│   │   ├── track-leave/route.ts
│   │   ├── cta-click/route.ts
│   │   ├── cta-view/route.ts
│   │   └── lead-chat/route.ts
│   └── dashboard/webinars/[id]/webhooks/
│       └── page.tsx                        webhook log
├── server/actions/
│   ├── public.ts                           submitOptin, retryWebhook
│   └── webinar.ts                          EXTEND updateWebinarStep6 with webhook fields
├── lib/
│   ├── lead-session.ts
│   ├── webhook.ts
│   ├── slug-blacklist.ts
│   ├── public-dto.ts
│   ├── sync.ts                             computePhase, computeInitialOffset
│   └── rate-limit.ts
├── components/
│   └── webinar-form/
│       └── step-6-webhook-section.tsx      EXTEND step 6 form
└── lib/validations/
    └── webinar.ts                          EXTEND step6Schema with webhook fields, slug blacklist refinement

apps/worker/src/
├── jobs/dispatch-webhook.ts                NEW
└── index.ts                                EXTEND register webhook Worker

packages/jobs/src/
├── queue.ts                                EXTEND getWebhookQueue
└── types.ts                                EXTEND QUEUE_WEBHOOK, JOB_DISPATCH_WEBHOOK, payload types

packages/db/prisma/
└── migrations/<ts>_c_lead_player_webhook/
    └── migration.sql
```

## Tests

**Unit (vitest):**
- `lib/lead-session.test.ts` — sign/verify HMAC, expired/tampered cookie rejection, mismatched webinarId returns null
- `lib/sync.test.ts` — `computePhase` (UNICO before/open/closed; JIT always open), `computeInitialOffset` (UNICO uses startDate, JIT uses sessionStart, capped at duration)
- `lib/webhook.test.ts` — `enqueueWebhook` creates delivery + enqueues; skip when flag false / URL null / `isEventEnabled` returns false
- `lib/slug-blacklist.test.ts` — `isReservedSlug` true for reserved, false for normal slugs
- `lib/rate-limit.test.ts` — Map-based limiter (count, reset window)
- Server actions `submitOptin` — new lead, duplicate-update path, validation by webinar flags, cookie set
- Server action `retryWebhook` — creates new delivery row + enqueues
- API routes:
  - `/api/track` — auth, throttle 25s rejects, watchedSec update, pitch_reached fires once
  - `/api/cta-click`, `/api/cta-view` (dedupe via @@unique catch)
  - `/api/track-leave` beacon, fires lead_saiu once
  - `/api/lead-chat` rate-limit 30/min
- Worker `dispatch-webhook.test.ts` — mocked fetch: success, 5xx triggers throw (BullMQ retry), timeout, body truncation to 1024

**Component (vitest jsdom):**
- `<HlsPlayer>` — mocks hls.js, asserts no scrubber/speed in DOM, "ativar áudio" overlay until interaction
- `<ChatPanel>` — past messages render in batch, future messages drip via fake timers (vi.useFakeTimers), lead-input optimistic insert
- `<CtaBanner>` — show/hide by currentTime, click → onClick + window.open, posts cta-view once on first show
- `<CountdownView>` — re-renders countdown, transitions to player at startDate (mocked Date.now)
- `<CaptureForm>` — conditional fields by flags, phone validation rejects invalid international format

**E2E (playwright):**
- `public-funnel.spec.ts` — seed ACTIVE webinar → visit `/<slug>` → fill form → submit → redirected `/<slug>/live` → video element exists → CTA appears at expected `showAtSec` → click CTA → DB row in Event(CTA_CLICK)
- `webhook-replay.spec.ts` — opt-in fires webhook → mock URL returns 500 → admin opens `/dashboard/webinars/[id]/webhooks` → sees FAILED delivery → click "Reenviar" → second WebhookDelivery row created
- `unico-phases.spec.ts` — webinar UNICO `startDate` future → CountdownView; advance time past startDate → player loads; advance past endDate → ClosedView

## Definition of Done

1. Migration `c_lead_player_webhook` applies clean
2. `/<slug>` validates slug not reserved, renders capture honoring all flags
3. `submitOptin` creates/updates Lead, sets cookie, enqueues webhook (if flag), redirects
4. `/<slug>/live` resolves lead via cookie OR redirects to capture
5. UNICO phases: CountdownView before / player during / ClosedView after
6. JIT: t=0 = `lead.sessionStart`, video offset correct
7. HLS player loads via hls.js with custom controls (no scrubber/speed)
8. Chat: past in batch, future drips via setInterval
9. Lead chat input persists in `LeadChatMessage` scoped to leadId
10. CTA banner full-width sync, click = event + opens new tab
11. Tracker tick 30s + visibility/beforeunload beacon
12. Server throttle 25s between ticks
13. 7 webhooks configurable in wizard step 6 + permanence threshold input
14. WebhookDelivery persists payload+response, retry 3x exp via BullMQ
15. UI `/dashboard/webinars/[id]/webhooks` lists + filters + replay
16. `pnpm -r --workspace-concurrency=1 typecheck` + `test` clean
17. Playwright specs green
18. README.md updated with public routes + new env vars (`LEAD_SESSION_SECRET`)
19. `.env.example` includes `LEAD_SESSION_SECRET`

## Out of scope (deferred)

- Z-API WhatsApp integration (separate sub-plan or batched into F)
- Real-time websocket chat (lead chat is per-lead persisted, not broadcast)
- CDN sign-on for HLS segments (MinIO public bucket sufficient for MVP)
- Replay UI for end-of-webinar (sub-plan E analytics may surface)
- Multi-language i18n beyond webinar.language defaulting (PT-BR is hardcoded for UI strings)
- A/B testing multiple capture forms per webinar
- Rate-limit Redis backend (sub-plan F)
- Public player on-the-fly transcoding (B2 ships HLS pre-transcoded)
