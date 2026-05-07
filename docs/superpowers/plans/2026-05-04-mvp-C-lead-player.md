# MVP Sub-plan C — Lead Opt-in + Public Player Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the public-facing webinar experience: capture page (`/<slug>`) → live-style synchronized HLS player (`/<slug>/live`) with scripted chat replay, lead-input persistence, sync'd CTAs, anti-cheat tracking, and per-webinar configurable webhooks with delivery log + manual replay.

**Architecture:** Public RSC pages under `/<slug>` and `/<slug>/live` resolve a signed-cookie lead session and render server components composing client-side `HlsPlayer` + `ChatPanel` + `CtaBanner` + `Tracker`. Public API routes persist tracking events under throttled rules. A dedicated BullMQ `webhook` queue (separate from B2's `video` queue) is consumed by the existing `apps/worker` process to dispatch outbound webhooks with retries + persisted delivery log. Webhook config lives on a separate `/dashboard/webinars/[id]/integrations` page (deviates from spec which said "wizard step 6"; step 6 already owns scripted chat).

**Tech Stack:** Next.js 15 App Router (extends), Prisma 5 + Postgres, BullMQ + IORedis (extends B2), `react-phone-number-input` + `libphonenumber-js`, `hls.js` (browser), Better Auth (admin only — public has no auth, lead identity via signed cookie), vitest, Playwright.

**Spec:** [`docs/superpowers/specs/2026-05-04-mvp-C-lead-player-design.md`](../specs/2026-05-04-mvp-C-lead-player-design.md)

**Sub-plan series:**

- A — Foundation ✅
- B1 — Admin Webinar CRUD ✅
- B2 — Video pipeline ✅
- **C — Lead opt-in + public player (this plan)**
- E — Real analytics — future
- F — Coolify deploy — future

---

## Pre-flight

Branch is `feat/capture-phase` with B2 complete (24 commits). Postgres `hotwebinar-pg`, Redis `hotwebinar-redis`, MinIO `hotwebinar-minio` running locally via `docker-compose up -d`. The user prefers a single commit per task. Each task ends with one commit.

The seeded admin (`admin@example.com` / `test-password-min-12`) survives all integration tests; tests scope deletes to per-test users where reasonable. The cross-package `pnpm -r test` parallelism collision (web + worker share Postgres) means the test suite must be run with `pnpm -r --workspace-concurrency=1 test` — already documented in B2.

**Spec deviation noted:** Webhook configuration lives on a dedicated `/dashboard/webinars/[id]/integrations` page rather than wizard step 6 (step 6 is scripted chat). The webhook delivery log lives at `/dashboard/webinars/[id]/webhooks` per spec.

## File structure

```
apps/web/src/
├── app/
│   ├── [slug]/                                 NEW — public capture + player
│   │   ├── page.tsx                            capture (RSC)
│   │   ├── live/page.tsx                       player (RSC shell)
│   │   ├── _components/
│   │   │   ├── capture-form.tsx                client form
│   │   │   ├── countdown-view.tsx              client countdown
│   │   │   ├── closed-view.tsx                 server component (static)
│   │   │   ├── player-shell.tsx                client composition root
│   │   │   ├── hls-player.tsx                  client video element
│   │   │   ├── chat-panel.tsx                  client chat composition
│   │   │   ├── owner-chat-stream.tsx           client past-batch + future-drip
│   │   │   ├── lead-chat-input.tsx             client form for lead msgs
│   │   │   ├── cta-banner.tsx                  client banner
│   │   │   └── tracker.tsx                     client invisible tracker
│   │   └── _lib/
│   │       └── public-types.ts                 shared client types
│   ├── api/
│   │   ├── track/route.ts                      POST tick
│   │   ├── track-leave/route.ts                POST beacon
│   │   ├── cta-click/route.ts                  POST click
│   │   ├── cta-view/route.ts                   POST first-view dedupe
│   │   └── lead-chat/route.ts                  POST lead message
│   └── dashboard/webinars/[id]/
│       ├── integrations/page.tsx               NEW — webhook config form
│       └── webhooks/page.tsx                   NEW — delivery log + replay
├── server/actions/
│   ├── public.ts                               NEW — submitOptin, retryWebhook
│   └── webinar.ts                              EXTEND — updateWebinarIntegrations
├── lib/
│   ├── lead-session.ts                         NEW — HMAC sign/verify cookie
│   ├── webhook.ts                              NEW — enqueueWebhook + isEventEnabled
│   ├── slug-blacklist.ts                       NEW — RESERVED_SLUGS + isReservedSlug
│   ├── public-dto.ts                           NEW — publicWebinarDto, etc.
│   ├── sync.ts                                 NEW — computePhase, computeInitialOffset
│   └── rate-limit.ts                           NEW — Map-based limiter
├── components/
│   └── webinar/
│       └── integrations-form.tsx               NEW — client integrations form
└── lib/validations/
    └── webinar.ts                              EXTEND — slug blacklist refine + integrationsSchema

apps/worker/src/
├── jobs/dispatch-webhook.ts                    NEW
└── index.ts                                    EXTEND — register webhook Worker

packages/jobs/src/
├── queue.ts                                    EXTEND — getWebhookQueue
└── types.ts                                    EXTEND — QUEUE_WEBHOOK, JOB_DISPATCH_WEBHOOK, payload types

packages/db/prisma/
└── migrations/<ts>_c_lead_player_webhook/
    └── migration.sql

apps/web/.env.local                              add LEAD_SESSION_SECRET (user task)
.env.example                                     EXTEND
README.md                                        EXTEND
```

### File responsibilities

- **`lib/lead-session.ts`** — HMAC-SHA256 sign/verify on `<sig>.<leadId>` cookie. Single helper for all routes. No DB access.
- **`lib/webhook.ts`** — `enqueueWebhook(webinar, event, lead, ctx)` creates `WebhookDelivery` row + enqueues BullMQ job. Pure pre-flight check (`isEventEnabled`).
- **`lib/sync.ts`** — Pure functions for time-phase computation. No I/O. Trivially unit-testable.
- **`lib/public-dto.ts`** — Field-projection helpers preventing data leakage to public client components.
- **`lib/rate-limit.ts`** — In-memory Map limiter. Single-instance only — F replaces with Redis.
- **`apps/worker/src/jobs/dispatch-webhook.ts`** — Pure orchestrator. Retries via BullMQ. Updates `WebhookDelivery` to SUCCESS/FAILED.
- **Public API routes** — All auth via `resolveLeadFromCookie`. Throttle via existing `Lead.lastSeenAt` for `/api/track`.

---

## Task 1: Prisma migration `c_lead_player_webhook`

**Files:**

- Modify: `packages/db/prisma/schema.prisma`

- [ ] **Step 1: Extend `EventKind` enum**

Open `packages/db/prisma/schema.prisma`. Find the `EventKind` enum block (around line 101). Insert `CTA_VIEW` between `VIDEO_END` and `CTA_CLICK`:

```prisma
enum EventKind {
  OPTIN
  PAGE_VIEW
  VIDEO_START
  VIDEO_TICK
  VIDEO_END
  CTA_VIEW
  CTA_CLICK
  PITCH_REACHED
}
```

- [ ] **Step 2: Add `WebhookDeliveryStatus` enum**

Add after the `EventKind` block:

```prisma
enum WebhookDeliveryStatus {
  PENDING
  SUCCESS
  FAILED
}
```

- [ ] **Step 3: Extend `Webinar` model with webhook fields**

Find the `Webinar` model. Append the following fields BEFORE the relations (`owner`, `video`, `chatMessages`, etc.):

```prisma
  webhookUrl                  String?
  webhookOnOptin              Boolean  @default(false)
  webhookOnEnter              Boolean  @default(false)
  webhookOnCtaView            Boolean  @default(false)
  webhookOnCtaClick           Boolean  @default(false)
  webhookOnPitchReached       Boolean  @default(false)
  webhookOnPermanence         Boolean  @default(false)
  webhookOnLeave              Boolean  @default(false)
  permanenceThresholdSec      Int      @default(300)
```

Then add relations to the Webinar model alongside the existing `chatMessages`, `ctas`, `leads`, `events`:

```prisma
  leadChatMessages LeadChatMessage[]
  webhookDeliveries WebhookDelivery[]
```

- [ ] **Step 4: Extend `Lead` model with dedupe flags**

Find the `Lead` model. Append BEFORE the relations (`webinar`, `events`):

```prisma
  enterFired       Boolean   @default(false)
  pitchFired       Boolean   @default(false)
  permanenceFired  Boolean   @default(false)
  leaveFired       Boolean   @default(false)
```

Add relations alongside `events`:

```prisma
  leadChatMessages LeadChatMessage[]
  webhookDeliveries WebhookDelivery[]
  ctaViews         CtaView[]
```

- [ ] **Step 5: Add `LeadChatMessage` model**

Append at end of schema:

```prisma
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
```

- [ ] **Step 6: Add `WebhookDelivery` model**

Append:

```prisma
model WebhookDelivery {
  id              String                @id @default(cuid())
  webinarId       String
  leadId          String?
  event           String
  url             String
  payload         Json
  attempt         Int                   @default(0)
  status          WebhookDeliveryStatus @default(PENDING)
  responseStatus  Int?
  responseBody    String?
  errorMessage    String?
  createdAt       DateTime              @default(now())
  updatedAt       DateTime              @updatedAt
  webinar         Webinar               @relation(fields: [webinarId], references: [id], onDelete: Cascade)
  lead            Lead?                 @relation(fields: [leadId], references: [id], onDelete: SetNull)
  @@index([webinarId, status, createdAt])
  @@map("webhook_delivery")
}
```

- [ ] **Step 7: Add `CtaView` dedupe model**

Append:

```prisma
model CtaView {
  id        String   @id @default(cuid())
  leadId    String
  ctaId     String
  createdAt DateTime @default(now())
  lead      Lead     @relation(fields: [leadId], references: [id], onDelete: Cascade)
  @@unique([leadId, ctaId])
  @@index([ctaId])
  @@map("cta_view")
}
```

- [ ] **Step 8: Generate and apply migration**

```bash
DATABASE_URL="postgresql://hotwebinar:hotwebinar@localhost:5432/hotwebinar?schema=public" \
  pnpm --filter db prisma migrate dev --name c_lead_player_webhook
```

Expected: `packages/db/prisma/migrations/<ts>_c_lead_player_webhook/migration.sql` generated and applied; SQL adds `CTA_VIEW` to enum, creates `webhook_delivery_status` enum + 3 new tables + 11 new columns on `webinar` + 4 new columns on `lead`.

- [ ] **Step 9: Regenerate Prisma client**

```bash
pnpm --filter db generate
```

- [ ] **Step 10: Verify schema in psql**

```bash
docker exec hotwebinar-pg psql -U hotwebinar -d hotwebinar -c "\d webinar" | grep webhook
```

Expected: lists 8 webhook columns + `permanence_threshold_sec`.

- [ ] **Step 11: Commit**

```bash
git add packages/db/prisma/schema.prisma packages/db/prisma/migrations
git commit -m "feat(db): add LeadChatMessage, WebhookDelivery, CtaView + webhook config + dedupe flags"
```

---

## Task 2: `lib/slug-blacklist.ts` (TDD)

**Files:**

- Create: `apps/web/src/lib/slug-blacklist.ts`
- Create: `apps/web/src/test/lib/slug-blacklist.test.ts`
- Modify: `apps/web/src/lib/validations/webinar.ts`

- [ ] **Step 1: Write failing test `apps/web/src/test/lib/slug-blacklist.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { isReservedSlug, RESERVED_SLUGS } from "@/lib/slug-blacklist";

describe("slug-blacklist", () => {
  it("rejects reserved slugs", () => {
    expect(isReservedSlug("login")).toBe(true);
    expect(isReservedSlug("dashboard")).toBe(true);
    expect(isReservedSlug("api")).toBe(true);
    expect(isReservedSlug("_next")).toBe(true);
  });

  it("accepts normal slugs", () => {
    expect(isReservedSlug("meu-webinar")).toBe(false);
    expect(isReservedSlug("evento-2026")).toBe(false);
    expect(isReservedSlug("treinamento")).toBe(false);
  });

  it("treats casing as reserved match-insensitive", () => {
    expect(isReservedSlug("LOGIN")).toBe(true);
    expect(isReservedSlug("Dashboard")).toBe(true);
  });

  it("RESERVED_SLUGS contains expected baseline", () => {
    expect(RESERVED_SLUGS.has("login")).toBe(true);
    expect(RESERVED_SLUGS.has("dashboard")).toBe(true);
    expect(RESERVED_SLUGS.has("api")).toBe(true);
    expect(RESERVED_SLUGS.has("admin")).toBe(true);
    expect(RESERVED_SLUGS.has("_next")).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
pnpm --filter web test src/test/lib/slug-blacklist.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `apps/web/src/lib/slug-blacklist.ts`**

```ts
export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  "login",
  "dashboard",
  "api",
  "_next",
  "admin",
  "signup",
  "register",
  "static",
  "favicon.ico",
  "robots.txt",
  "sitemap.xml",
]);

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug.toLowerCase());
}
```

- [ ] **Step 4: Run to verify pass**

```bash
pnpm --filter web test src/test/lib/slug-blacklist.test.ts
```

Expected: 4 passing.

- [ ] **Step 5: Refine `slugSchema` in `apps/web/src/lib/validations/webinar.ts`**

Replace the existing `slugSchema` (around line 3):

```ts
import { z } from "zod";
import { isReservedSlug } from "@/lib/slug-blacklist";

export const slugSchema = z
  .string()
  .min(3)
  .max(60)
  .regex(/^[a-z0-9-]+$/, "Slug: minúsculas, números e hífen apenas")
  .refine((s) => !isReservedSlug(s), {
    message: "Slug reservado, escolha outro",
  });
```

- [ ] **Step 6: Verify existing webinar validations test still passes**

```bash
pnpm --filter web test src/test/lib/validations/webinar.test.ts
```

Expected: green — existing slug tests still pass since fixtures use non-reserved slugs.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib/slug-blacklist.ts apps/web/src/test/lib/slug-blacklist.test.ts apps/web/src/lib/validations/webinar.ts
git commit -m "feat(web): add reserved slug blacklist + zod refinement"
```

---

## Task 3: `packages/jobs` webhook queue extension

**Files:**

- Modify: `packages/jobs/src/types.ts`
- Modify: `packages/jobs/src/queue.ts`
- Modify: `packages/jobs/src/index.ts`

- [ ] **Step 1: Extend `packages/jobs/src/types.ts`**

Replace contents:

```ts
export const QUEUE_NAME = "video";
export const QUEUE_WEBHOOK = "webhook";

export const JOB_TRANSCODE = "transcode-video";
export const JOB_DELETE_ASSETS = "delete-video-assets";
export const JOB_DISPATCH_WEBHOOK = "dispatch-webhook";

export interface TranscodePayload {
  videoId: string;
}

export interface DeleteAssetsPayload {
  videoId: string;
  ownerId: string;
}

export interface DispatchWebhookPayload {
  deliveryId: string;
}

export type WebhookEvent =
  | "lead_novo"
  | "lead_acessou"
  | "lead_viu_oferta"
  | "lead_clicou_oferta"
  | "lead_viu_pitch"
  | "lead_permaneceu"
  | "lead_saiu";

export type JobStage =
  | "downloading"
  | "probing"
  | "transcoding"
  | "uploading"
  | "thumbnail";

export interface JobProgress {
  pct: number;
  stage: JobStage;
}
```

- [ ] **Step 2: Extend `packages/jobs/src/queue.ts`**

Replace contents:

```ts
import { Queue } from "bullmq";
import { getRedisConnection } from "./connection.js";
import { QUEUE_NAME, QUEUE_WEBHOOK } from "./types.js";

let cachedVideo: Queue | undefined;
let cachedWebhook: Queue | undefined;

export function getVideoQueue(): Queue {
  if (cachedVideo) return cachedVideo;
  cachedVideo = new Queue(QUEUE_NAME, { connection: getRedisConnection() });
  return cachedVideo;
}

export function getWebhookQueue(): Queue {
  if (cachedWebhook) return cachedWebhook;
  cachedWebhook = new Queue(QUEUE_WEBHOOK, {
    connection: getRedisConnection(),
  });
  return cachedWebhook;
}
```

- [ ] **Step 3: Extend `packages/jobs/src/index.ts`**

Replace contents:

```ts
export * from "./types.js";
export { getRedisConnection } from "./connection.js";
export { getVideoQueue, getWebhookQueue } from "./queue.js";
```

- [ ] **Step 4: Typecheck**

