# MVP Sub-plan B1 — Admin Webinar CRUD Design

**Project:** hotwebinar-clone
**Date:** 2026-05-04
**Status:** Approved (pending user review of written spec)
**Phase:** Sub-plan B1 of the MVP slim implementation
**Predecessor:** [Sub-plan A — Foundation](2026-05-03-mvp-slim-design.md)

## Goal

Ship the admin-facing CRUD for webinars: a 6-step wizard that auto-saves a `DRAFT` Webinar to the DB after every step, a webinars list with search/sort/filters/actions, an `AccountSettings` form, and stub pages for the routes the sidebar advertises but later sub-plans deliver. Step 4 (Video) accepts an external URL only — the upload + HLS transcode pipeline is sub-plan B2.

## Non-goals (explicit, all routed to later sub-plans)

- Video upload, MinIO storage driver, BullMQ + Redis, ffmpeg transcode worker, HLS playlist generation — **sub-plan B2**
- Lead opt-in flow, public player at `/w/[slug]`, chat overlay, CTA overlay, watch-event tracking, `hw_lead` cookie — **sub-plan C**
- Real dashboard KPIs, funnel, devices breakdown, country breakdown — **sub-plan E**
- Per-webinar metrics page (real chart + heatmap), Leads list real — **sub-plan E**
- Coolify deploy, Dockerfile multi-stage standalone, docker-compose with Redis/MinIO services, health probes — **sub-plan F**
- Cleanup cron for abandoned drafts older than N days, optimistic locking, multi-tenant Company isolation, A/B testing, integrations — **post-MVP**

## Context

Sub-plan A delivered the foundation: `apps/web` Next.js 15, `packages/db` Prisma with Better Auth tables, Better Auth wired with email/password, super-admin seed, login + middleware + AdminShell. The sidebar references `/dashboard/webinars`, `/dashboard/videos`, `/dashboard/settings` — none exist yet, all currently 404.

This sub-plan adds the full domain Prisma schema (Video, Webinar, Cta, ChatMessage, Lead, Event, AccountSettings) in one migration, even though only Webinar/Cta/ChatMessage/Video are exercised here. Lead/Event tables stay empty until sub-plan C populates them, but their existence avoids re-migrating later.

The MVP umbrella spec (`2026-05-03-mvp-slim-design.md`) covers all design decisions; this document refines them for the B1 slice.

## Architecture

Single Next.js App Router monolith — same shape as sub-plan A. Reads via React Server Components (Prisma queries directly). Mutations via Server Actions. Wizard forms are Client Components using react-hook-form + Zod resolver. Filters on the list page are URL-driven via `searchParams` so RSC re-renders on change and bookmarks work.