```bash
pnpm --filter jobs exec tsc --noEmit
```

Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add packages/jobs
git commit -m "feat(jobs): add webhook queue + dispatch-webhook job + WebhookEvent type"
```

---

## Task 4: `lib/lead-session.ts` (TDD)

**Files:**

- Create: `apps/web/src/lib/lead-session.ts`
- Create: `apps/web/src/test/lib/lead-session.test.ts`

- [ ] **Step 1: Write failing test `apps/web/src/test/lib/lead-session.test.ts`**

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { signLeadCookie, verifyLeadCookie } from "@/lib/lead-session";

beforeEach(() => {
  process.env.LEAD_SESSION_SECRET = "test-secret-min-32-chars-aaaaaaaaaa";
});

describe("lead-session", () => {
  it("signs and verifies a leadId roundtrip", () => {
    const cookie = signLeadCookie("lead-123");
    const result = verifyLeadCookie(cookie);
    expect(result).toBe("lead-123");
  });

  it("returns null for missing cookie", () => {
    expect(verifyLeadCookie(null)).toBeNull();
    expect(verifyLeadCookie(undefined)).toBeNull();
    expect(verifyLeadCookie("")).toBeNull();
  });

  it("returns null for malformed cookie", () => {
    expect(verifyLeadCookie("nodot")).toBeNull();
    expect(verifyLeadCookie(".only-id")).toBeNull();
    expect(verifyLeadCookie("only-sig.")).toBeNull();
  });

  it("returns null when signature does not match", () => {
    const cookie = signLeadCookie("lead-abc");
    const tampered = "ffffffffffffffffffffffffffffffff." + cookie.split(".")[1];
    expect(verifyLeadCookie(tampered)).toBeNull();
  });

  it("returns null when leadId is tampered", () => {
    const cookie = signLeadCookie("lead-abc");
    const tampered = cookie.split(".")[0] + ".lead-xyz";
    expect(verifyLeadCookie(tampered)).toBeNull();
  });

  it("throws when LEAD_SESSION_SECRET missing", () => {
    delete process.env.LEAD_SESSION_SECRET;
    expect(() => signLeadCookie("x")).toThrow(/LEAD_SESSION_SECRET/);
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
pnpm --filter web test src/test/lib/lead-session.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `apps/web/src/lib/lead-session.ts`**

```ts
import crypto from "node:crypto";

function getSecret(): string {
  const v = process.env.LEAD_SESSION_SECRET;
  if (!v || v.length < 16)
    throw new Error("Missing or too-short env: LEAD_SESSION_SECRET");
  return v;
}

function sign(leadId: string): string {
  return crypto
    .createHmac("sha256", getSecret())
    .update(leadId)
    .digest("hex")
    .slice(0, 32);
}

export function signLeadCookie(leadId: string): string {
  return `${sign(leadId)}.${leadId}`;
}

export function verifyLeadCookie(
  cookie: string | null | undefined,
): string | null {
  if (!cookie) return null;
  const dot = cookie.indexOf(".");
  if (dot <= 0 || dot === cookie.length - 1) return null;
  const sig = cookie.slice(0, dot);
  const leadId = cookie.slice(dot + 1);
  if (sig.length !== 32 || leadId.length === 0) return null;
  const expected = sign(leadId);
  const a = Buffer.from(sig, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return null;
  if (!crypto.timingSafeEqual(a, b)) return null;
  return leadId;
}
```

- [ ] **Step 4: Run to verify pass**

```bash
pnpm --filter web test src/test/lib/lead-session.test.ts
```

Expected: 6 passing.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/lead-session.ts apps/web/src/test/lib/lead-session.test.ts
git commit -m "feat(web): add HMAC-signed lead session cookie helpers"
```

---

## Task 5: `lib/sync.ts` (TDD)

**Files:**

- Create: `apps/web/src/lib/sync.ts`
- Create: `apps/web/src/test/lib/sync.test.ts`

- [ ] **Step 1: Write failing test `apps/web/src/test/lib/sync.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { computePhase, computeInitialOffset } from "@/lib/sync";

const baseUnico = {
  mode: "UNICO" as const,
  startDate: new Date("2026-05-04T14:00:00Z"),
  endDate: new Date("2026-05-04T15:00:00Z"),
};

const baseJit = {
  mode: "JIT" as const,
  startDate: null,
  endDate: null,
};

describe("computePhase", () => {
  it("UNICO returns 'before' before startDate", () => {
    expect(computePhase(baseUnico, new Date("2026-05-04T13:30:00Z"))).toBe(
      "before",
    );
  });

  it("UNICO returns 'open' between start and end", () => {
    expect(computePhase(baseUnico, new Date("2026-05-04T14:30:00Z"))).toBe(
      "open",
    );
  });

  it("UNICO returns 'closed' after endDate", () => {
    expect(computePhase(baseUnico, new Date("2026-05-04T15:30:00Z"))).toBe(
      "closed",
    );
  });

  it("UNICO without startDate is always 'open'", () => {
    expect(
      computePhase(
        { ...baseUnico, startDate: null, endDate: null },
        new Date(),
      ),
    ).toBe("open");
  });

  it("JIT is always 'open'", () => {
    expect(computePhase(baseJit, new Date())).toBe("open");
  });
});

describe("computeInitialOffset", () => {
  const lead = { sessionStart: new Date("2026-05-04T14:10:00Z") };
  const videoDuration = 3600;

  it("UNICO computes now - startDate", () => {
    const offset = computeInitialOffset(
      baseUnico,
      lead,
      new Date("2026-05-04T14:30:00Z"),
      videoDuration,
    );
    expect(offset).toBe(30 * 60); // 30 min
  });

  it("JIT computes now - lead.sessionStart", () => {
    const offset = computeInitialOffset(
      baseJit,
      lead,
      new Date("2026-05-04T14:25:00Z"),
      videoDuration,
    );
    expect(offset).toBe(15 * 60); // 15 min after sessionStart
  });

  it("returns 0 if offset is negative", () => {
    const offset = computeInitialOffset(
      baseUnico,
      lead,
      new Date("2026-05-04T13:30:00Z"),
      videoDuration,
    );
    expect(offset).toBe(0);
  });

  it("caps at video duration", () => {
    const offset = computeInitialOffset(
      baseUnico,
      lead,
      new Date("2026-05-04T18:00:00Z"),
      videoDuration,
    );
    expect(offset).toBe(videoDuration);
  });

  it("returns 0 when video duration is null", () => {
    const offset = computeInitialOffset(baseJit, lead, new Date(), null);
    expect(offset).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
pnpm --filter web test src/test/lib/sync.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `apps/web/src/lib/sync.ts`**

```ts
export type Phase = "before" | "open" | "closed";

export interface SyncWebinar {
  mode: "UNICO" | "JIT";
  startDate: Date | null;
  endDate: Date | null;
}

export interface SyncLead {
  sessionStart: Date;
}

export function computePhase(w: SyncWebinar, now: Date): Phase {
  if (w.mode !== "UNICO") return "open";
  if (!w.startDate) return "open";
  if (now < w.startDate) return "before";
  if (w.endDate && now >= w.endDate) return "closed";
  return "open";
}

export function computeInitialOffset(
  w: SyncWebinar,
  lead: SyncLead,
  now: Date,
  videoDurationSec: number | null,
): number {
  if (videoDurationSec == null || videoDurationSec <= 0) return 0;
  const anchor =
    w.mode === "UNICO" && w.startDate ? w.startDate : lead.sessionStart;
  const diffSec = Math.floor((now.getTime() - anchor.getTime()) / 1000);
  if (diffSec <= 0) return 0;
  return Math.min(diffSec, videoDurationSec);
}
```

- [ ] **Step 4: Run to verify pass**

```bash
pnpm --filter web test src/test/lib/sync.test.ts
```

Expected: 10 passing.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/sync.ts apps/web/src/test/lib/sync.test.ts
git commit -m "feat(web): add sync helpers (computePhase + computeInitialOffset)"
```

---

## Task 6: `lib/public-dto.ts`

**Files:**

- Create: `apps/web/src/lib/public-dto.ts`
- Create: `apps/web/src/test/lib/public-dto.test.ts`

- [ ] **Step 1: Write failing test `apps/web/src/test/lib/public-dto.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import {
  publicWebinarDto,
  publicVideoDto,
  publicLeadDto,
} from "@/lib/public-dto";

describe("publicWebinarDto", () => {
  it("excludes sensitive fields", () => {
    const w: any = {
      id: "w1",
      slug: "test",
      title: "T",
      name: "N",
      mode: "UNICO",
      startDate: null,
      endDate: null,
      timezone: "America/Sao_Paulo",
      waitingTitle: "Wait",
      waitingSubtitle: "Sub",
      logoUrl: null,
      primaryColor: "#000000",
      loginButtonText: "Entrar",
      loginButtonColor: "#16a34a",
      nameEnabled: true,
      nameRequired: true,
      namePlaceholder: "Nome",
      emailEnabled: true,
      emailRequired: true,
      emailPlaceholder: "Email",
      phoneEnabled: false,
      phoneRequired: false,
      phonePlaceholder: "Tel",
      pitchAtSec: 600,
      ownerId: "secret-owner",
      videoId: "secret-video",
      webhookUrl: "https://secret.example",
      webhookOnOptin: true,
    };
    const out = publicWebinarDto(w);
    expect(out.title).toBe("T");
    expect(out.pitchAtSec).toBe(600);
    expect((out as any).ownerId).toBeUndefined();
    expect((out as any).webhookUrl).toBeUndefined();
    expect((out as any).webhookOnOptin).toBeUndefined();
  });
});

describe("publicVideoDto", () => {
  it("returns null for null input", () => {
    expect(publicVideoDto(null)).toBeNull();
  });

  it("excludes originalUrl, ownerId, bytes", () => {
    const v: any = {
      id: "v1",
      hlsUrl: "https://hls.example/master.m3u8",
      durationSec: 3600,
      thumbUrl: "https://thumb.jpg",
      customThumbUrl: null,
      originalUrl: "secret-key/raw.mp4",
      ownerId: "secret",
      bytes: 12345n,
    };
    const out = publicVideoDto(v);
    expect(out?.hlsUrl).toBe("https://hls.example/master.m3u8");
    expect((out as any).originalUrl).toBeUndefined();
    expect((out as any).ownerId).toBeUndefined();
    expect((out as any).bytes).toBeUndefined();
  });
});

describe("publicLeadDto", () => {
  it("only exposes id and name", () => {
    const l: any = {
      id: "l1",
      name: "Joe",
      email: "joe@example.com",
      phone: "+5511999990000",
      ip: "1.2.3.4",
      watchedSec: 120,
      pitchFired: true,
    };
    const out = publicLeadDto(l);
    expect(out).toEqual({ id: "l1", name: "Joe" });
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
pnpm --filter web test src/test/lib/public-dto.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `apps/web/src/lib/public-dto.ts`**

```ts
import type { Lead, Video, Webinar } from "@prisma/client";

export type PublicWebinar = {
  id: string;
  slug: string | null;
  title: string;
  name: string;
  mode: "UNICO" | "JIT";
  startDate: Date | null;
  endDate: Date | null;
  timezone: string;
  waitingTitle: string;
  waitingSubtitle: string;
  logoUrl: string | null;
  primaryColor: string | null;
  loginButtonText: string;
  loginButtonColor: string;
  nameEnabled: boolean;
  nameRequired: boolean;
  namePlaceholder: string;
  emailEnabled: boolean;
  emailRequired: boolean;
  emailPlaceholder: string;
  phoneEnabled: boolean;
  phoneRequired: boolean;
  phonePlaceholder: string;
  pitchAtSec: number | null;
};

export function publicWebinarDto(w: Webinar): PublicWebinar {
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
    nameEnabled: w.nameEnabled,
    nameRequired: w.nameRequired,
    namePlaceholder: w.namePlaceholder,
    emailEnabled: w.emailEnabled,
    emailRequired: w.emailRequired,
    emailPlaceholder: w.emailPlaceholder,
    phoneEnabled: w.phoneEnabled,
    phoneRequired: w.phoneRequired,
    phonePlaceholder: w.phonePlaceholder,
    pitchAtSec: w.pitchAtSec,
  };
}

export type PublicVideo = {
  hlsUrl: string | null;
  durationSec: number | null;
  thumbUrl: string | null;
  customThumbUrl: string | null;
};

export function publicVideoDto(v: Video | null): PublicVideo | null {
  if (!v) return null;
  return {
    hlsUrl: v.hlsUrl,
    durationSec: v.durationSec,
    thumbUrl: v.thumbUrl,
    customThumbUrl: v.customThumbUrl,
  };
}

export type PublicLead = {
  id: string;
  name: string;
};

export function publicLeadDto(l: Lead): PublicLead {
  return { id: l.id, name: l.name };
}
```

- [ ] **Step 4: Run to verify pass**

```bash
pnpm --filter web test src/test/lib/public-dto.test.ts
```

Expected: 4 passing.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/public-dto.ts apps/web/src/test/lib/public-dto.test.ts
git commit -m "feat(web): add public DTOs preventing data leakage"
```

---

## Task 7: `lib/rate-limit.ts` (TDD)

**Files:**

- Create: `apps/web/src/lib/rate-limit.ts`
- Create: `apps/web/src/test/lib/rate-limit.test.ts`

- [ ] **Step 1: Write failing test `apps/web/src/test/lib/rate-limit.test.ts`**

```ts
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { createLimiter } from "@/lib/rate-limit";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-05-04T14:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("createLimiter", () => {
  it("allows up to N requests in the window", () => {
    const limiter = createLimiter({ max: 3, windowMs: 60_000 });
    expect(limiter.check("k1")).toBe(true);
    expect(limiter.check("k1")).toBe(true);
    expect(limiter.check("k1")).toBe(true);
    expect(limiter.check("k1")).toBe(false);
  });

  it("isolates by key", () => {
    const limiter = createLimiter({ max: 1, windowMs: 60_000 });
    expect(limiter.check("a")).toBe(true);
    expect(limiter.check("b")).toBe(true);
    expect(limiter.check("a")).toBe(false);
  });

  it("resets after window passes", () => {
    const limiter = createLimiter({ max: 1, windowMs: 60_000 });
    expect(limiter.check("k")).toBe(true);
    expect(limiter.check("k")).toBe(false);
    vi.advanceTimersByTime(61_000);
    expect(limiter.check("k")).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
pnpm --filter web test src/test/lib/rate-limit.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `apps/web/src/lib/rate-limit.ts`**

```ts
export interface LimiterOptions {
  max: number;
  windowMs: number;
}

interface Bucket {
  count: number;
  resetAt: number;
}

export interface Limiter {
  check(key: string): boolean;
}

export function createLimiter(opts: LimiterOptions): Limiter {
  const buckets = new Map<string, Bucket>();
  return {
    check(key: string): boolean {
      const now = Date.now();
      const b = buckets.get(key);
      if (!b || now >= b.resetAt) {
        buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
        return true;
      }
      if (b.count >= opts.max) return false;
      b.count += 1;
      return true;
    },
  };
}

export const optinLimiter = createLimiter({ max: 5, windowMs: 60_000 });
export const leadChatLimiter = createLimiter({ max: 30, windowMs: 60_000 });
```

- [ ] **Step 4: Run to verify pass**

```bash
pnpm --filter web test src/test/lib/rate-limit.test.ts
```

Expected: 3 passing.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/rate-limit.ts apps/web/src/test/lib/rate-limit.test.ts
git commit -m "feat(web): add in-memory Map rate-limiter"
```

---

## Task 8: `lib/webhook.ts` (TDD with mocks)

**Files:**

- Create: `apps/web/src/lib/webhook.ts`
- Create: `apps/web/src/test/lib/webhook.test.ts`

- [ ] **Step 1: Write failing test `apps/web/src/test/lib/webhook.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { prisma } from "db";

const queueAddMock = vi.fn(async () => ({ id: "j1" }));
vi.mock("jobs", async () => ({
  getWebhookQueue: () => ({ add: queueAddMock }),
  JOB_DISPATCH_WEBHOOK: "dispatch-webhook",
}));

const TEST_USER = { id: "wh-user", email: "wh@example.com", name: "WH" };

beforeEach(async () => {
  await prisma.webhookDelivery.deleteMany({});
  await prisma.event.deleteMany({});
  await prisma.lead.deleteMany({});
  await prisma.webinar.deleteMany({});
  await prisma.session.deleteMany({});
  await prisma.account.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.user.create({ data: TEST_USER });
  queueAddMock.mockClear();
});

afterAll(async () => prisma.$disconnect());

async function makeWebinar(overrides: any = {}) {
  return prisma.webinar.create({
    data: {
      ownerId: TEST_USER.id,
      name: "T",
      title: "T",
      slug: "test-" + Math.random().toString(36).slice(2, 8),
      status: "ACTIVE",
      webhookUrl: "https://hooks.example/x",
      webhookOnOptin: true,
      ...overrides,
    },
  });
}

describe("enqueueWebhook", () => {
  it("creates delivery row + enqueues job when flag enabled", async () => {
    const { enqueueWebhook } = await import("@/lib/webhook");
    const w = await makeWebinar();
    const lead = await prisma.lead.create({
      data: { webinarId: w.id, name: "Joe", email: "j@e.com" },
    });
    await enqueueWebhook(w, "lead_novo", lead);

    const deliveries = await prisma.webhookDelivery.findMany();
    expect(deliveries).toHaveLength(1);
    expect(deliveries[0].event).toBe("lead_novo");
    expect(deliveries[0].url).toBe("https://hooks.example/x");
    expect(deliveries[0].status).toBe("PENDING");
    expect(queueAddMock).toHaveBeenCalledWith(
      "dispatch-webhook",
      { deliveryId: deliveries[0].id },
      expect.any(Object),
    );
  });

  it("skips when webhook flag is off", async () => {
    const { enqueueWebhook } = await import("@/lib/webhook?" + Date.now());
    const w = await makeWebinar({ webhookOnOptin: false });
    await enqueueWebhook(w, "lead_novo", null);
    expect(await prisma.webhookDelivery.count()).toBe(0);
    expect(queueAddMock).not.toHaveBeenCalled();
  });

  it("skips when webhookUrl is null", async () => {
    const { enqueueWebhook } = await import(
      "@/lib/webhook?" + (Date.now() + 1)
    );
    const w = await makeWebinar({ webhookUrl: null });
    await enqueueWebhook(w, "lead_novo", null);
    expect(await prisma.webhookDelivery.count()).toBe(0);
    expect(queueAddMock).not.toHaveBeenCalled();
  });

  it("payload includes webinarSlug + lead public dto", async () => {
    const { enqueueWebhook } = await import(
      "@/lib/webhook?" + (Date.now() + 2)
    );
    const w = await makeWebinar({ slug: "myhook" });
    const lead = await prisma.lead.create({
      data: { webinarId: w.id, name: "Joe", email: "j@e.com", phone: "+5511" },
    });
    await enqueueWebhook(w, "lead_novo", lead);
    const d = await prisma.webhookDelivery.findFirst();
    const payload = d!.payload as any;
    expect(payload.event).toBe("lead_novo");
    expect(payload.webinarSlug).toBe("myhook");
    expect(payload.lead.id).toBe(lead.id);
    expect(payload.lead.name).toBe("Joe");
    expect(payload.lead.email).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
pnpm --filter web test src/test/lib/webhook.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `apps/web/src/lib/webhook.ts`**

```ts
import type { Lead, Webinar } from "@prisma/client";
import { prisma } from "db";
import { getWebhookQueue, JOB_DISPATCH_WEBHOOK, type WebhookEvent } from "jobs";
import { publicLeadDto } from "@/lib/public-dto";

const FLAG_BY_EVENT: Record<WebhookEvent, keyof Webinar> = {
  lead_novo: "webhookOnOptin",
  lead_acessou: "webhookOnEnter",
  lead_viu_oferta: "webhookOnCtaView",
  lead_clicou_oferta: "webhookOnCtaClick",
  lead_viu_pitch: "webhookOnPitchReached",
  lead_permaneceu: "webhookOnPermanence",
  lead_saiu: "webhookOnLeave",
};

export function isEventEnabled(w: Webinar, event: WebhookEvent): boolean {
  const flagKey = FLAG_BY_EVENT[event];
  return Boolean(w[flagKey]);
}

export async function enqueueWebhook(
  webinar: Webinar,
  event: WebhookEvent,
  lead: Lead | null,
  context: { videoSec?: number; ctaId?: string } = {},
): Promise<void> {
  if (!webinar.webhookUrl) return;
  if (!isEventEnabled(webinar, event)) return;

  const payload = {
    event,
    webinarId: webinar.id,
    webinarSlug: webinar.slug,
    leadId: lead?.id ?? null,
    lead: lead ? publicLeadDto(lead) : null,
    context,
    timestamp: new Date().toISOString(),
  };

  const delivery = await prisma.webhookDelivery.create({
    data: {
      webinarId: webinar.id,
      leadId: lead?.id,
      event,
      url: webinar.webhookUrl,
      payload,
      status: "PENDING",
    },
  });

  await getWebhookQueue().add(
    JOB_DISPATCH_WEBHOOK,
    { deliveryId: delivery.id },
    {
      attempts: 3,
      backoff: { type: "exponential", delay: 30_000 },
      removeOnComplete: 100,
      removeOnFail: 100,
    },
  );
}
```

- [ ] **Step 4: Run to verify pass**

```bash
pnpm --filter web test src/test/lib/webhook.test.ts
```

Expected: 4 passing.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/webhook.ts apps/web/src/test/lib/webhook.test.ts
git commit -m "feat(web): add enqueueWebhook + isEventEnabled helpers"
```

---

## Task 9: Server action `submitOptin` (TDD)

**Files:**

- Create: `apps/web/src/server/actions/public.ts`
- Create: `apps/web/src/test/server/actions/public-optin.test.ts`

- [ ] **Step 1: Write failing test `apps/web/src/test/server/actions/public-optin.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { prisma } from "db";

const cookieStore = new Map<string, { value: string; options?: any }>();
const setCookieMock = vi.fn((name: string, value: string, options?: any) => {
  cookieStore.set(name, { value, options });
});
const getCookieMock = vi.fn((name: string) => cookieStore.get(name));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: getCookieMock,
    set: setCookieMock,
  }),
  headers: async () =>
    new Headers({
      "x-forwarded-for": "1.2.3.4",
      "user-agent": "TestAgent/1.0",
    }),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const queueAddMock = vi.fn(async () => ({ id: "j1" }));
vi.mock("jobs", async () => ({
  getWebhookQueue: () => ({ add: queueAddMock }),
  JOB_DISPATCH_WEBHOOK: "dispatch-webhook",
}));

const redirectMock = vi.fn((url: string) => {
  throw new Error(`__redirect:${url}`);
});
vi.mock("next/navigation", () => ({ redirect: redirectMock }));

const TEST_USER = { id: "po-user", email: "po@example.com", name: "PO" };

beforeEach(async () => {
  process.env.LEAD_SESSION_SECRET = "test-secret-min-32-chars-aaaaaaaaaa";
  cookieStore.clear();
  setCookieMock.mockClear();
  redirectMock.mockClear();
  queueAddMock.mockClear();
  await prisma.webhookDelivery.deleteMany({});
  await prisma.event.deleteMany({});
  await prisma.lead.deleteMany({});
  await prisma.webinar.deleteMany({});
  await prisma.session.deleteMany({});
  await prisma.account.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.user.create({ data: TEST_USER });
});

afterAll(async () => prisma.$disconnect());

async function makeWebinar(overrides: any = {}) {
  return prisma.webinar.create({
    data: {
      ownerId: TEST_USER.id,
      name: "T",
      title: "T",
      slug: overrides.slug ?? "po-" + Math.random().toString(36).slice(2, 8),
      status: "ACTIVE",
      ...overrides,
    },
  });
}

describe("submitOptin", () => {
  it("creates new lead, sets cookie, redirects to /<slug>/live", async () => {
    const w = await makeWebinar({
      slug: "demo-1",
      webhookUrl: "https://x",
      webhookOnOptin: true,
    });
    const { submitOptin } = await import("@/server/actions/public");

    const fd = new FormData();
    fd.set("name", "Joe");
    fd.set("email", "joe@example.com");
    fd.set("phone", "+5511999990000");

    await expect(submitOptin("demo-1", fd)).rejects.toThrow(
      /__redirect:\/demo-1\/live/,
    );

    const lead = await prisma.lead.findFirst({
      where: { email: "joe@example.com" },
    });
    expect(lead).not.toBeNull();
    expect(lead?.name).toBe("Joe");
    expect(lead?.webinarId).toBe(w.id);
    expect(setCookieMock).toHaveBeenCalledWith(
      "hw_lead",
      expect.stringMatching(/^[a-f0-9]{32}\./),
      expect.objectContaining({
        httpOnly: true,
        sameSite: "lax",
        path: "/demo-1",
      }),
    );
    const events = await prisma.event.findMany({ where: { kind: "OPTIN" } });
    expect(events).toHaveLength(1);
    expect(await prisma.webhookDelivery.count()).toBe(1);
  });

  it("reuses existing lead by email and updates lastSeenAt", async () => {
    const w = await makeWebinar({ slug: "demo-2" });
    const orig = await prisma.lead.create({
      data: {
        webinarId: w.id,
        name: "Old Name",
        email: "joe@example.com",
        sessionStart: new Date("2026-05-01T00:00:00Z"),
        lastSeenAt: new Date("2026-05-01T00:00:00Z"),
      },
    });
    const { submitOptin } = await import(
      "@/server/actions/public?" + Date.now()
    );

    const fd = new FormData();
    fd.set("name", "New Name");
    fd.set("email", "joe@example.com");
    fd.set("phone", "+5511999990000");

    await expect(submitOptin("demo-2", fd)).rejects.toThrow(/__redirect/);

    const after = await prisma.lead.findUnique({ where: { id: orig.id } });
    expect(after?.name).toBe("New Name");
    expect(after?.lastSeenAt.getTime()).toBeGreaterThan(
      orig.lastSeenAt.getTime(),
    );
    expect(await prisma.lead.count()).toBe(1);
  });

  it("returns error when slug not found", async () => {
    const { submitOptin } = await import(
      "@/server/actions/public?" + (Date.now() + 1)
    );
    const fd = new FormData();
    fd.set("name", "Joe");
    fd.set("email", "j@e.com");
    fd.set("phone", "+5511999990000");
    const r = await submitOptin("nonexistent", fd);
    expect(r).toMatchObject({ error: { message: expect.any(String) } });
  });

  it("returns error when required field missing per webinar flags", async () => {
    await makeWebinar({ slug: "demo-3", phoneRequired: true });
    const { submitOptin } = await import(
      "@/server/actions/public?" + (Date.now() + 2)
    );
    const fd = new FormData();
    fd.set("name", "Joe");
    fd.set("email", "j@e.com");
    const r = await submitOptin("demo-3", fd);
    expect(r).toMatchObject({ error: { field: "phone" } });
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
pnpm --filter web test src/test/server/actions/public-optin.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `apps/web/src/server/actions/public.ts`**

```ts
"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "db";
import { signLeadCookie } from "@/lib/lead-session";
import { enqueueWebhook } from "@/lib/webhook";
import { optinLimiter } from "@/lib/rate-limit";

type OkResult = { ok: true };
type ErrorResult = { error: { field?: string; message: string } };
export type ActionResult = OkResult | ErrorResult;

function err(message: string, field?: string): ErrorResult {
  return { error: { message, field } };
}

export async function submitOptin(
  slug: string,
  formData: FormData,
): Promise<ActionResult | never> {
  const w = await prisma.webinar.findUnique({ where: { slug } });
  if (!w || w.status !== "ACTIVE") return err("Webinar não disponível");

  const hdrs = await headers();
  const ip =
    (hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "") || "unknown";
  const ua = hdrs.get("user-agent") ?? "";
  if (!optinLimiter.check(ip)) return err("Muitas tentativas, aguarde");

  const schemaShape: Record<string, z.ZodTypeAny> = {};
  if (w.nameEnabled) {
    schemaShape.name = w.nameRequired
      ? z.string().min(1, "Nome obrigatório")
      : z.string().optional();
  }
  if (w.emailEnabled) {
    schemaShape.email = w.emailRequired
      ? z.string().email("Email inválido")
      : z.string().email().optional().or(z.literal(""));
  }
  if (w.phoneEnabled) {
    schemaShape.phone = w.phoneRequired
      ? z.string().min(8, "Telefone inválido")
      : z.string().optional();
  }
  const schema = z.object(schemaShape);
  const raw = Object.fromEntries(formData.entries());
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return err(issue.message, issue.path.join("."));
  }
  const data = parsed.data as { name?: string; email?: string; phone?: string };

  const email = data.email ?? "";
  const name = data.name ?? "";
  const phone = data.phone || null;

  const existing = email
    ? await prisma.lead.findUnique({
        where: { webinarId_email: { webinarId: w.id, email } },
      })
    : null;

  let lead;
  if (existing) {
    lead = await prisma.lead.update({
      where: { id: existing.id },
      data: {
        name: name || existing.name,
        phone: phone ?? existing.phone,
        ip,
        userAgent: ua,
        lastSeenAt: new Date(),
      },
    });
  } else {
    lead = await prisma.lead.create({
      data: { webinarId: w.id, name, email, phone, ip, userAgent: ua },
    });
  }

  await prisma.event.create({
    data: {
      webinarId: w.id,
      leadId: lead.id,
      kind: "OPTIN",
      metadata: { ip, ua },
    },
  });

  const cookie = signLeadCookie(lead.id);
  const cookieStore = await cookies();
  cookieStore.set("hw_lead", cookie, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
    path: `/${slug}`,
  });

  await enqueueWebhook(w, "lead_novo", lead);

  redirect(`/${slug}/live`);
}
```

- [ ] **Step 4: Run to verify pass**

```bash
pnpm --filter web test src/test/server/actions/public-optin.test.ts
```

Expected: 4 passing.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/server/actions/public.ts apps/web/src/test/server/actions/public-optin.test.ts
git commit -m "feat(web): add submitOptin server action with cookie + webhook"
```

---

## Task 10: Server action `retryWebhook` (TDD)

**Files:**

- Modify: `apps/web/src/server/actions/public.ts`
- Create: `apps/web/src/test/server/actions/public-retry.test.ts`

- [ ] **Step 1: Write failing test `apps/web/src/test/server/actions/public-retry.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { prisma } from "db";

const TEST_USER = { id: "rw-user", email: "rw@example.com", name: "RW" };

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: vi.fn(), set: vi.fn() }),
  headers: async () => new Headers(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: async () => ({
        user: TEST_USER,
        session: { id: "s", userId: TEST_USER.id },
      }),
    },
  },
}));
const queueAddMock = vi.fn(async () => ({ id: "j2" }));
vi.mock("jobs", async () => ({
  getWebhookQueue: () => ({ add: queueAddMock }),
  JOB_DISPATCH_WEBHOOK: "dispatch-webhook",
}));

beforeEach(async () => {
  await prisma.webhookDelivery.deleteMany({});
  await prisma.event.deleteMany({});
  await prisma.lead.deleteMany({});
  await prisma.webinar.deleteMany({});
  await prisma.session.deleteMany({});
  await prisma.account.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.user.create({ data: TEST_USER });
  queueAddMock.mockClear();
});

afterAll(async () => prisma.$disconnect());

describe("retryWebhook", () => {
  it("creates a new delivery and enqueues", async () => {
    const w = await prisma.webinar.create({
      data: {
        ownerId: TEST_USER.id,
        name: "T",
        title: "T",
        slug: "rw-1",
        status: "ACTIVE",
        webhookUrl: "https://x",
        webhookOnOptin: true,
      },
    });
    const orig = await prisma.webhookDelivery.create({
      data: {
        webinarId: w.id,
        event: "lead_novo",
        url: "https://x",
        payload: { foo: 1 },
        status: "FAILED",
      },
    });
    const { retryWebhook } = await import("@/server/actions/public");

    const r = await retryWebhook(orig.id);
    expect(r).toEqual({ ok: true });

    const all = await prisma.webhookDelivery.findMany();
    expect(all).toHaveLength(2);
    const newOne = all.find((d) => d.id !== orig.id)!;
    expect(newOne.event).toBe("lead_novo");
    expect(newOne.status).toBe("PENDING");
    expect(newOne.attempt).toBe(0);
    expect(queueAddMock).toHaveBeenCalledWith(
      "dispatch-webhook",
      { deliveryId: newOne.id },
      expect.any(Object),
    );
  });

  it("returns error when delivery is for a webinar not owned by session user", async () => {
    await prisma.user.create({
      data: { id: "other", email: "o@e.com", name: "O" },
    });
    const w = await prisma.webinar.create({
      data: {
        ownerId: "other",
        name: "T",
        title: "T",
        slug: "rw-2",
        status: "ACTIVE",
      },
    });
    const orig = await prisma.webhookDelivery.create({
      data: {
        webinarId: w.id,
        event: "lead_novo",
        url: "https://x",
        payload: {},
        status: "FAILED",
      },
    });
    const { retryWebhook } = await import(
      "@/server/actions/public?" + Date.now()
    );
    const r = await retryWebhook(orig.id);
    expect(r).toMatchObject({ error: { message: expect.any(String) } });
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
pnpm --filter web test src/test/server/actions/public-retry.test.ts
```