```
apps/web/src/
├── app/
│   ├── dashboard/
│   │   ├── page.tsx                              kept (sub-plan A placeholder)
│   │   ├── webinars/
│   │   │   ├── page.tsx                          NEW list (RSC + searchParams)
│   │   │   ├── new/page.tsx                      NEW server-action redirect that creates DRAFT
│   │   │   └── [id]/
│   │   │       ├── page.tsx                      NEW redirect → /step-1
│   │   │       ├── (wizard)/
│   │   │       │   ├── layout.tsx                NEW wizard chrome (progress + nav)
│   │   │       │   ├── step-1/page.tsx           NEW Início
│   │   │       │   ├── step-2/page.tsx           NEW Webinar
│   │   │       │   ├── step-3/page.tsx           NEW Login
│   │   │       │   ├── step-4/page.tsx           NEW Vídeo
│   │   │       │   ├── step-5/page.tsx           NEW Oferta
│   │   │       │   └── step-6/page.tsx           NEW Chat
│   │   │       ├── leads/page.tsx                NEW stub "Em breve — sub-plan E"
│   │   │       └── metrics/page.tsx              NEW stub "Em breve — sub-plan E"
│   │   ├── videos/page.tsx                       NEW stub "Em breve — sub-plan B2"
│   │   └── settings/page.tsx                     NEW form AccountSettings
├── server/actions/
│   ├── webinar.ts                                NEW createDraft / updateStep[1-6] / publish / delete / duplicate
│   └── settings.ts                               NEW upsertAccountSettings
├── lib/validations/
│   ├── webinar.ts                                NEW Zod schemas per step
│   └── settings.ts                               NEW Zod schema
├── components/
│   ├── webinars/
│   │   ├── webinars-table.tsx                    NEW client (filter UI; data is RSC prop)
│   │   ├── webinars-filters.tsx                  NEW search/sort/status/tipo/period (URL-driven)
│   │   ├── row-actions.tsx                       NEW dropdown (edit/copy/dup/del/leads/metrics)
│   │   └── delete-confirm-dialog.tsx             NEW shadcn AlertDialog wrapper
│   ├── wizard/
│   │   ├── wizard-shell.tsx                      NEW progress bar + nav buttons
│   │   ├── step-1-form.tsx                       NEW
│   │   ├── step-2-form.tsx                       NEW
│   │   ├── step-3-form.tsx                       NEW
│   │   ├── step-4-form.tsx                       NEW URL externa input + Upload tab disabled
│   │   ├── step-5-form.tsx                       NEW CTA editable table
│   │   └── step-6-form.tsx                       NEW Chat editable table + paste TSV
│   └── ui/
│       ├── alert-dialog.tsx                      NEW shadcn add
│       ├── badge.tsx                             NEW shadcn add
│       ├── card.tsx                              NEW shadcn add
│       ├── dropdown-menu.tsx                     NEW shadcn add
│       ├── form.tsx                              NEW shadcn add
│       ├── select.tsx                            NEW shadcn add
│       ├── switch.tsx                            NEW shadcn add
│       ├── table.tsx                             NEW shadcn add
│       ├── tabs.tsx                              NEW shadcn add
│       ├── calendar.tsx                          NEW shadcn add
│       └── seconds-input.tsx                     NEW custom mm:ss input

packages/db/prisma/schema.prisma                  EXTEND
packages/db/prisma/migrations/<ts>_domain/        NEW migration
```

### Dependencies added (apps/web)

```
"react-hook-form": "^7.53.0",
"@hookform/resolvers": "^3.9.0",
"date-fns": "^4.1.0",
"react-day-picker": "^9.x",
"slugify": "^1.6.6",
"@radix-ui/react-tabs": "^1.x",
"@radix-ui/react-switch": "^1.x",
"@radix-ui/react-select": "^2.x",
"@radix-ui/react-dropdown-menu": "^2.x",
"@radix-ui/react-alert-dialog": "^1.x",
"jsdom": "25.0.1",
"@testing-library/react": "16.0.1",
"@testing-library/user-event": "14.5.2"
```

### Principles