Expected: FAIL — `retryWebhook` not exported.

- [ ] **Step 3: Append `retryWebhook` to `apps/web/src/server/actions/public.ts`**

Add imports at top:

```ts
import { headers as nextHeaders } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { getWebhookQueue, JOB_DISPATCH_WEBHOOK } from "jobs";
```

(Some of these may already exist from Task 9 — keep them deduplicated.)

Append the function:

```ts
export async function retryWebhook(deliveryId: string): Promise<ActionResult> {
  const session = await auth.api.getSession({ headers: await nextHeaders() });
  if (!session) return err("Não autorizado");
  const orig = await prisma.webhookDelivery.findUnique({
    where: { id: deliveryId },
    include: { webinar: true },
  });
  if (!orig || orig.webinar.ownerId !== session.user.id)
    return err("Não encontrado");

  const next = await prisma.webhookDelivery.create({
    data: {
      webinarId: orig.webinarId,
      leadId: orig.leadId,
      event: orig.event,
      url: orig.url,
      payload: orig.payload as any,
      status: "PENDING",
    },
  });
  await getWebhookQueue().add(
    JOB_DISPATCH_WEBHOOK,
    { deliveryId: next.id },
    {
      attempts: 3,
      backoff: { type: "exponential", delay: 30_000 },
      removeOnComplete: 100,
      removeOnFail: 100,
    },
  );
  revalidatePath(`/dashboard/webinars/${orig.webinarId}/webhooks`);
  return { ok: true };
}
```

- [ ] **Step 4: Run to verify pass**

```bash
pnpm --filter web test src/test/server/actions/public-retry.test.ts
```

Expected: 2 passing.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/server/actions/public.ts apps/web/src/test/server/actions/public-retry.test.ts
git commit -m "feat(web): add retryWebhook server action"
```

---

## Task 11: API route `/api/track`

**Files:**

- Create: `apps/web/src/app/api/track/route.ts`
- Create: `apps/web/src/test/api/track.test.ts`

- [ ] **Step 1: Write failing test `apps/web/src/test/api/track.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { prisma } from "db";
import { signLeadCookie } from "@/lib/lead-session";

const cookieGetMock = vi.fn();
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: cookieGetMock }),
}));

const queueAddMock = vi.fn(async () => ({ id: "j" }));
vi.mock("jobs", async () => ({
  getWebhookQueue: () => ({ add: queueAddMock }),
  JOB_DISPATCH_WEBHOOK: "dispatch-webhook",
}));

const TEST_USER = { id: "tk-user", email: "tk@example.com", name: "TK" };

beforeEach(async () => {
  process.env.LEAD_SESSION_SECRET = "test-secret-min-32-chars-aaaaaaaaaa";
  await prisma.event.deleteMany({});
  await prisma.lead.deleteMany({});
  await prisma.webinar.deleteMany({});
  await prisma.webhookDelivery.deleteMany({});
  await prisma.session.deleteMany({});
  await prisma.account.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.user.create({ data: TEST_USER });
  cookieGetMock.mockReset();
  queueAddMock.mockClear();
});

afterAll(async () => prisma.$disconnect());

async function makeWebinarWithLead(overrides: any = {}) {
  const w = await prisma.webinar.create({
    data: {
      ownerId: TEST_USER.id,
      name: "T",
      title: "T",
      slug: "tk-" + Math.random().toString(36).slice(2, 8),
      status: "ACTIVE",
      pitchAtSec: 600,
      webhookUrl: "https://x",
      webhookOnPitchReached: true,
      webhookOnPermanence: true,
      permanenceThresholdSec: 300,
      ...overrides,
    },
  });
  const lead = await prisma.lead.create({
    data: {
      webinarId: w.id,
      name: "Joe",
      email: "j@e.com",
      lastSeenAt: new Date(Date.now() - 60_000),
    },
  });
  cookieGetMock.mockReturnValue({ value: signLeadCookie(lead.id) });
  return { w, lead };
}

describe("POST /api/track", () => {
  it("creates VIDEO_TICK event + updates watchedSec", async () => {
    const { lead } = await makeWebinarWithLead();
    const { POST } = await import("@/app/api/track/route");
    const req = new Request("http://localhost/api/track", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ videoSec: 30, watchedSecDelta: 30 }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const after = await prisma.lead.findUnique({ where: { id: lead.id } });
    expect(after?.watchedSec).toBe(30);
    const events = await prisma.event.findMany({
      where: { kind: "VIDEO_TICK" },
    });
    expect(events).toHaveLength(1);
  });

  it("rejects 429 when last tick < 25s ago", async () => {
    const { lead } = await makeWebinarWithLead();
    await prisma.lead.update({
      where: { id: lead.id },
      data: { lastSeenAt: new Date(Date.now() - 10_000) },
    });
    const { POST } = await import("@/app/api/track/route?" + Date.now());
    const req = new Request("http://localhost/api/track", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ videoSec: 30, watchedSecDelta: 30 }),
    });
    const res = await POST(req);
    expect(res.status).toBe(429);
  });

  it("fires PITCH_REACHED + webhook once when crossing pitchAtSec", async () => {
    const { lead, w } = await makeWebinarWithLead();
    const { POST } = await import("@/app/api/track/route?" + (Date.now() + 1));
    const req = new Request("http://localhost/api/track", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ videoSec: 700, watchedSecDelta: 30 }),
    });
    await POST(req);
    const after = await prisma.lead.findUnique({ where: { id: lead.id } });
    expect(after?.pitchFired).toBe(true);
    const pitchEvents = await prisma.event.findMany({
      where: { kind: "PITCH_REACHED" },
    });
    expect(pitchEvents).toHaveLength(1);
    expect(queueAddMock).toHaveBeenCalled();
  });

  it("fires permanence webhook when watchedSec crosses threshold", async () => {
    const { lead } = await makeWebinarWithLead();
    await prisma.lead.update({
      where: { id: lead.id },
      data: { watchedSec: 290 },
    });
    const { POST } = await import("@/app/api/track/route?" + (Date.now() + 2));
    const req = new Request("http://localhost/api/track", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ videoSec: 30, watchedSecDelta: 30 }),
    });
    await POST(req);
    const after = await prisma.lead.findUnique({ where: { id: lead.id } });
    expect(after?.permanenceFired).toBe(true);
  });

  it("returns 401 when no cookie", async () => {
    cookieGetMock.mockReturnValue(undefined);
    const { POST } = await import("@/app/api/track/route?" + (Date.now() + 3));
    const req = new Request("http://localhost/api/track", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ videoSec: 30, watchedSecDelta: 30 }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
pnpm --filter web test src/test/api/track.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `apps/web/src/app/api/track/route.ts`**

```ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { prisma } from "db";
import { verifyLeadCookie } from "@/lib/lead-session";
import { enqueueWebhook } from "@/lib/webhook";

const inputSchema = z.object({
  videoSec: z.number().int().min(0),
  watchedSecDelta: z.number().int().min(0).max(60),
});

const THROTTLE_MS = 25_000;

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const leadId = verifyLeadCookie(cookieStore.get("hw_lead")?.value);
  if (!leadId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as unknown;
  const parsed = inputSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: { webinar: true },
  });
  if (!lead) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const now = new Date();
  if (now.getTime() - lead.lastSeenAt.getTime() < THROTTLE_MS) {
    return NextResponse.json({ error: "throttled" }, { status: 429 });
  }

  const newWatched = lead.watchedSec + parsed.data.watchedSecDelta;

  await prisma.event.create({
    data: {
      webinarId: lead.webinarId,
      leadId: lead.id,
      kind: "VIDEO_TICK",
      videoSec: parsed.data.videoSec,
    },
  });

  const updateData: any = { watchedSec: newWatched, lastSeenAt: now };

  const w = lead.webinar;
  let firePitch = false;
  let firePermanence = false;

  if (
    w.pitchAtSec != null &&
    parsed.data.videoSec >= w.pitchAtSec &&
    !lead.pitchFired
  ) {
    updateData.pitchFired = true;
    firePitch = true;
  }
  if (
    w.permanenceThresholdSec > 0 &&
    newWatched >= w.permanenceThresholdSec &&
    !lead.permanenceFired
  ) {
    updateData.permanenceFired = true;
    firePermanence = true;
  }

  const updated = await prisma.lead.update({
    where: { id: lead.id },
    data: updateData,
  });

  if (firePitch) {
    await prisma.event.create({
      data: {
        webinarId: w.id,
        leadId: lead.id,
        kind: "PITCH_REACHED",
        videoSec: parsed.data.videoSec,
      },
    });
    await enqueueWebhook(w, "lead_viu_pitch", updated, {
      videoSec: parsed.data.videoSec,
    });
  }
  if (firePermanence) {
    await enqueueWebhook(w, "lead_permaneceu", updated, {
      videoSec: parsed.data.videoSec,
    });
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Run to verify pass**

```bash
pnpm --filter web test src/test/api/track.test.ts
```

Expected: 5 passing.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/track/route.ts apps/web/src/test/api/track.test.ts
git commit -m "feat(web): add /api/track route with throttle + pitch + permanence"
```

---

## Task 12: API routes `/api/cta-click` + `/api/cta-view`

**Files:**

- Create: `apps/web/src/app/api/cta-click/route.ts`
- Create: `apps/web/src/app/api/cta-view/route.ts`
- Create: `apps/web/src/test/api/cta.test.ts`

- [ ] **Step 1: Write failing test `apps/web/src/test/api/cta.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { prisma } from "db";
import { signLeadCookie } from "@/lib/lead-session";

const cookieGetMock = vi.fn();
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: cookieGetMock }),
}));

const queueAddMock = vi.fn(async () => ({ id: "j" }));
vi.mock("jobs", async () => ({
  getWebhookQueue: () => ({ add: queueAddMock }),
  JOB_DISPATCH_WEBHOOK: "dispatch-webhook",
}));

const TEST_USER = { id: "ct-user", email: "ct@example.com", name: "CT" };

beforeEach(async () => {
  process.env.LEAD_SESSION_SECRET = "test-secret-min-32-chars-aaaaaaaaaa";
  await prisma.ctaView.deleteMany({});
  await prisma.event.deleteMany({});
  await prisma.cta.deleteMany({});
  await prisma.lead.deleteMany({});
  await prisma.webhookDelivery.deleteMany({});
  await prisma.webinar.deleteMany({});
  await prisma.session.deleteMany({});
  await prisma.account.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.user.create({ data: TEST_USER });
  cookieGetMock.mockReset();
  queueAddMock.mockClear();
});

afterAll(async () => prisma.$disconnect());

async function setup() {
  const w = await prisma.webinar.create({
    data: {
      ownerId: TEST_USER.id,
      name: "T",
      title: "T",
      slug: "ct-" + Math.random().toString(36).slice(2, 8),
      status: "ACTIVE",
      webhookUrl: "https://x",
      webhookOnCtaClick: true,
      webhookOnCtaView: true,
    },
  });
  const lead = await prisma.lead.create({
    data: { webinarId: w.id, name: "Joe", email: "j@e.com" },
  });
  const cta = await prisma.cta.create({
    data: {
      webinarId: w.id,
      label: "Comprar",
      url: "https://buy.example",
      showAtSec: 0,
    },
  });
  cookieGetMock.mockReturnValue({ value: signLeadCookie(lead.id) });
  return { w, lead, cta };
}

describe("POST /api/cta-click", () => {
  it("creates CTA_CLICK event + increments ctaClicks + fires webhook", async () => {
    const { lead, cta } = await setup();
    const { POST } = await import("@/app/api/cta-click/route");
    const req = new Request("http://localhost/api/cta-click", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ctaId: cta.id }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const after = await prisma.lead.findUnique({ where: { id: lead.id } });
    expect(after?.ctaClicks).toBe(1);
    const events = await prisma.event.findMany({
      where: { kind: "CTA_CLICK" },
    });
    expect(events).toHaveLength(1);
    expect(events[0].ctaId).toBe(cta.id);
    expect(queueAddMock).toHaveBeenCalled();
  });

  it("rejects when ctaId belongs to other webinar", async () => {
    const { lead } = await setup();
    await prisma.user.create({
      data: { id: "other", email: "o@e.com", name: "O" },
    });
    const otherW = await prisma.webinar.create({
      data: { ownerId: "other", name: "X", title: "X", slug: "ct-other" },
    });
    const otherCta = await prisma.cta.create({
      data: {
        webinarId: otherW.id,
        label: "X",
        url: "https://x",
        showAtSec: 0,
      },
    });
    const { POST } = await import("@/app/api/cta-click/route?" + Date.now());
    const req = new Request("http://localhost/api/cta-click", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ctaId: otherCta.id }),
    });
    const res = await POST(req);
    expect(res.status).toBe(404);
  });
});

describe("POST /api/cta-view", () => {
  it("creates CTA_VIEW event once per (lead, cta), idempotent on second call", async () => {
    const { cta } = await setup();
    const { POST } = await import("@/app/api/cta-view/route");
    const make = () =>
      new Request("http://localhost/api/cta-view", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ctaId: cta.id }),
      });
    const r1 = await POST(make());
    expect(r1.status).toBe(200);
    const r2 = await POST(make());
    expect(r2.status).toBe(200);
    const events = await prisma.event.findMany({ where: { kind: "CTA_VIEW" } });
    expect(events).toHaveLength(1);
    expect(queueAddMock).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
pnpm --filter web test src/test/api/cta.test.ts
```

Expected: FAIL — modules not found.

- [ ] **Step 3: Implement `apps/web/src/app/api/cta-click/route.ts`**

```ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { prisma } from "db";
import { verifyLeadCookie } from "@/lib/lead-session";
import { enqueueWebhook } from "@/lib/webhook";

const inputSchema = z.object({ ctaId: z.string().min(1) });

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const leadId = verifyLeadCookie(cookieStore.get("hw_lead")?.value);
  if (!leadId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as unknown;
  const parsed = inputSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: { webinar: true },
  });
  if (!lead) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const cta = await prisma.cta.findUnique({ where: { id: parsed.data.ctaId } });
  if (!cta || cta.webinarId !== lead.webinarId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  await prisma.event.create({
    data: {
      webinarId: lead.webinarId,
      leadId: lead.id,
      kind: "CTA_CLICK",
      ctaId: cta.id,
    },
  });
  const updated = await prisma.lead.update({
    where: { id: lead.id },
    data: { ctaClicks: { increment: 1 }, lastSeenAt: new Date() },
  });
  await enqueueWebhook(lead.webinar, "lead_clicou_oferta", updated, {
    ctaId: cta.id,
  });

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Implement `apps/web/src/app/api/cta-view/route.ts`**

```ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { prisma } from "db";
import { verifyLeadCookie } from "@/lib/lead-session";
import { enqueueWebhook } from "@/lib/webhook";

const inputSchema = z.object({ ctaId: z.string().min(1) });

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const leadId = verifyLeadCookie(cookieStore.get("hw_lead")?.value);
  if (!leadId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as unknown;
  const parsed = inputSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: { webinar: true },
  });
  if (!lead) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const cta = await prisma.cta.findUnique({ where: { id: parsed.data.ctaId } });
  if (!cta || cta.webinarId !== lead.webinarId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  try {
    await prisma.ctaView.create({ data: { leadId: lead.id, ctaId: cta.id } });
  } catch (err: any) {
    if (err?.code === "P2002") return NextResponse.json({ ok: true });
    throw err;
  }

  await prisma.event.create({
    data: {
      webinarId: lead.webinarId,
      leadId: lead.id,
      kind: "CTA_VIEW",
      ctaId: cta.id,
    },
  });
  await enqueueWebhook(lead.webinar, "lead_viu_oferta", lead, {
    ctaId: cta.id,
  });

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 5: Run to verify pass**

```bash
pnpm --filter web test src/test/api/cta.test.ts
```

Expected: 3 passing.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/api/cta-click apps/web/src/app/api/cta-view apps/web/src/test/api/cta.test.ts
git commit -m "feat(web): add /api/cta-click + /api/cta-view (dedupe via CtaView)"
```

---

## Task 13: API route `/api/track-leave` (beacon)

**Files:**

- Create: `apps/web/src/app/api/track-leave/route.ts`
- Create: `apps/web/src/test/api/track-leave.test.ts`

- [ ] **Step 1: Write failing test `apps/web/src/test/api/track-leave.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { prisma } from "db";
import { signLeadCookie } from "@/lib/lead-session";

const cookieGetMock = vi.fn();
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: cookieGetMock }),
}));

const queueAddMock = vi.fn(async () => ({ id: "j" }));
vi.mock("jobs", async () => ({
  getWebhookQueue: () => ({ add: queueAddMock }),
  JOB_DISPATCH_WEBHOOK: "dispatch-webhook",
}));

const TEST_USER = { id: "tl-user", email: "tl@example.com", name: "TL" };

beforeEach(async () => {
  process.env.LEAD_SESSION_SECRET = "test-secret-min-32-chars-aaaaaaaaaa";
  await prisma.event.deleteMany({});
  await prisma.lead.deleteMany({});
  await prisma.webhookDelivery.deleteMany({});
  await prisma.webinar.deleteMany({});
  await prisma.session.deleteMany({});
  await prisma.account.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.user.create({ data: TEST_USER });
  cookieGetMock.mockReset();
  queueAddMock.mockClear();
});

afterAll(async () => prisma.$disconnect());

describe("POST /api/track-leave", () => {
  it("fires VIDEO_END + lead_saiu webhook once", async () => {
    const w = await prisma.webinar.create({
      data: {
        ownerId: TEST_USER.id,
        name: "T",
        title: "T",
        slug: "tl-1",
        status: "ACTIVE",
        webhookUrl: "https://x",
        webhookOnLeave: true,
      },
    });
    const lead = await prisma.lead.create({
      data: { webinarId: w.id, name: "Joe", email: "j@e.com" },
    });
    cookieGetMock.mockReturnValue({ value: signLeadCookie(lead.id) });

    const { POST } = await import("@/app/api/track-leave/route");
    const req = new Request("http://localhost/api/track-leave", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ videoSec: 1234 }),
    });
    const res = await POST(req);
    expect(res.status).toBe(204);

    const after = await prisma.lead.findUnique({ where: { id: lead.id } });
    expect(after?.leaveFired).toBe(true);
    const events = await prisma.event.findMany({
      where: { kind: "VIDEO_END" },
    });
    expect(events).toHaveLength(1);
    expect(queueAddMock).toHaveBeenCalledTimes(1);

    const res2 = await POST(req.clone());
    expect(res2.status).toBe(204);
    expect(queueAddMock).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
pnpm --filter web test src/test/api/track-leave.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement `apps/web/src/app/api/track-leave/route.ts`**

```ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { prisma } from "db";
import { verifyLeadCookie } from "@/lib/lead-session";
import { enqueueWebhook } from "@/lib/webhook";

const inputSchema = z.object({ videoSec: z.number().int().min(0).optional() });

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const leadId = verifyLeadCookie(cookieStore.get("hw_lead")?.value);
  if (!leadId) return new NextResponse(null, { status: 204 });

  const text = await request.text().catch(() => "");
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = {};
  }
  const parsed = inputSchema.safeParse(body);
  const videoSec = parsed.success ? parsed.data.videoSec : undefined;

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: { webinar: true },
  });
  if (!lead) return new NextResponse(null, { status: 204 });

  await prisma.event.create({
    data: {
      webinarId: lead.webinarId,
      leadId: lead.id,
      kind: "VIDEO_END",
      videoSec,
    },
  });

  if (!lead.leaveFired) {
    const updated = await prisma.lead.update({
      where: { id: lead.id },
      data: { leaveFired: true, lastSeenAt: new Date() },
    });
    await enqueueWebhook(lead.webinar, "lead_saiu", updated, { videoSec });
  }

  return new NextResponse(null, { status: 204 });
}
```

- [ ] **Step 4: Run to verify pass**

```bash
pnpm --filter web test src/test/api/track-leave.test.ts
```

Expected: 1 passing.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/track-leave apps/web/src/test/api/track-leave.test.ts
git commit -m "feat(web): add /api/track-leave beacon route"
```

---

## Task 14: API route `/api/lead-chat`

**Files:**

- Create: `apps/web/src/app/api/lead-chat/route.ts`
- Create: `apps/web/src/test/api/lead-chat.test.ts`

- [ ] **Step 1: Write failing test `apps/web/src/test/api/lead-chat.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { prisma } from "db";
import { signLeadCookie } from "@/lib/lead-session";

const cookieGetMock = vi.fn();
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: cookieGetMock }),
}));

const TEST_USER = { id: "lc-user", email: "lc@example.com", name: "LC" };

beforeEach(async () => {
  process.env.LEAD_SESSION_SECRET = "test-secret-min-32-chars-aaaaaaaaaa";
  await prisma.leadChatMessage.deleteMany({});
  await prisma.lead.deleteMany({});
  await prisma.webinar.deleteMany({});
  await prisma.session.deleteMany({});
  await prisma.account.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.user.create({ data: TEST_USER });
  cookieGetMock.mockReset();
});

afterAll(async () => prisma.$disconnect());

async function setup() {
  const w = await prisma.webinar.create({
    data: {
      ownerId: TEST_USER.id,
      name: "T",
      title: "T",
      slug: "lc-1",
      status: "ACTIVE",
    },
  });
  const lead = await prisma.lead.create({
    data: { webinarId: w.id, name: "Joe", email: "j@e.com" },
  });
  cookieGetMock.mockReturnValue({ value: signLeadCookie(lead.id) });
  return { w, lead };
}