- One app, one deploy. No new services in B1 (Redis + MinIO arrive in B2).
- Server Actions for every mutation; no REST endpoints added.
- Filters and pagination are URL-driven (`?q=&status=&tipo=&from=&to=&sort=&page=`). RSC reads `searchParams`, returns the filtered list.
- Each wizard step persists to DB via its own server action — no localStorage wizard state.
- Click "Criar novo" creates an empty `Webinar { status: DRAFT }` and redirects to step 1; abandoned drafts accepted as MVP-acceptable tech debt.
- shadcn primitives added incrementally (`pnpm dlx shadcn@latest add <name>`) — never `--all` (would clobber sub-plan A's Button/Input/Label).

## Data model (Prisma diff)

Add to `packages/db/prisma/schema.prisma`:

```prisma
enum WebinarMode    { UNICO  JIT }
enum WebinarStatus  { DRAFT  ACTIVE  ARCHIVED }
enum VideoSource    { EXTERNAL  UPLOAD }
enum VideoStatus    { QUEUED  PROCESSING  READY  FAILED }
enum EventKind      { OPTIN  PAGE_VIEW  VIDEO_START  VIDEO_TICK  VIDEO_END  CTA_CLICK  PITCH_REACHED }

model AccountSettings {
  id               String   @id @default(cuid())
  userId           String   @unique
  defaultLanguage  String   @default("pt-BR")
  defaultTimezone  String   @default("America/Sao_Paulo")
  brandName        String?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  user             User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@map("account_settings")
}

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
  @@map("video")
}

model Webinar {
  id               String         @id @default(cuid())
  ownerId          String
  videoId          String?
  slug             String?        @unique
  name             String         @default("")
  title            String         @default("")
  language         String         @default("pt-BR")
  status           WebinarStatus  @default(DRAFT)
  mode             WebinarMode    @default(UNICO)
  startDate        DateTime?
  endDate          DateTime?
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
  @@map("webinar")
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
  @@map("chat_message")
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
  @@map("cta")
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
  @@map("lead")
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
  @@map("event")
}
```

Differences from the umbrella MVP spec:

- `Webinar.slug` is `String?` (nullable). DRAFT may have null; the publish action enforces non-null + uniqueness.
- `Webinar.name`, `title`, `mode`, `startDate`, `endDate` either default to empty/UNICO or are nullable so a freshly created DRAFT is valid. The publish action enforces real values.

User must add a back-relation to `User` for `accountSettings`:

```prisma
model User {
  ...
  accountSettings AccountSettings?
}
```

## Validation (Zod)

`apps/web/src/lib/validations/webinar.ts`:

```ts
import { z } from "zod";

export const slugSchema = z
  .string()
  .min(3)
  .max(60)
  .regex(/^[a-z0-9-]+$/, "Slug: minúsculas, números e hífen apenas");

export const step1Schema = z.object({
  name: z.string().min(2).max(120),
  title: z.string().min(2).max(180),
  slug: slugSchema,
  language: z.string().min(2).max(10),
});

export const step2Schema = z
  .object({
    mode: z.enum(["UNICO", "JIT"]),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    timezone: z.string().min(1),
    waitingTitle: z.string().min(1).max(80),
    waitingSubtitle: z.string().max(200),
  })
  .refine((v) => v.endDate > v.startDate, {
    message: "Fim deve ser após início",
    path: ["endDate"],
  });

export const step3Schema = z.object({
  logoUrl: z.string().url().optional().or(z.literal("")),
  primaryColor: z.string().regex(/^#[0-9a-f]{6}$/i).optional().or(z.literal("")),
  loginButtonText: z.string().min(1).max(40),
  loginButtonColor: z.string().regex(/^#[0-9a-f]{6}$/i),
  nameEnabled: z.boolean(),
  nameRequired: z.boolean(),
  emailEnabled: z.boolean(),
  emailRequired: z.boolean(),
  phoneEnabled: z.boolean(),
  phoneRequired: z.boolean(),
  namePlaceholder: z.string(),
  emailPlaceholder: z.string(),
  phonePlaceholder: z.string(),
});

export const step4Schema = z.object({
  videoExternalUrl: z.string().url("Cole uma URL válida"),
  pitchAtSec: z.number().int().min(0).optional(),
});

export const ctaItemSchema = z.object({
  id: z.string().optional(),
  label: z.string().min(1).max(80),
  url: z.string().url(),
  showAtSec: z.number().int().min(0),
  hideAtSec: z.number().int().min(0).optional(),
});
export const step5Schema = z.object({ ctas: z.array(ctaItemSchema) });

export const chatItemSchema = z.object({
  id: z.string().optional(),
  authorName: z.string().min(1).max(80),
  text: z.string().min(1).max(500),
  showAtSec: z.number().int().min(0),
  isOwner: z.boolean().default(false),
});
export const step6Schema = z.object({ messages: z.array(chatItemSchema) });
```

`apps/web/src/lib/validations/settings.ts`:

```ts
import { z } from "zod";

export const accountSettingsSchema = z.object({
  defaultLanguage: z.string().min(2).max(10),
  defaultTimezone: z.string().min(1),
  brandName: z.string().max(120).optional().or(z.literal("")),
});
```

## Server Actions

All actions live in `apps/web/src/server/actions/{webinar,settings}.ts`. Each one:

1. Awaits `auth.api.getSession({ headers: await headers() })`. Throws `Unauthorized` if missing.
2. Parses the input via `safeParse`. Returns `{ error: { field?, message } }` on failure.
3. Verifies ownership where applicable: `webinar.ownerId === session.user.id`. Returns `{ error: "not_found" }` otherwise (avoids enumerating).
4. Runs Prisma operations, often in `prisma.$transaction([...])`.
5. `revalidatePath("/dashboard/webinars")` (or the affected route) before returning.
6. Returns `{ ok: true, data? }` on success.

Action surface:

```ts
// webinar.ts
createDraftWebinar(): Promise<{ id: string }>
updateWebinarStep1(id: string, data: Step1Input): Promise<Result>
updateWebinarStep2(id: string, data: Step2Input): Promise<Result>
updateWebinarStep3(id: string, data: Step3Input): Promise<Result>
updateWebinarStep4(id: string, data: Step4Input): Promise<Result>   // upserts EXTERNAL Video, connects to Webinar
updateWebinarStep5(id: string, data: Step5Input): Promise<Result>   // upsert CTA rows (preserve existing IDs; delete missing IDs)
updateWebinarStep6(id: string, data: Step6Input): Promise<Result>   // upsert ChatMessage rows (same strategy)
publishWebinar(id: string): Promise<Result>                         // DRAFT → ACTIVE; validates required fields; returns missing-field list on error
deleteWebinar(id: string): Promise<Result>                          // cascade chat + ctas + leads + events; keeps Video
duplicateWebinar(id: string): Promise<{ newId: string }>            // copies webinar with " (cópia)" suffix; preserves CTAs + chat; clears slug

// settings.ts
upsertAccountSettings(data: AccountSettingsInput): Promise<Result>  // 1 row per user
```

CTA / Chat upsert strategy preserves IDs so future `Event.ctaId` references aren't broken: rows arriving with an `id` are updated; rows arriving without `id` are created; existing rows whose `id` is absent from the payload are deleted. All in a single `$transaction`.

## Wizard data flow

1. List page action **"Criar novo"** calls `createDraftWebinar()` → server inserts an empty DRAFT inheriting `language`/`timezone` from `AccountSettings` (or platform defaults if no row), `revalidatePath("/dashboard/webinars")`, then `redirect("/dashboard/webinars/" + id + "/step-1")`.
2. `/dashboard/webinars/[id]/(wizard)/step-1/page.tsx` is RSC: fetches the Webinar (verifies ownership), renders `<Step1Form initial={webinar} />`.
3. `<Step1Form>` is client: `react-hook-form` with `defaultValues={initial}`, `resolver: zodResolver(step1Schema)`. On submit: `await updateWebinarStep1(id, data)`. If `ok`: `router.push("/dashboard/webinars/" + id + "/step-2")`. If error with a `field`, `setError` on that field; otherwise toast.
4. Steps 2–5 follow the same pattern.
5. Step 6's submit button reads "Salvar e Ativar". It calls `updateWebinarStep6(id, data)`, then on success calls `publishWebinar(id)`. Publish failure (missing required fields) shows a toast listing the gaps and the step number to revisit.

## UI screens

### `/dashboard/webinars` (list)

- Header: page title + `<NewWebinarButton>` (form action calls `createDraftWebinar` then redirects).
- Filters bar (URL-driven via shadcn Select + Input + Calendar):
  - `q` (search, name + title contains, case-insensitive)
  - `status` (Todos / Rascunho / Ativo / Arquivado)
  - `tipo` (Todos / Único / JIT)
  - `from`, `to` (period — covers `startDate` overlap)
  - `sort` (Mais recentes / Mais antigos / A–Z / Z–A)
- Table (shadcn Table):
  - thumbnail (placeholder if `Video.hlsUrl` not previewable), nome, datas, status badge, tipo badge, actions dropdown
- Footer: `Total: N · Página K de M · Anterior · Próximo`. `pageSize = 20`.
- Empty state: card with "Crie seu primeiro webinar" + button.

### Wizard chrome (`(wizard)/layout.tsx`)

Topbar shows progress: `① Início — ② Webinar — ③ Login — ④ Vídeo — ⑤ Oferta — ⑥ Chat`. Current step has filled circle + bold label. Bottom nav: `Voltar` (router.push prev step, disabled on step 1) and `Continuar` (submit current step's form, enabled when valid). Step 6 replaces `Continuar` with `Salvar e Ativar` (calls update + publish).

### Step forms

- **Step 1 — Início:** name, title, slug (auto-generated from title via `slugify` on blur; user editable; preview `https://hotwebinar.com.br/w/<slug>`), language select (PT-BR, EN-US, ES-ES, fallback from `AccountSettings.defaultLanguage`).
- **Step 2 — Webinar:** Tabs `Único` / `Just in Time` (sets `mode`); shared body: `startDate`, `endDate` (DateTimePickers), `timezone` (Select with IANA list), `waitingTitle`, `waitingSubtitle`. Each tab includes a short explanatory paragraph.
- **Step 3 — Login:** sections "Identidade visual" (logoUrl, primaryColor), "Botão entrar" (loginButtonText, loginButtonColor), "Form opt-in" — for each of name/email/phone: `enabled` Switch | `required` Switch (disabled when `enabled=false`) | placeholder Input.
- **Step 4 — Vídeo:** Tabs `URL externa` (active) and `Upload` (disabled badge "Em breve — sub-plan B2"). URL-externa tab: input + `<video controls>` preview using the entered URL. Field `pitchAtSec` (mm:ss input).
- **Step 5 — Oferta:** editable rows table — Label / URL / Mostrar (mm:ss) / Ocultar (mm:ss) / × delete. Button "Adicionar CTA" pushes empty row.
- **Step 6 — Chat:** editable rows table — Autor / Mensagem / Mostrar (mm:ss) / × delete. Button "Adicionar mensagem". Button "Importar TSV" opens shadcn Dialog with textarea; submits parses tab-separated `nome\tmensagem\tsegundos` rows into table state. Hint near the message field documents `{lead.name}` interpolation (rendered in sub-plan C).

### Public player route

Out of scope for B1 — `/w/[slug]` arrives in sub-plan C.

### Sidebar destinations stubs

- `/dashboard/videos` page renders a card "Em breve — sub-plan B2".
- `/dashboard/webinars/[id]/leads` page renders "Em breve — sub-plan E" (no real list yet).
- `/dashboard/webinars/[id]/metrics` page renders "Em breve — sub-plan E".

### `/dashboard/settings`

Single-form RSC + Server Action: fetches the user's `AccountSettings` row (creates default on first access), renders form, submits `upsertAccountSettings`. Fields: `defaultLanguage`, `defaultTimezone`, `brandName`.

## Error handling and edge cases

- Server action without session → `Unauthorized` thrown server-side. The Form component catches and shows a toast "Sessão expirada" then `router.push("/login")`.
- User opens `/dashboard/webinars/[id]` belonging to another user → RSC calls `notFound()` (404 page).
- Wizard step that doesn't exist (`/step-7`) → `notFound()`.
- Webinar deleted from another tab while the user is editing → next server action returns `not_found`; UI toasts "Webinar removido" and redirects to list.
- Browser unload while form is dirty → `beforeunload` warning (`react-hook-form` `formState.isDirty`).
- Slug collision on publish → server catches Prisma `P2002` and returns `{ error: { field: "slug", message: "Já existe um webinar com esse slug" } }`. Form shows the error on step 1's slug field.
- `endDate <= startDate` rejected by step 2 Zod refine.
- Publish without required fields returns a list `{ missing: ["title", "videoId", ...] }`. UI shows a toast "Faltam campos: ..." and links to the relevant step.
- Step 5/6 upsert with an `id` that doesn't belong to this webinar → server filters by `webinarId` so cross-webinar attacks fail naturally.
- Empty CTA / Chat lists are valid (the webinar can publish without them).
- Two browser tabs editing same webinar → last write wins. No optimistic lock in MVP.
- Settings page first-load: server action returns existing row OR defaults; user submitting saves a real row.
- `createDraftWebinar` rate limit not enforced (single super-admin, very low risk). If many phantom drafts accumulate, the user can delete from the list.

## Testing

| Module | Tests |
|---|---|
| `lib/validations/webinar.ts` | step1 slug regex; step2 endDate after startDate; step3 hex colors; step5/6 array shapes; step4 URL required |
| `lib/validations/settings.ts` | timezone non-empty; defaultLanguage min length |
| `server/actions/webinar.ts` | createDraft requires session; updateStep1 ownership rejected; step2 endDate validation; publishWebinar lists missing fields and rejects; deleteWebinar cascade; duplicateWebinar copies CTAs + chat preserving counts; cross-webinar id injection rejected |
| `server/actions/settings.ts` | upsert idempotent; unauthenticated rejected |
| `webinars-table.tsx` (component test) | render with mock RSC props; row actions menu fires expected callbacks |
| `webinars-filters.tsx` (component test) | URL params written correctly when changing controls |
| `step-N-form.tsx` (component tests, all 6) | initial values render; submit calls passed-in action; field errors display |
| E2E `admin-webinar-crud.spec.ts` | full create → publish → list → edit → duplicate → delete flow against running app |

Stack additions:

- `jsdom` + `@testing-library/react` + `@testing-library/user-event` for component tests
- `vitest.config.ts` gains `environmentMatchGlobs` so `src/test/components/**` runs in jsdom while `src/test/**` keeps node

Integration tests (server actions) extend `seed.test.ts`'s pattern: pre-clean domain tables in correct cascade order, seed a test admin, mock `next/headers` and `@/lib/auth` to inject session.

## Definition of Done

1. Migration adds Video, Webinar, ChatMessage, Cta, Lead, Event, AccountSettings + all enums. `pnpm db:migrate:dev` applies cleanly on a fresh DB.
2. `/dashboard/webinars` empty state renders + "Criar novo" button.
3. Click "Criar novo" creates a DRAFT inheriting language/timezone from `AccountSettings` (or defaults) and redirects to step-1.
4. Wizard steps 1–6 each render, validate Zod, save on "Continuar". "Voltar" restores the previous step. Browser unload warns when form is dirty.
5. Step 4 accepts an external URL, creates a `Video { source: EXTERNAL, status: READY, originalUrl: <url>, hlsUrl: <url> }` and connects via `Webinar.videoId`.
6. Step 5 CTA editable table works (add/remove/edit). Persists via upsert preserving existing IDs.
7. Step 6 Chat editable table works including TSV paste import. Persists via upsert preserving existing IDs.
8. Step 6 "Salvar e Ativar" validates everything, publishes (DRAFT→ACTIVE) or surfaces missing-field errors with the step they belong to.
9. List page shows webinars with status badge + tipo badge. Search, sort, status filter, tipo filter, period filter, pagination 20/page all work via URL params.
10. Row actions: edit (opens wizard step-1), copy public link to clipboard with toast, duplicate (creates DRAFT copy, redirects to step-1), delete (AlertDialog confirms, cascade succeeds, list re-renders), leads / metrics (open the stub pages).
11. `/dashboard/settings` loads existing row or defaults, edits brandName/defaultLanguage/defaultTimezone, saves successfully.
12. `/dashboard/videos` renders the "Em breve — sub-plan B2" stub.
13. Sidebar links resolve without 404s for the routes the sidebar advertises.
14. `pnpm -r test` and `pnpm --filter web test:e2e` pass. `pnpm -r typecheck` clean.
15. `apps/scraper/` and the foundation files of `apps/web/` (auth, login, AdminShell) remain unchanged.

## Out of scope (sequenced)

- B2: video upload + MinIO + BullMQ + ffmpeg HLS worker + library + step 4 upload tab
- C: lead opt-in, public player at `/w/[slug]`, watch events
- E: real metrics + leads list
- F: Coolify deploy, Dockerfile multi-stage, Redis service
- Post-MVP: optimistic lock, draft cleanup cron, multi-tenant Company isolation, A/B testing, integrations