describe("POST /api/lead-chat", () => {
  it("persists message scoped to leadId", async () => {
    const { lead } = await setup();
    const { POST } = await import("@/app/api/lead-chat/route");
    const req = new Request("http://localhost/api/lead-chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Olá!", videoSec: 42 }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.id).toBeDefined();
    expect(data.text).toBe("Olá!");
    const all = await prisma.leadChatMessage.findMany({
      where: { leadId: lead.id },
    });
    expect(all).toHaveLength(1);
    expect(all[0].videoSec).toBe(42);
  });

  it("rejects empty text 400", async () => {
    await setup();
    const { POST } = await import("@/app/api/lead-chat/route?" + Date.now());
    const req = new Request("http://localhost/api/lead-chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "", videoSec: 0 }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("rejects 401 without cookie", async () => {
    cookieGetMock.mockReturnValue(undefined);
    const { POST } = await import(
      "@/app/api/lead-chat/route?" + (Date.now() + 1)
    );
    const req = new Request("http://localhost/api/lead-chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "x", videoSec: 0 }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
pnpm --filter web test src/test/api/lead-chat.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement `apps/web/src/app/api/lead-chat/route.ts`**

```ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { prisma } from "db";
import { verifyLeadCookie } from "@/lib/lead-session";
import { leadChatLimiter } from "@/lib/rate-limit";

const inputSchema = z.object({
  text: z.string().min(1).max(500),
  videoSec: z.number().int().min(0).optional(),
});

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const leadId = verifyLeadCookie(cookieStore.get("hw_lead")?.value);
  if (!leadId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  if (!leadChatLimiter.check(leadId)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const body = (await request.json().catch(() => null)) as unknown;
  const parsed = inputSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });

  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const msg = await prisma.leadChatMessage.create({
    data: {
      leadId: lead.id,
      webinarId: lead.webinarId,
      text: parsed.data.text,
      videoSec: parsed.data.videoSec,
    },
  });

  return NextResponse.json({
    id: msg.id,
    text: msg.text,
    videoSec: msg.videoSec,
    createdAt: msg.createdAt,
  });
}
```

- [ ] **Step 4: Run to verify pass**

```bash
pnpm --filter web test src/test/api/lead-chat.test.ts
```

Expected: 3 passing.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/lead-chat apps/web/src/test/api/lead-chat.test.ts
git commit -m "feat(web): add /api/lead-chat route (rate-limited 30/min/leadId)"
```

---

## Task 15: Capture page `/<slug>` + `<CaptureForm>` + `<ClosedView>`

**Files:**

- Create: `apps/web/src/app/[slug]/page.tsx`
- Create: `apps/web/src/app/[slug]/_components/capture-form.tsx`
- Create: `apps/web/src/app/[slug]/_components/closed-view.tsx`
- Modify: `apps/web/package.json` (add `react-phone-number-input` dep)

- [ ] **Step 1: Add dep**

Append to `apps/web/package.json` `dependencies`:

```json
"react-phone-number-input": "3.4.9",
"libphonenumber-js": "1.11.12"
```

Run:

```bash
pnpm install
```

- [ ] **Step 2: Implement `apps/web/src/app/[slug]/_components/closed-view.tsx`**

```tsx
import type { PublicWebinar } from "@/lib/public-dto";

export function ClosedView({ w }: { w: PublicWebinar }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-6 text-center">
      {w.logoUrl ? (
        <img src={w.logoUrl} alt="" className="mb-6 h-16 object-contain" />
      ) : null}
      <h1 className="text-2xl font-semibold">{w.title}</h1>
      <p className="mt-3 text-muted-foreground">
        Este webinar já foi encerrado.
      </p>
    </main>
  );
}
```

- [ ] **Step 3: Implement `apps/web/src/app/[slug]/_components/capture-form.tsx`**

```tsx
"use client";
import { useState, useTransition } from "react";
import dynamic from "next/dynamic";
import "react-phone-number-input/style.css";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { submitOptin } from "@/server/actions/public";
import type { PublicWebinar } from "@/lib/public-dto";

const PhoneInput = dynamic(() => import("react-phone-number-input"), {
  ssr: false,
});

export function CaptureForm({ w }: { w: PublicWebinar }) {
  const [pending, startTransition] = useTransition();
  const [phone, setPhone] = useState<string | undefined>("");
  const [error, setError] = useState<string | null>(null);

  function onSubmit(form: FormData) {
    setError(null);
    if (w.phoneEnabled) form.set("phone", phone ?? "");
    if (!w.slug) return;
    const slug = w.slug;
    startTransition(async () => {
      const r = await submitOptin(slug, form);
      if (r && "error" in r) setError(r.error.message);
    });
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-10">
      {w.logoUrl ? (
        <img
          src={w.logoUrl}
          alt=""
          className="mx-auto mb-6 h-auto object-contain"
        />
      ) : null}
      <h1 className="text-center text-3xl font-semibold">{w.title}</h1>
      {w.waitingSubtitle ? (
        <p className="mt-2 text-center text-sm text-muted-foreground">
          {w.waitingSubtitle}
        </p>
      ) : null}

      <form
        action={onSubmit}
        className="mt-8 space-y-4 rounded-lg border bg-card p-6 shadow-sm"
      >
        {w.nameEnabled ? (
          <div className="space-y-1">
            <Label htmlFor="name">Nome{w.nameRequired ? " *" : ""}</Label>
            <Input
              id="name"
              name="name"
              placeholder={w.namePlaceholder}
              required={w.nameRequired}
            />
          </div>
        ) : null}

        {w.emailEnabled ? (
          <div className="space-y-1">
            <Label htmlFor="email">Email{w.emailRequired ? " *" : ""}</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder={w.emailPlaceholder}
              required={w.emailRequired}
            />
          </div>
        ) : null}

        {w.phoneEnabled ? (
          <div className="space-y-1">
            <Label>Telefone{w.phoneRequired ? " *" : ""}</Label>
            <PhoneInput
              defaultCountry="BR"
              international
              placeholder={w.phonePlaceholder}
              value={phone}
              onChange={setPhone}
              className="rounded-md border bg-background px-3 py-2"
            />
          </div>
        ) : null}

        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <Button
          type="submit"
          disabled={pending}
          className="w-full"
          style={{ backgroundColor: w.loginButtonColor, color: "white" }}
        >
          {pending ? "Aguarde..." : w.loginButtonText}
        </Button>
      </form>
    </main>
  );
}
```

- [ ] **Step 4: Implement `apps/web/src/app/[slug]/page.tsx`**

```tsx
import { notFound } from "next/navigation";
import { prisma } from "db";
import { isReservedSlug } from "@/lib/slug-blacklist";
import { publicWebinarDto } from "@/lib/public-dto";
import { computePhase } from "@/lib/sync";
import { CaptureForm } from "./_components/capture-form";
import { ClosedView } from "./_components/closed-view";

export const dynamic = "force-dynamic";

export default async function CapturePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (isReservedSlug(slug)) notFound();
  const w = await prisma.webinar.findUnique({ where: { slug } });
  if (!w || w.status !== "ACTIVE") notFound();
  const phase = computePhase(
    { mode: w.mode, startDate: w.startDate, endDate: w.endDate },
    new Date(),
  );
  const dto = publicWebinarDto(w);
  if (phase === "closed" && w.mode === "UNICO") return <ClosedView w={dto} />;
  return <CaptureForm w={dto} />;
}
```

- [ ] **Step 5: Typecheck**

```bash
pnpm --filter web typecheck
```

Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/\[slug\]/page.tsx apps/web/src/app/\[slug\]/_components apps/web/package.json pnpm-lock.yaml
git commit -m "feat(web): add public capture page /<slug> + CaptureForm + ClosedView"
```

---

## Task 16: Player page `/<slug>/live` + helpers

**Files:**

- Create: `apps/web/src/app/[slug]/live/page.tsx`
- Create: `apps/web/src/app/[slug]/_components/countdown-view.tsx`
- Modify: `apps/web/src/lib/webhook.ts` (add `maybeFireEnterWebhook`)

- [ ] **Step 1: Append `maybeFireEnterWebhook` helper to `apps/web/src/lib/webhook.ts`**

```ts
export async function maybeFireEnterWebhook(
  webinar: import("@prisma/client").Webinar,
  lead: import("@prisma/client").Lead,
): Promise<void> {
  if (lead.enterFired) return;
  const updated = await prisma.lead.update({
    where: { id: lead.id },
    data: { enterFired: true, lastSeenAt: new Date() },
  });
  await enqueueWebhook(webinar, "lead_acessou", updated);
}
```

(`prisma` is already imported in webhook.ts from Task 8.)

- [ ] **Step 2: Implement `apps/web/src/app/[slug]/_components/countdown-view.tsx`**

```tsx
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { PublicWebinar } from "@/lib/public-dto";

function fmt(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

export function CountdownView({ w }: { w: PublicWebinar }) {
  const router = useRouter();
  const [remaining, setRemaining] = useState<number>(() => {
    if (!w.startDate) return 0;
    return Math.max(
      0,
      Math.floor((new Date(w.startDate).getTime() - Date.now()) / 1000),
    );
  });

  useEffect(() => {
    if (!w.startDate) return;
    const end = new Date(w.startDate).getTime();
    const tick = () => {
      const r = Math.max(0, Math.floor((end - Date.now()) / 1000));
      setRemaining(r);
      if (r === 0) router.refresh();
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [w.startDate, router]);

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-6 text-center">
      {w.logoUrl ? (
        <img src={w.logoUrl} alt="" className="mb-6 h-auto object-contain" />
      ) : null}
      <h1 className="text-3xl font-semibold">{w.waitingTitle}</h1>
      <p className="mt-2 text-muted-foreground">{w.waitingSubtitle}</p>
      <p className="mt-8 font-mono text-5xl tabular-nums" aria-live="polite">
        {fmt(remaining)}
      </p>
    </main>
  );
}
```

- [ ] **Step 3: Implement `apps/web/src/app/[slug]/live/page.tsx`**

```tsx
import { redirect, notFound } from "next/navigation";
import { cookies } from "next/headers";
import { prisma } from "db";
import { verifyLeadCookie } from "@/lib/lead-session";
import {
  publicWebinarDto,
  publicVideoDto,
  publicLeadDto,
} from "@/lib/public-dto";
import { computePhase, computeInitialOffset } from "@/lib/sync";
import { maybeFireEnterWebhook } from "@/lib/webhook";
import { isReservedSlug } from "@/lib/slug-blacklist";
import { CountdownView } from "../_components/countdown-view";
import { ClosedView } from "../_components/closed-view";
import { PlayerShell } from "../_components/player-shell";

export const dynamic = "force-dynamic";

export default async function LivePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (isReservedSlug(slug)) notFound();
  const w = await prisma.webinar.findUnique({
    where: { slug },
    include: {
      video: true,
      ctas: true,
      chatMessages: { orderBy: { showAtSec: "asc" } },
    },
  });
  if (!w || w.status !== "ACTIVE") notFound();

  const cookieStore = await cookies();
  const leadId = verifyLeadCookie(cookieStore.get("hw_lead")?.value);
  if (!leadId) redirect(`/${slug}`);
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead || lead.webinarId !== w.id) redirect(`/${slug}`);

  const phase = computePhase(
    { mode: w.mode, startDate: w.startDate, endDate: w.endDate },
    new Date(),
  );
  const wDto = publicWebinarDto(w);
  if (phase === "before" && w.mode === "UNICO")
    return <CountdownView w={wDto} />;
  if (phase === "closed" && w.mode === "UNICO") return <ClosedView w={wDto} />;

  const leadChat = await prisma.leadChatMessage.findMany({
    where: { leadId: lead.id },
    orderBy: { createdAt: "asc" },
  });
  const offset = computeInitialOffset(
    { mode: w.mode, startDate: w.startDate, endDate: w.endDate },
    { sessionStart: lead.sessionStart },
    new Date(),
    w.video?.durationSec ?? null,
  );

  await maybeFireEnterWebhook(w, lead);

  return (
    <PlayerShell
      webinar={wDto}
      video={publicVideoDto(w.video)}
      ctas={w.ctas.map((c) => ({
        id: c.id,
        label: c.label,
        url: c.url,
        showAtSec: c.showAtSec,
        hideAtSec: c.hideAtSec,
      }))}
      ownerChat={w.chatMessages.map((m) => ({
        id: m.id,
        authorName: m.authorName,
        text: m.text,
        showAtSec: m.showAtSec,
        isOwner: m.isOwner,
      }))}
      leadChat={leadChat.map((m) => ({
        id: m.id,
        text: m.text,
        videoSec: m.videoSec,
        createdAt: m.createdAt.toISOString(),
      }))}
      lead={publicLeadDto(lead)}
      initialOffsetSec={offset}
    />
  );
}
```

- [ ] **Step 4: Commit (PlayerShell will be created in Task 18 — typecheck will fail until then; commit after Task 18 instead)**

Defer the commit. Hold these files locally; the import of `PlayerShell` from `../_components/player-shell` resolves once Task 18 lands.

---

## Task 17: `<HlsPlayer>` component

**Files:**

- Create: `apps/web/src/app/[slug]/_components/hls-player.tsx`
- Create: `apps/web/src/app/[slug]/_lib/public-types.ts`
- Modify: `apps/web/package.json` (add `hls.js` dep)

- [ ] **Step 1: Add dep**

Append to `apps/web/package.json` `dependencies`:

```json
"hls.js": "1.5.17"
```

Run:

```bash
pnpm install
```

- [ ] **Step 2: Implement `apps/web/src/app/[slug]/_lib/public-types.ts`**

```ts
import type { PublicLead, PublicVideo, PublicWebinar } from "@/lib/public-dto";

export interface PlayerCta {
  id: string;
  label: string;
  url: string;
  showAtSec: number;
  hideAtSec: number | null;
}

export interface PlayerOwnerMsg {
  id: string;
  authorName: string;
  text: string;
  showAtSec: number;
  isOwner: boolean;
}

export interface PlayerLeadMsg {
  id: string;
  text: string;
  videoSec: number | null;
  createdAt: string;
}

export interface PlayerShellProps {
  webinar: PublicWebinar;
  video: PublicVideo | null;
  ctas: PlayerCta[];
  ownerChat: PlayerOwnerMsg[];
  leadChat: PlayerLeadMsg[];
  lead: PublicLead;
  initialOffsetSec: number;
}
```

- [ ] **Step 3: Implement `apps/web/src/app/[slug]/_components/hls-player.tsx`**

```tsx
"use client";
import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { Button } from "@/components/ui/button";
import { Pause, Play, Volume2, VolumeX } from "lucide-react";

interface HlsPlayerProps {
  src: string;
  startOffsetSec: number;
  onTimeUpdate: (sec: number) => void;
  onEnded?: () => void;
}

export function HlsPlayer({
  src,
  startOffsetSec,
  onTimeUpdate,
  onEnded,
}: HlsPlayerProps) {
  const ref = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [needsUnmute, setNeedsUnmute] = useState(true);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    let hls: Hls | null = null;
    if (Hls.isSupported()) {
      hls = new Hls({ lowLatencyMode: false });
      hls.loadSource(src);
      hls.attachMedia(video);
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
    }
    const onLoaded = () => {
      try {
        video.currentTime = Math.max(0, startOffsetSec);
      } catch {
        /* noop */
      }
      void video
        .play()
        .then(() => setPlaying(true))
        .catch(() => {
          /* autoplay blocked */
        });
    };
    video.addEventListener("loadedmetadata", onLoaded, { once: true });
    return () => {
      video.removeEventListener("loadedmetadata", onLoaded);
      if (hls) hls.destroy();
    };
  }, [src, startOffsetSec]);

  function togglePlay() {
    const v = ref.current;
    if (!v) return;
    if (v.paused) {
      void v.play();
      setPlaying(true);
    } else {
      v.pause();
      setPlaying(false);
    }
  }

  function toggleMute() {
    const v = ref.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
    setNeedsUnmute(false);
  }

  function unmuteOverlayClick() {
    const v = ref.current;
    if (!v) return;
    v.muted = false;
    setMuted(false);
    setNeedsUnmute(false);
    void v.play();
  }

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black">
      <video
        ref={ref}
        playsInline
        muted={muted}
        onTimeUpdate={(e) => onTimeUpdate(e.currentTarget.currentTime)}
        onEnded={() => {
          setPlaying(false);
          onEnded?.();
        }}
        className="h-full w-full"
        controls={false}
        controlsList="nodownload"
        disablePictureInPicture
      />
      {needsUnmute ? (
        <button
          type="button"
          onClick={unmuteOverlayClick}
          className="absolute inset-0 flex items-center justify-center bg-black/40 text-white"
        >
          <span className="rounded-md bg-white/90 px-4 py-2 text-sm font-medium text-black">
            Clique para ativar áudio
          </span>
        </button>
      ) : null}
      <div className="absolute bottom-2 left-2 flex items-center gap-2">
        <Button
          size="icon"
          variant="ghost"
          onClick={togglePlay}
          aria-label={playing ? "Pausar" : "Tocar"}
        >
          {playing ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={toggleMute}
          aria-label={muted ? "Ativar áudio" : "Silenciar"}
        >
          {muted ? (
            <VolumeX className="h-4 w-4" />
          ) : (
            <Volume2 className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Typecheck**

```bash
pnpm --filter web typecheck
```

Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/\[slug\]/_components/hls-player.tsx apps/web/src/app/\[slug\]/_lib apps/web/package.json pnpm-lock.yaml
git commit -m "feat(web): add HlsPlayer (hls.js + custom controls, no scrubber)"
```

---

## Task 18: Player composition `<PlayerShell>` + `<ChatPanel>` + `<CtaBanner>` + `<Tracker>`

**Files:**

- Create: `apps/web/src/app/[slug]/_components/player-shell.tsx`
- Create: `apps/web/src/app/[slug]/_components/chat-panel.tsx`
- Create: `apps/web/src/app/[slug]/_components/owner-chat-stream.tsx`
- Create: `apps/web/src/app/[slug]/_components/lead-chat-input.tsx`
- Create: `apps/web/src/app/[slug]/_components/cta-banner.tsx`
- Create: `apps/web/src/app/[slug]/_components/tracker.tsx`

- [ ] **Step 1: Implement `tracker.tsx`**

```tsx
"use client";
import { useEffect, useRef } from "react";

interface TrackerProps {
  currentTimeRef: React.MutableRefObject<number>;
}

export function Tracker({ currentTimeRef }: TrackerProps) {
  const lastSentSec = useRef<number>(currentTimeRef.current);

  useEffect(() => {
    let cancelled = false;
    const id = setInterval(async () => {
      if (cancelled) return;
      if (document.visibilityState !== "visible") return;
      const now = currentTimeRef.current;
      const delta = Math.min(
        60,
        Math.max(0, Math.round(now - lastSentSec.current)),
      );
      if (delta <= 0) return;
      try {
        await fetch("/api/track", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            videoSec: Math.round(now),
            watchedSecDelta: delta,
          }),
        });
        lastSentSec.current = now;
      } catch {
        /* swallow */
      }
    }, 30_000);

    const onLeave = () => {
      const data = JSON.stringify({
        videoSec: Math.round(currentTimeRef.current),
      });
      try {
        navigator.sendBeacon(
          "/api/track-leave",
          new Blob([data], { type: "application/json" }),
        );
      } catch {
        /* swallow */
      }
    };
    window.addEventListener("beforeunload", onLeave);
    window.addEventListener("pagehide", onLeave);

    return () => {
      cancelled = true;
      clearInterval(id);
      window.removeEventListener("beforeunload", onLeave);
      window.removeEventListener("pagehide", onLeave);
    };
  }, [currentTimeRef]);

  return null;
}
```

- [ ] **Step 2: Implement `cta-banner.tsx`**

```tsx
"use client";
import { useEffect, useRef } from "react";
import type { PlayerCta } from "../_lib/public-types";

interface CtaBannerProps {
  ctas: PlayerCta[];
  currentTimeSec: number;
  primaryColor: string | null;
}

function pickActive(ctas: PlayerCta[], t: number): PlayerCta | null {
  const candidates = ctas.filter(
    (c) => t >= c.showAtSec && (c.hideAtSec == null || t < c.hideAtSec),
  );
  if (candidates.length === 0) return null;
  return candidates.reduce((best, c) =>
    c.showAtSec > best.showAtSec ? c : best,
  );
}

export function CtaBanner({
  ctas,
  currentTimeSec,
  primaryColor,
}: CtaBannerProps) {
  const active = pickActive(ctas, currentTimeSec);
  const seenRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!active) return;
    if (seenRef.current.has(active.id)) return;
    seenRef.current.add(active.id);
    void fetch("/api/cta-view", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ctaId: active.id }),
    }).catch(() => {
      /* swallow */
    });
  }, [active]);

  if (!active) return null;

  function onClick() {
    void fetch("/api/cta-click", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ctaId: active!.id }),
    }).catch(() => {
      /* swallow */
    });
    window.open(active!.url, "_blank", "noopener,noreferrer");
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="block w-full rounded-md px-6 py-4 text-center text-base font-semibold text-white shadow"
      style={{ backgroundColor: primaryColor ?? "#16a34a" }}
    >
      {active.label}
    </button>
  );
}
```

- [ ] **Step 3: Implement `owner-chat-stream.tsx`**

```tsx
"use client";
import { useEffect, useRef, useState } from "react";
import type { PlayerOwnerMsg } from "../_lib/public-types";

interface OwnerChatStreamProps {
  messages: PlayerOwnerMsg[];
  currentTimeSec: number;
  leadName: string;
}

function personalize(text: string, leadName: string): string {
  return text.replace(/\{lead\.name\}/g, leadName);
}

export function OwnerChatStream({
  messages,
  currentTimeSec,
  leadName,
}: OwnerChatStreamProps) {
  const [shown, setShown] = useState<PlayerOwnerMsg[]>(() =>
    messages.filter((m) => m.showAtSec <= currentTimeSec),
  );
  const lastTimeRef = useRef<number>(currentTimeSec);

  useEffect(() => {
    const t = currentTimeSec;
    const prev = lastTimeRef.current;
    lastTimeRef.current = t;
    const newly = messages.filter(
      (m) => m.showAtSec > prev && m.showAtSec <= t,
    );
    if (newly.length === 0) return;
    setShown((s) => {
      const ids = new Set(s.map((m) => m.id));
      return [...s, ...newly.filter((m) => !ids.has(m.id))];
    });
  }, [currentTimeSec, messages]);

  return (
    <div className="flex flex-col gap-2">
      {shown.map((m) => (
        <div key={m.id} className="text-sm">
          <span
            className={
              m.isOwner ? "font-semibold text-primary" : "font-semibold"
            }
          >
            {m.authorName}:{" "}
          </span>
          <span>{personalize(m.text, leadName)}</span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Implement `lead-chat-input.tsx`**

```tsx
"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PlayerLeadMsg } from "../_lib/public-types";

interface LeadChatInputProps {
  initial: PlayerLeadMsg[];
  currentTimeSec: number;
}

export function LeadChatInput({ initial, currentTimeSec }: LeadChatInputProps) {
  const [messages, setMessages] = useState<PlayerLeadMsg[]>(initial);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    const optimistic: PlayerLeadMsg = {
      id: "tmp-" + Date.now(),
      text: trimmed,
      videoSec: Math.round(currentTimeSec),
      createdAt: new Date().toISOString(),
    };
    setMessages((m) => [...m, optimistic]);
    setText("");
    try {
      const res = await fetch("/api/lead-chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          text: trimmed,
          videoSec: Math.round(currentTimeSec),
        }),
      });
      if (res.ok) {
        const created = (await res.json()) as PlayerLeadMsg;
        setMessages((m) =>
          m.map((x) => (x.id === optimistic.id ? created : x)),
        );
      } else {
        setMessages((m) => m.filter((x) => x.id !== optimistic.id));
      }
    } catch {
      setMessages((m) => m.filter((x) => x.id !== optimistic.id));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-1">
        {messages.map((m) => (
          <div key={m.id} className="text-sm text-right">
            <span className="rounded-md bg-primary/10 px-2 py-1">{m.text}</span>
          </div>
        ))}
      </div>
      <form onSubmit={send} className="flex gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Mensagem"
          maxLength={500}
        />
        <Button type="submit" disabled={sending || text.trim().length === 0}>
          Enviar
        </Button>
      </form>
    </div>
  );
}
```

- [ ] **Step 5: Implement `chat-panel.tsx`**

```tsx
"use client";
import type { PlayerLeadMsg, PlayerOwnerMsg } from "../_lib/public-types";
import { OwnerChatStream } from "./owner-chat-stream";
import { LeadChatInput } from "./lead-chat-input";

interface ChatPanelProps {
  ownerChat: PlayerOwnerMsg[];
  leadChat: PlayerLeadMsg[];
  currentTimeSec: number;
  leadName: string;
}

export function ChatPanel({
  ownerChat,
  leadChat,
  currentTimeSec,
  leadName,
}: ChatPanelProps) {
  return (
    <aside className="flex h-full flex-col rounded-md border bg-card p-4">
      <h3 className="mb-3 text-sm font-semibold uppercase text-muted-foreground">
        Chat ao vivo
      </h3>
      <div className="flex-1 overflow-y-auto">
        <OwnerChatStream
          messages={ownerChat}
          currentTimeSec={currentTimeSec}
          leadName={leadName}
        />
      </div>
      <div className="mt-4 border-t pt-3">
        <LeadChatInput initial={leadChat} currentTimeSec={currentTimeSec} />
      </div>
    </aside>
  );
}
```

- [ ] **Step 6: Implement `player-shell.tsx`**

```tsx
"use client";
import { useRef, useState } from "react";
import type { PlayerShellProps } from "../_lib/public-types";
import { HlsPlayer } from "./hls-player";
import { ChatPanel } from "./chat-panel";
import { CtaBanner } from "./cta-banner";
import { Tracker } from "./tracker";

export function PlayerShell({
  webinar,
  video,
  ctas,
  ownerChat,
  leadChat,
  lead,
  initialOffsetSec,
}: PlayerShellProps) {
  const [currentTimeSec, setCurrentTimeSec] = useState(initialOffsetSec);
  const currentTimeRef = useRef(initialOffsetSec);

  function onTimeUpdate(sec: number) {
    currentTimeRef.current = sec;
    setCurrentTimeSec(sec);
  }

  if (!video?.hlsUrl) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 text-center">
        <p>Vídeo indisponível.</p>
      </main>
    );
  }

  return (
    <main className="grid min-h-screen grid-rows-[auto_1fr] bg-background">
      <header className="flex items-center justify-between border-b p-4">
        {webinar.logoUrl ? (
          <img src={webinar.logoUrl} alt="" className="h-8 object-contain" />
        ) : (
          <div />
        )}
        <span className="text-sm text-muted-foreground">Olá, {lead.name}</span>
      </header>
      <div className="grid gap-4 p-4 md:grid-cols-[2fr_1fr]">
        <div className="space-y-3">
          <HlsPlayer
            src={video.hlsUrl}
            startOffsetSec={initialOffsetSec}
            onTimeUpdate={onTimeUpdate}
          />
          <CtaBanner
            ctas={ctas}
            currentTimeSec={currentTimeSec}
            primaryColor={webinar.primaryColor}
          />
        </div>
        <ChatPanel
          ownerChat={ownerChat}
          leadChat={leadChat}
          currentTimeSec={currentTimeSec}
          leadName={lead.name}
        />
      </div>
      <Tracker currentTimeRef={currentTimeRef} />
    </main>
  );
}
```

- [ ] **Step 7: Typecheck**

```bash
pnpm --filter web typecheck
```

Expected: clean (this also resolves the deferred Task 16 commit).

- [ ] **Step 8: Commit Tasks 16 + 18 together**

```bash
git add apps/web/src/lib/webhook.ts apps/web/src/app/\[slug\]/live apps/web/src/app/\[slug\]/_components
git commit -m "feat(web): add public player /<slug>/live with HLS + chat + CTA + tracker"
```

---

## Task 19: Wizard step 6 — extend with Webhook section + integrations form

**Files:**

- Modify: `apps/web/src/lib/validations/webinar.ts` (add `integrationsSchema`)
- Modify: `apps/web/src/server/actions/webinar.ts` (add `updateWebinarIntegrations`)
- Create: `apps/web/src/components/webinar/integrations-form.tsx`
- Create: `apps/web/src/app/dashboard/webinars/[id]/integrations/page.tsx`
- Create: `apps/web/src/test/lib/validations/integrations.test.ts`

- [ ] **Step 1: Append schema to `apps/web/src/lib/validations/webinar.ts`**

Add at end of file:

```ts
export const integrationsSchema = z.object({
  webhookUrl: z.string().url("URL inválida").or(z.literal("")).optional(),
  webhookOnOptin: z.boolean(),
  webhookOnEnter: z.boolean(),
  webhookOnCtaView: z.boolean(),
  webhookOnCtaClick: z.boolean(),
  webhookOnPitchReached: z.boolean(),
  webhookOnPermanence: z.boolean(),
  webhookOnLeave: z.boolean(),
  permanenceThresholdSec: z.number().int().min(1).max(86_400),
});
export type IntegrationsInput = z.infer<typeof integrationsSchema>;
```

- [ ] **Step 2: Write failing test `apps/web/src/test/lib/validations/integrations.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { integrationsSchema } from "@/lib/validations/webinar";

describe("integrationsSchema", () => {
  const base = {
    webhookOnOptin: false,
    webhookOnEnter: false,
    webhookOnCtaView: false,
    webhookOnCtaClick: false,
    webhookOnPitchReached: false,
    webhookOnPermanence: false,
    webhookOnLeave: false,
    permanenceThresholdSec: 300,
  };

  it("accepts empty webhookUrl", () => {
    expect(
      integrationsSchema.safeParse({ ...base, webhookUrl: "" }).success,
    ).toBe(true);
  });

  it("accepts valid URL", () => {
    expect(
      integrationsSchema.safeParse({
        ...base,
        webhookUrl: "https://x.example/hook",
      }).success,
    ).toBe(true);
  });

  it("rejects malformed URL", () => {
    expect(
      integrationsSchema.safeParse({ ...base, webhookUrl: "not-a-url" })
        .success,
    ).toBe(false);
  });

  it("rejects threshold < 1", () => {
    expect(
      integrationsSchema.safeParse({ ...base, permanenceThresholdSec: 0 })
        .success,
    ).toBe(false);
  });
});
```

- [ ] **Step 3: Run test (should pass — schema already added)**

```bash
pnpm --filter web test src/test/lib/validations/integrations.test.ts
```

Expected: 4 passing.

- [ ] **Step 4: Append server action `updateWebinarIntegrations` to `apps/web/src/server/actions/webinar.ts`**

Add `integrationsSchema, type IntegrationsInput` to the import from `@/lib/validations/webinar`. Then append the function at the bottom of the file (before the closing `}`/EOF):

```ts
export async function updateWebinarIntegrations(
  id: string,
  input: IntegrationsInput,
): Promise<Result> {
  const session = await requireSession();
  const owned = await loadOwned(id, session.user.id);
  if (!owned) return notFound();
  const parsed = integrationsSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: { field: issue.path.join("."), message: issue.message } };
  }
  await prisma.webinar.update({
    where: { id },
    data: {
      webhookUrl: parsed.data.webhookUrl || null,
      webhookOnOptin: parsed.data.webhookOnOptin,
      webhookOnEnter: parsed.data.webhookOnEnter,
      webhookOnCtaView: parsed.data.webhookOnCtaView,
      webhookOnCtaClick: parsed.data.webhookOnCtaClick,
      webhookOnPitchReached: parsed.data.webhookOnPitchReached,
      webhookOnPermanence: parsed.data.webhookOnPermanence,
      webhookOnLeave: parsed.data.webhookOnLeave,
      permanenceThresholdSec: parsed.data.permanenceThresholdSec,
    },
  });
  revalidatePath(`/dashboard/webinars/${id}/integrations`);
  return { ok: true };
}
```

- [ ] **Step 5: Implement `apps/web/src/components/webinar/integrations-form.tsx`**

```tsx
"use client";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  integrationsSchema,
  type IntegrationsInput,
} from "@/lib/validations/webinar";
import { updateWebinarIntegrations } from "@/server/actions/webinar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export interface IntegrationsFormProps {
  webinarId: string;
  initial: IntegrationsInput;
}

const TRIGGERS: ReadonlyArray<{ key: keyof IntegrationsInput; label: string }> =
  [
    { key: "webhookOnOptin", label: "Ao captar lead novo" },
    { key: "webhookOnEnter", label: "Quando lead acessar o webinar" },
    { key: "webhookOnCtaView", label: "Quando lead vir a oferta" },
    { key: "webhookOnCtaClick", label: "Quando lead clicar na oferta" },
    { key: "webhookOnPitchReached", label: "Quando lead vir o pitch" },
    {
      key: "webhookOnPermanence",
      label: "Quando lead permanecer (threshold abaixo)",
    },
    { key: "webhookOnLeave", label: "Quando lead sair do webinar" },
  ];

export function IntegrationsForm({
  webinarId,
  initial,
}: IntegrationsFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<IntegrationsInput>({
    resolver: zodResolver(integrationsSchema),
    defaultValues: initial,
  });

  const watchPermanence = watch("webhookOnPermanence");

  function onSubmit(values: IntegrationsInput) {
    startTransition(async () => {
      const r = await updateWebinarIntegrations(webinarId, values);
      if ("ok" in r) {
        toast.success("Integrações salvas");
        router.refresh();
      } else {
        toast.error(r.error.message);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl space-y-6">
      <h2 className="text-2xl font-semibold">Integrações</h2>

      <div className="space-y-2">
        <Label htmlFor="webhookUrl">URL do webhook</Label>
        <Input
          id="webhookUrl"
          placeholder="https://..."
          {...register("webhookUrl")}
        />
        {errors.webhookUrl && (
          <p className="text-sm text-destructive">
            {errors.webhookUrl.message}
          </p>
        )}
      </div>

      <div className="space-y-3">
        <p className="text-sm font-medium">Disparar webhook quando:</p>
        {TRIGGERS.map((t) => (
          <label key={String(t.key)} className="flex items-center gap-3">
            <Switch
              checked={Boolean(watch(t.key as any))}
              onCheckedChange={(v) => setValue(t.key as any, v as never)}
            />
            <span className="text-sm">{t.label}</span>
          </label>
        ))}
      </div>

      {watchPermanence ? (
        <div className="space-y-2">
          <Label htmlFor="permanenceThresholdSec">
            Threshold de permanência (segundos)
          </Label>
          <Input
            id="permanenceThresholdSec"
            type="number"
            min={1}
            {...register("permanenceThresholdSec", { valueAsNumber: true })}
          />
          {errors.permanenceThresholdSec && (
            <p className="text-sm text-destructive">
              {errors.permanenceThresholdSec.message}
            </p>
          )}
        </div>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </form>
  );
}
```

- [ ] **Step 6: Implement page `apps/web/src/app/dashboard/webinars/[id]/integrations/page.tsx`**

```tsx
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "db";
import { IntegrationsForm } from "@/components/webinar/integrations-form";

export default async function IntegrationsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) notFound();
  const w = await prisma.webinar.findUnique({ where: { id } });
  if (!w || w.ownerId !== session.user.id) notFound();
  return (
    <div className="container mx-auto py-10">
      <IntegrationsForm
        webinarId={id}
        initial={{
          webhookUrl: w.webhookUrl ?? "",
          webhookOnOptin: w.webhookOnOptin,
          webhookOnEnter: w.webhookOnEnter,
          webhookOnCtaView: w.webhookOnCtaView,
          webhookOnCtaClick: w.webhookOnCtaClick,
          webhookOnPitchReached: w.webhookOnPitchReached,
          webhookOnPermanence: w.webhookOnPermanence,
          webhookOnLeave: w.webhookOnLeave,
          permanenceThresholdSec: w.permanenceThresholdSec,
        }}
      />
    </div>
  );
}
```

- [ ] **Step 7: Typecheck + tests**

```bash
pnpm --filter web typecheck
pnpm --filter web test
```

Expected: clean + green.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/lib/validations/webinar.ts apps/web/src/server/actions/webinar.ts apps/web/src/components/webinar apps/web/src/app/dashboard/webinars/\[id\]/integrations apps/web/src/test/lib/validations/integrations.test.ts
git commit -m "feat(web): add integrations form (webhook config) on dashboard webinar page"
```

---

## Task 20: Worker `dispatch-webhook` job (TDD with mocks)

**Files:**

- Create: `apps/worker/src/jobs/dispatch-webhook.ts`
- Create: `apps/worker/src/test/jobs/dispatch-webhook.test.ts`
- Modify: `apps/worker/src/index.ts` (register webhook Worker)

- [ ] **Step 1: Write failing test `apps/worker/src/test/jobs/dispatch-webhook.test.ts`**

```ts
import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { prisma } from "db";

const TEST_USER = { id: "dw-user", email: "dw@example.com", name: "DW" };

beforeEach(async () => {
  process.env.DATABASE_URL =
    "postgresql://hotwebinar:hotwebinar@localhost:5432/hotwebinar?schema=public";
  process.env.REDIS_URL = "redis://localhost:6379";
  process.env.S3_ENDPOINT = "http://localhost:9000";
  process.env.S3_ACCESS_KEY = "test";
  process.env.S3_SECRET_KEY = "test-min-12chars";
  process.env.S3_BUCKET_ORIGINALS = "originals-private";
  process.env.S3_BUCKET_HLS = "hls-public";
  process.env.S3_PUBLIC_BASE_URL = "http://localhost:9000";
  await prisma.webhookDelivery.deleteMany({});
  await prisma.lead.deleteMany({});
  await prisma.webinar.deleteMany({});
  await prisma.session.deleteMany({});
  await prisma.account.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.user.create({ data: TEST_USER });
  vi.restoreAllMocks();
});

afterAll(async () => prisma.$disconnect());

async function makeDelivery() {
  const w = await prisma.webinar.create({
    data: {
      ownerId: TEST_USER.id,
      name: "T",
      title: "T",
      slug: "dw-1",
      status: "ACTIVE",
    },
  });
  return prisma.webhookDelivery.create({
    data: {
      webinarId: w.id,
      event: "lead_novo",
      url: "https://hooks.example/x",
      payload: { foo: 1 },
      status: "PENDING",
    },
  });
}

describe("dispatchWebhook", () => {
  it("marks SUCCESS on 2xx response and stores response body", async () => {
    const d = await makeDelivery();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("OK", { status: 200 })),
    );
    const { dispatchWebhook } = await import("@/jobs/dispatch-webhook.js");
    const job: any = { data: { deliveryId: d.id } };
    await dispatchWebhook(job);
    const after = await prisma.webhookDelivery.findUnique({
      where: { id: d.id },
    });
    expect(after?.status).toBe("SUCCESS");
    expect(after?.responseStatus).toBe(200);
    expect(after?.responseBody).toBe("OK");
    expect(after?.attempt).toBe(1);
  });

  it("marks FAILED + throws on 5xx (BullMQ retry)", async () => {
    const d = await makeDelivery();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("server error", { status: 500 })),
    );
    const { dispatchWebhook } = await import(
      "@/jobs/dispatch-webhook.js?" + Date.now()
    );
    const job: any = { data: { deliveryId: d.id } };
    await expect(dispatchWebhook(job)).rejects.toThrow();
    const after = await prisma.webhookDelivery.findUnique({
      where: { id: d.id },
    });
    expect(after?.status).toBe("FAILED");
    expect(after?.errorMessage).toContain("HTTP 500");
  });

  it("truncates response body to 1024 chars", async () => {
    const d = await makeDelivery();
    const huge = "a".repeat(5000);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(huge, { status: 200 })),
    );
    const { dispatchWebhook } = await import(
      "@/jobs/dispatch-webhook.js?" + (Date.now() + 1)
    );
    const job: any = { data: { deliveryId: d.id } };
    await dispatchWebhook(job);
    const after = await prisma.webhookDelivery.findUnique({
      where: { id: d.id },
    });
    expect(after?.responseBody?.length).toBe(1024);
  });

  it("returns silently when delivery not found", async () => {
    const { dispatchWebhook } = await import(
      "@/jobs/dispatch-webhook.js?" + (Date.now() + 2)
    );
    const job: any = { data: { deliveryId: "nonexistent" } };
    await expect(dispatchWebhook(job)).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
pnpm --filter worker test src/test/jobs/dispatch-webhook.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `apps/worker/src/jobs/dispatch-webhook.ts`**

```ts
import { type Job } from "bullmq";
import { prisma } from "db";
import type { DispatchWebhookPayload } from "jobs";

export async function dispatchWebhook(
  job: Job<DispatchWebhookPayload>,
): Promise<void> {
  const { deliveryId } = job.data;
  const d = await prisma.webhookDelivery.findUnique({
    where: { id: deliveryId },
  });
  if (!d) return;

  await prisma.webhookDelivery.update({
    where: { id: d.id },
    data: { attempt: { increment: 1 } },
  });

  try {
    const res = await fetch(d.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": "hotwebinar-clone/1.0",
      },
      body: JSON.stringify(d.payload),
      signal: AbortSignal.timeout(10_000),
    });
    const body = (await res.text()).slice(0, 1024);
    if (res.ok) {
      await prisma.webhookDelivery.update({
        where: { id: d.id },
        data: {
          status: "SUCCESS",
          responseStatus: res.status,
          responseBody: body,
          errorMessage: null,
        },
      });
      return;
    }
    throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await prisma.webhookDelivery.update({
      where: { id: d.id },
      data: { status: "FAILED", errorMessage: msg.slice(0, 1024) },
    });
    throw err;
  }
}
```

- [ ] **Step 4: Extend `apps/worker/src/index.ts` to register the webhook Worker**

Replace contents:

```ts
import "./env.js";
import { Worker } from "bullmq";
import {
  getRedisConnection,
  QUEUE_NAME,
  QUEUE_WEBHOOK,
  JOB_TRANSCODE,
  JOB_DELETE_ASSETS,
  JOB_DISPATCH_WEBHOOK,
} from "jobs";
import { transcodeVideo } from "./jobs/transcode-video.js";
import { deleteVideoAssets } from "./jobs/delete-video-assets.js";
import { dispatchWebhook } from "./jobs/dispatch-webhook.js";
import { ensureBuckets } from "./lib/ensure-buckets.js";
import { config } from "./env.js";

async function main() {
  await ensureBuckets();

  const videoWorker = new Worker(
    QUEUE_NAME,
    async (job) => {
      if (job.name === JOB_TRANSCODE) return transcodeVideo(job);
      if (job.name === JOB_DELETE_ASSETS) return deleteVideoAssets(job);
      throw new Error(`Unknown video job: ${job.name}`);
    },
    { connection: getRedisConnection(), concurrency: config.workerConcurrency },
  );

  const webhookWorker = new Worker(
    QUEUE_WEBHOOK,
    async (job) => {
      if (job.name === JOB_DISPATCH_WEBHOOK) return dispatchWebhook(job);
      throw new Error(`Unknown webhook job: ${job.name}`);
    },
    { connection: getRedisConnection(), concurrency: 2 },
  );

  videoWorker.on("ready", () =>
    console.log(
      `[worker:video] ready, concurrency ${config.workerConcurrency}`,
    ),
  );
  videoWorker.on("failed", (job, err) =>
    console.error(`[worker:video] failed ${job?.id}: ${err.message}`),
  );
  webhookWorker.on("ready", () =>
    console.log("[worker:webhook] ready, concurrency 2"),
  );
  webhookWorker.on("failed", (job, err) =>
    console.error(`[worker:webhook] failed ${job?.id}: ${err.message}`),
  );

  const shutdown = async () => {
    console.log("[worker] graceful shutdown");
    await Promise.all([videoWorker.close(), webhookWorker.close()]);
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 5: Run to verify pass + worker tests still pass**

```bash
pnpm --filter worker typecheck
pnpm --filter worker test
```

Expected: typecheck clean. All worker tests pass (4 + 18 from B2 + 4 new = 22 tests, 6 files).

- [ ] **Step 6: Commit**

```bash
git add apps/worker/src/jobs/dispatch-webhook.ts apps/worker/src/test/jobs/dispatch-webhook.test.ts apps/worker/src/index.ts
git commit -m "feat(worker): add dispatch-webhook job + register webhook Worker"
```

---

## Task 21: Admin UI `/dashboard/webinars/[id]/webhooks`

**Files:**

- Create: `apps/web/src/app/dashboard/webinars/[id]/webhooks/page.tsx`
- Create: `apps/web/src/components/webinar/webhook-row.tsx`

- [ ] **Step 1: Implement `apps/web/src/components/webinar/webhook-row.tsx`**

```tsx
"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { retryWebhook } from "@/server/actions/public";

export interface WebhookRowData {
  id: string;
  event: string;
  status: "PENDING" | "SUCCESS" | "FAILED";
  attempt: number;
  responseStatus: number | null;
  errorMessage: string | null;
  responseBody: string | null;
  payloadJson: string;
  leadName: string | null;
  createdAt: string;
}

export function WebhookRow({ row }: { row: WebhookRowData }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function onRetry() {
    startTransition(async () => {
      const r = await retryWebhook(row.id);
      if ("ok" in r) {
        toast.success("Reenviado");
        router.refresh();
      } else {
        toast.error(r.error.message);
      }
    });
  }

  const variant: "default" | "destructive" | "outline" =
    row.status === "SUCCESS"
      ? "default"
      : row.status === "FAILED"
        ? "destructive"
        : "outline";

  return (
    <>
      <tr className="border-b">
        <td className="px-3 py-2 font-mono text-xs">{row.event}</td>
        <td className="px-3 py-2">{row.leadName ?? "—"}</td>
        <td className="px-3 py-2">
          <Badge variant={variant}>{row.status}</Badge>
        </td>
        <td className="px-3 py-2 text-right tabular-nums">{row.attempt}</td>
        <td className="px-3 py-2 text-right tabular-nums">
          {row.responseStatus ?? "—"}
        </td>
        <td className="px-3 py-2 text-xs text-muted-foreground">
          {row.createdAt}
        </td>
        <td className="px-3 py-2 text-right">
          <Button variant="ghost" size="sm" onClick={() => setOpen((v) => !v)}>
            {open ? "−" : "+"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={onRetry}
          >
            Reenviar
          </Button>
        </td>
      </tr>
      {open ? (
        <tr>
          <td colSpan={7} className="bg-muted/30 px-3 py-3 text-xs">
            <p className="font-semibold">Payload</p>
            <pre className="mt-1 max-h-40 overflow-auto rounded bg-background p-2">
              {row.payloadJson}
            </pre>
            {row.responseBody ? (
              <>
                <p className="mt-2 font-semibold">Response</p>
                <pre className="mt-1 max-h-40 overflow-auto rounded bg-background p-2">
                  {row.responseBody}
                </pre>
              </>
            ) : null}
            {row.errorMessage ? (
              <>
                <p className="mt-2 font-semibold text-destructive">Erro</p>
                <pre className="mt-1 rounded bg-background p-2">
                  {row.errorMessage}
                </pre>
              </>
            ) : null}
          </td>
        </tr>
      ) : null}
    </>
  );
}
```

- [ ] **Step 2: Implement page `apps/web/src/app/dashboard/webinars/[id]/webhooks/page.tsx`**

```tsx
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "db";
import {
  WebhookRow,
  type WebhookRowData,
} from "@/components/webinar/webhook-row";

const PAGE_SIZE = 50;

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ status?: string; event?: string; page?: string }>;
}

export default async function WebhooksPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const sp = await searchParams;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) notFound();
  const w = await prisma.webinar.findUnique({ where: { id } });
  if (!w || w.ownerId !== session.user.id) notFound();

  const page = Math.max(1, Number(sp.page ?? "1"));
  const where: any = { webinarId: id };
  if (sp.status) where.status = sp.status;
  if (sp.event) where.event = sp.event;

  const [total, rows] = await Promise.all([
    prisma.webhookDelivery.count({ where }),
    prisma.webhookDelivery.findMany({
      where,
      include: { lead: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);
  const data: WebhookRowData[] = rows.map((r) => ({
    id: r.id,
    event: r.event,
    status: r.status,
    attempt: r.attempt,
    responseStatus: r.responseStatus,
    errorMessage: r.errorMessage,
    responseBody: r.responseBody,
    payloadJson: JSON.stringify(r.payload, null, 2),
    leadName: r.lead?.name ?? null,
    createdAt: r.createdAt.toISOString(),
  }));

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="container mx-auto py-10">
      <h1 className="text-2xl font-semibold">Webhooks — {w.title}</h1>
      <div className="mt-4 flex gap-2 text-sm">
        <FilterLink
          id={id}
          label="Todos"
          sp={sp}
          apply={{ status: undefined }}
        />
        <FilterLink
          id={id}
          label="Pending"
          sp={sp}
          apply={{ status: "PENDING" }}
        />
        <FilterLink
          id={id}
          label="Success"
          sp={sp}
          apply={{ status: "SUCCESS" }}
        />
        <FilterLink
          id={id}
          label="Failed"
          sp={sp}
          apply={{ status: "FAILED" }}
        />
      </div>
      <table className="mt-4 w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="px-3 py-2">Evento</th>
            <th className="px-3 py-2">Lead</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2 text-right">Attempts</th>
            <th className="px-3 py-2 text-right">HTTP</th>
            <th className="px-3 py-2">Quando</th>
            <th className="px-3 py-2 text-right">Ações</th>
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={7}
                className="px-3 py-6 text-center text-muted-foreground"
              >
                Nenhum disparo ainda.
              </td>
            </tr>
          ) : null}
          {data.map((r) => (
            <WebhookRow key={r.id} row={r} />
          ))}
        </tbody>
      </table>
      <div className="mt-4 flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {total} entrada{total === 1 ? "" : "s"}, página {page}/{totalPages}
        </span>
        <div className="flex gap-2">
          {page > 1 ? (
            <Link
              href={`?page=${page - 1}`}
              className="rounded border px-3 py-1"
            >
              Anterior
            </Link>
          ) : null}
          {page < totalPages ? (
            <Link
              href={`?page=${page + 1}`}
              className="rounded border px-3 py-1"
            >
              Próximo
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function FilterLink({
  id,
  label,
  sp,
  apply,
}: {
  id: string;
  label: string;
  sp: { status?: string; event?: string };
  apply: { status?: string };
}) {
  const next = { ...sp, ...apply };
  if (apply.status === undefined) delete next.status;
  const qs = new URLSearchParams(next as Record<string, string>).toString();
  const href = `/dashboard/webinars/${id}/webhooks${qs ? "?" + qs : ""}`;
  return (
    <Link href={href} className="rounded border px-3 py-1">
      {label}
    </Link>
  );
}
```

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter web typecheck
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/dashboard/webinars/\[id\]/webhooks apps/web/src/components/webinar/webhook-row.tsx
git commit -m "feat(web): add webhook delivery log + replay UI"
```

---

## Task 22: env + README updates

**Files:**

- Modify: `.env.example`
- Modify: `README.md` (or `apps/web/README.md`)

- [ ] **Step 1: Append to `.env.example`**

Find the existing `.env.example` (last entry should be `WORKER_CONCURRENCY` from B2). Append:

```env
# ============ Public (lead session) ============
LEAD_SESSION_SECRET="change-me-min-32-chars-bbbbbbbbbbb"
```

- [ ] **Step 2: Update README — add public routes + new env var**

Find or create the relevant README section. Add (or extend "Environment" / "Routes"):

```markdown
### Public routes (sub-plan C)

- `/<slug>` — capture form for a published webinar
- `/<slug>/live` — live-style synchronized HLS player (requires opt-in cookie `hw_lead`)

Reserved slugs (cannot be used as webinar slug): `login`, `dashboard`, `api`, `_next`, `admin`, `signup`, `register`, `static`, `favicon.ico`, `robots.txt`, `sitemap.xml`.

### New env vars (sub-plan C)

- `LEAD_SESSION_SECRET` — HMAC secret for the public lead-session cookie. Min 16 chars; generate with `openssl rand -base64 32`.
```

- [ ] **Step 3: Update local `apps/web/.env.local` (user task — NOT committed)**

Append to local `.env.local`:

```
LEAD_SESSION_SECRET="<generate via: openssl rand -base64 32>"
```

(Document this for the implementer; do not stage.)

- [ ] **Step 4: Verify env validation**

The `submitOptin` server action calls `signLeadCookie` which throws if `LEAD_SESSION_SECRET` is missing. Run:

```bash
pnpm --filter web test src/test/lib/lead-session.test.ts
```

Expected: 6 passing (the test sets the env via `beforeEach`).

- [ ] **Step 5: Commit**

```bash
git add .env.example README.md
git commit -m "docs: document public routes + LEAD_SESSION_SECRET env var"
```

---

## Task 23: Playwright E2E specs

**Files:**

- Create: `apps/web/e2e/public-funnel.spec.ts`
- Create: `apps/web/e2e/webhook-replay.spec.ts`
- Create: `apps/web/e2e/unico-phases.spec.ts`

- [ ] **Step 1: Implement `apps/web/e2e/public-funnel.spec.ts`**

```ts
import { test, expect } from "@playwright/test";

test("opt-in → live page renders video element + chat panel", async ({
  page,
  request,
}) => {
  // assumes a JIT webinar with slug "e2e-funnel" and an EXTERNAL HLS URL exists in seed
  // (the seed for e2e is responsibility of test setup; this test uses an existing seeded webinar)
  await page.goto("/e2e-funnel");

  await page.fill('input[name="name"]', "E2E Tester");
  await page.fill('input[name="email"]', `e2e+${Date.now()}@example.com`);
  // phone field uses libphonenumber input; type into the visible input child
  const phoneRoot = page.locator(".PhoneInput input");
  if (await phoneRoot.count()) {
    await phoneRoot.first().fill("11999990000");
  }
  await page.click('button[type="submit"]');

  await expect(page).toHaveURL(/\/e2e-funnel\/live$/);
  await expect(page.locator("video")).toBeVisible();
  await expect(page.locator("aside")).toContainText("Chat ao vivo");
});
```

- [ ] **Step 2: Implement `apps/web/e2e/webhook-replay.spec.ts`**

```ts
import { test, expect } from "@playwright/test";

test("admin sees failed webhook delivery and can retry", async ({ page }) => {
  // assumes admin is already logged in via Playwright global setup
  // and a webinar with id "e2e-webhook" has a FAILED WebhookDelivery seeded
  await page.goto("/dashboard/webinars/e2e-webhook/webhooks");
  await expect(page.locator("text=FAILED")).toBeVisible();
  const retryBtn = page.locator('button:has-text("Reenviar")').first();
  await retryBtn.click();
  await expect(page.locator("text=Reenviado")).toBeVisible({ timeout: 5000 });
});
```

- [ ] **Step 3: Implement `apps/web/e2e/unico-phases.spec.ts`**

```ts
import { test, expect } from "@playwright/test";

test("UNICO before startDate shows countdown view", async ({ page }) => {
  // assumes seed has webinar slug "e2e-future" with startDate 1h in future
  await page.goto("/e2e-future");
  await expect(page.locator("h1")).toContainText("Sala de Espera");
});

test("UNICO after endDate shows closed view", async ({ page }) => {
  // assumes seed has webinar slug "e2e-past" with endDate in the past
  await page.goto("/e2e-past");
  await expect(page.locator("p")).toContainText(
    "Este webinar já foi encerrado",
  );
});
```

- [ ] **Step 4: Note seed responsibility**

Add a note in `apps/web/e2e/README.md` (create if needed):

````markdown
## E2E seed expectations

These specs assume the following webinars are seeded in the test DB:

- `e2e-funnel` — JIT, ACTIVE, with EXTERNAL hlsUrl pointing to a small public HLS asset
- `e2e-webhook` — id (admin must own), with one FAILED WebhookDelivery row
- `e2e-future` — UNICO, ACTIVE, startDate +1h
- `e2e-past` — UNICO, ACTIVE, startDate −2h, endDate −1h

Run via:

```bash
pnpm --filter web e2e
```
````

Specs that depend on infrastructure not present at run-time should `test.skip()` themselves; see existing B2 pattern in `apps/web/e2e/README.md` if present.

````

- [ ] **Step 5: Commit**

```bash
git add apps/web/e2e
git commit -m "test(web): add E2E specs for public funnel, webhook replay, UNICO phases"
````

---

## Task 24: Final acceptance + final code review

- [ ] **Step 1: Walk through DoD**

1. Migration `c_lead_player_webhook` applies. ✓ Task 1.
2. `/<slug>` validates blacklist + renders capture honoring all flags. ✓ Tasks 2, 15.
3. `submitOptin` creates/updates Lead, sets cookie, enqueues webhook, redirects. ✓ Task 9.
4. `/<slug>/live` resolves via cookie OR redirects to capture. ✓ Task 16.
5. UNICO phases: countdown / player / closed. ✓ Tasks 5, 15, 16.
6. JIT: t=0 = `lead.sessionStart`. ✓ Task 5.
7. HLS player loads via hls.js + custom controls (no scrubber/speed). ✓ Task 17.
8. Chat past batch + future drips. ✓ Task 18.
9. Lead chat input persists in `LeadChatMessage` scoped to leadId. ✓ Tasks 14, 18.
10. CTA banner full-width sync, click = event + opens new tab. ✓ Tasks 12, 18.
11. Tracker tick 30s + visibility/beforeunload beacon. ✓ Tasks 13, 18.
12. Server throttle 25s between ticks. ✓ Task 11.
13. 7 webhooks configurable on `/dashboard/webinars/[id]/integrations`. ✓ Task 19.
14. WebhookDelivery persists payload+response, retry 3x exp via BullMQ. ✓ Tasks 8, 20.
15. `/dashboard/webinars/[id]/webhooks` lists + filters + replay. ✓ Tasks 10, 21.
16. `pnpm -r --workspace-concurrency=1 typecheck` + `test` clean. ✓ Run in step 2 below.
17. Playwright specs green. ✓ Task 23 (assumes seed available).
18. README + `.env.example` updated. ✓ Task 22.

- [ ] **Step 2: Run the entire suite**

```bash
pnpm -r --workspace-concurrency=1 typecheck
pnpm -r --workspace-concurrency=1 test
```

Expected: typecheck clean across all packages. Tests pass: scraper 58, web 62 (B2 baseline) + 11 new C unit/integration tests = 73, worker 18 + 4 new = 22.

- [ ] **Step 3: Final commit if anything changed during acceptance**

```bash
git status
git add -p
git commit -m "chore: C acceptance fixes" || true
```

(`|| true` allows the step to no-op when nothing changed.)

---

## Self-Review (notes for the implementer)

- **Spec coverage:** every DoD item maps to a numbered task. Webhook config moved to a dedicated `/integrations` page (deviates from spec which said "wizard step 6") because step 6 already owns scripted chat. Documented in pre-flight.
- **Test isolation:** all new web tests `prisma.user.deleteMany({})` in `beforeEach`. The `fileParallelism: false` from B1/B2 still applies — keep. Cross-package parallelism: continue using `--workspace-concurrency=1` (already documented).
- **Cookie scope:** `path=/<slug>` means the cookie is scoped per webinar — a lead from one webinar can't be reused in another. Trade-off: opening a tab to a different webinar requires a fresh opt-in. Acceptable since each webinar is a separate funnel.
- **Lead chat scope:** lead-input is **per-lead**, not broadcast. Other leads do not see another lead's input. The `/api/lead-chat` route enforces this via `leadId` from cookie; the player page only fetches `prisma.leadChatMessage.findMany({ where: { leadId } })`.
- **Webhook payload field naming uses snake_case event names** (`lead_novo`, `lead_clicou_oferta`, etc.) per spec. Field names inside the payload remain camelCase (`webinarSlug`, `videoSec`).
- **Date.now-based dynamic imports** in vitest are needed because module-level imports (e.g., `import "@/lib/auth"`) are mocked once per file — re-importing with a cache-bust query invalidates the module cache so subsequent tests see fresh mock state. This pattern is established by B1/B2.
- **Public-DTO regression risk:** if `Webinar` schema gains a sensitive field in the future, `publicWebinarDto` will silently include it via `Webinar` typing. Mitigation: the test in Task 6 asserts specific exclusions; extend that test when adding new fields.
- **`navigator.sendBeacon` body shape:** Beacons send blob/text — not parsed by `request.json()`. The `/api/track-leave` route handles this by reading `request.text()` then attempting JSON.parse. This is intentional and exercised by the test.
- **Sub-plan F inherits this work** — Coolify deploy will need `LEAD_SESSION_SECRET` set as a secret, and the worker container already runs the webhook Worker via the unified `apps/worker/src/index.ts` registered in B2's docker-compose worker service.
