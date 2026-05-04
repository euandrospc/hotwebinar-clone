# MVP Sub-plan B1 — Admin Webinar CRUD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship admin Webinar CRUD: 6-step auto-save wizard, list page with search/sort/filters/actions, AccountSettings form, and stubs for the routes the sidebar advertises.

**Architecture:** Single Next.js 15 App Router monolith (extending sub-plan A). RSC for reads, Server Actions for writes. Wizard forms are Client Components (react-hook-form + Zod resolver). Filters URL-driven via `searchParams`. Each wizard step persists to DB on "Continuar".

**Tech Stack:** Next.js 15 + RSC + Server Actions, TypeScript, Prisma 5 + Postgres, react-hook-form, Zod, Tailwind + shadcn/ui (Card/Form/Tabs/Switch/Select/DropdownMenu/AlertDialog/Badge/Table/Calendar), date-fns, slugify, vitest (unit + integration + jsdom component tests), Playwright (E2E).

**Spec:** [`docs/superpowers/specs/2026-05-04-mvp-B1-admin-crud-design.md`](../specs/2026-05-04-mvp-B1-admin-crud-design.md)

**Sub-plan series (current = B1):**
- A — Foundation ✅ delivered
- **B1 — Admin Webinar CRUD (this plan)**
- B2 — Video upload + HLS transcode worker — future
- C — Lead opt-in + public player — future
- E — Real analytics dashboard + leads list — future
- F — Coolify deploy — future

---

## Pre-flight

The repo has sub-plan A merged on `feat/capture-phase`. Postgres `hotwebinar-pg` is running on :5432 with the `init_better_auth` migration applied. The user's `.env.local` exists at both `apps/web/.env.local` and the repo root. Sub-plan A handed off with 16 commits + 71 tests passing.

The user prefers a commit per task. Each task ends with a single commit.

This plan adds 4 deferrable items as tracked tech debt:
- B2: video upload + HLS transcode pipeline
- C: lead opt-in + public player
- E: real analytics
- F: Coolify deploy

Stub pages (videos, leads/metrics per webinar) render an "Em breve — sub-plan X" placeholder so the sidebar stops 404'ing.

## File Structure

```
packages/db/prisma/schema.prisma                        EXTEND (full domain)
packages/db/prisma/migrations/<ts>_domain/migration.sql NEW

apps/web/
├── package.json                                          + react-hook-form, @hookform/resolvers, date-fns, react-day-picker, slugify, jsdom, @testing-library/*
├── vitest.config.ts                                      + environmentMatchGlobs for jsdom
├── src/
│   ├── lib/validations/
│   │   ├── webinar.ts                                    NEW Zod schemas per step
│   │   └── settings.ts                                   NEW Zod schema for settings
│   ├── server/actions/
│   │   ├── webinar.ts                                    NEW createDraft / updateStep[1-6] / publish / delete / duplicate
│   │   └── settings.ts                                   NEW upsertAccountSettings + getAccountSettings
│   ├── components/
│   │   ├── ui/
│   │   │   ├── alert-dialog.tsx                          NEW shadcn add
│   │   │   ├── badge.tsx                                 NEW shadcn add
│   │   │   ├── card.tsx                                  NEW shadcn add
│   │   │   ├── dropdown-menu.tsx                         NEW shadcn add
│   │   │   ├── form.tsx                                  NEW shadcn add
│   │   │   ├── select.tsx                                NEW shadcn add
│   │   │   ├── switch.tsx                                NEW shadcn add
│   │   │   ├── table.tsx                                 NEW shadcn add
│   │   │   ├── tabs.tsx                                  NEW shadcn add
│   │   │   ├── calendar.tsx                              NEW shadcn add
│   │   │   ├── popover.tsx                               NEW shadcn add (Calendar dep)
│   │   │   ├── date-time-picker.tsx                      NEW custom (Calendar + time input)
│   │   │   ├── seconds-input.tsx                         NEW custom mm:ss input
│   │   │   └── sonner.tsx                                NEW shadcn add (toast)
│   │   ├── webinars/
│   │   │   ├── webinars-table.tsx                        NEW
│   │   │   ├── webinars-filters.tsx                      NEW
│   │   │   ├── row-actions.tsx                           NEW
│   │   │   ├── delete-confirm-dialog.tsx                 NEW
│   │   │   └── new-webinar-button.tsx                    NEW (form action triggering createDraftWebinar)
│   │   └── wizard/
│   │       ├── wizard-shell.tsx                          NEW progress bar + step links
│   │       ├── wizard-nav.tsx                            NEW Voltar / Continuar / Salvar e Ativar
│   │       ├── step-1-form.tsx                           NEW
│   │       ├── step-2-form.tsx                           NEW
│   │       ├── step-3-form.tsx                           NEW
│   │       ├── step-4-form.tsx                           NEW URL externa + Upload tab disabled
│   │       ├── step-5-form.tsx                           NEW CTA editable table
│   │       └── step-6-form.tsx                           NEW Chat editable + TSV import
│   ├── app/
│   │   ├── layout.tsx                                    + <Toaster /> (sonner)
│   │   └── dashboard/
│   │       ├── webinars/
│   │       │   ├── page.tsx                              NEW list (RSC + searchParams)
│   │       │   ├── new/page.tsx                          NEW Server Action redirect
│   │       │   └── [id]/
│   │       │       ├── page.tsx                          NEW redirect → /step-1
│   │       │       ├── (wizard)/
│   │       │       │   ├── layout.tsx                    NEW wizard chrome
│   │       │       │   ├── step-1/page.tsx               NEW
│   │       │       │   ├── step-2/page.tsx               NEW
│   │       │       │   ├── step-3/page.tsx               NEW
│   │       │       │   ├── step-4/page.tsx               NEW
│   │       │       │   ├── step-5/page.tsx               NEW
│   │       │       │   └── step-6/page.tsx               NEW
│   │       │       ├── leads/page.tsx                    NEW stub
│   │       │       └── metrics/page.tsx                  NEW stub
│   │       ├── videos/page.tsx                           NEW stub
│   │       └── settings/page.tsx                         NEW form + Server Action
│   └── test/
│       ├── lib/validations/
│       │   ├── webinar.test.ts                           NEW
│       │   └── settings.test.ts                          NEW
│       ├── server/actions/
│       │   ├── webinar.test.ts                           NEW (integration vs DB)
│       │   └── settings.test.ts                          NEW (integration vs DB)
│       └── e2e/
│           └── webinar-crud.spec.ts                      NEW Playwright golden path
```

### File responsibilities

- **`lib/validations/webinar.ts`** — single source of truth for shape + constraints of every step. Imported by both client forms (`zodResolver`) and server actions (`safeParse`).
- **`server/actions/webinar.ts`** — every webinar mutation. Auth + ownership + Zod parse + Prisma + `revalidatePath`.
- **`server/actions/settings.ts`** — `getAccountSettings` (RSC reader, returns row or default) and `upsertAccountSettings` (write).
- **`components/wizard/wizard-shell.tsx`** — pure layout: numbered step links + progress + slot for the active step's form.
- **`components/wizard/step-N-form.tsx`** — each is a client component. Receives `initial` data + the relevant server action as a prop. Manages react-hook-form state. Calls action on submit.
- **`components/webinars/webinars-table.tsx`** — receives RSC-prefetched array + total count. Renders rows + dropdown actions. The filters component (`webinars-filters.tsx`) is its sibling and pushes URL changes; RSC re-renders.
- **`app/dashboard/webinars/page.tsx`** — RSC. Reads `searchParams`, builds Prisma filter, fetches paginated rows + count, renders `<WebinarsFilters />` + `<WebinarsTable rows count />`.
- **`app/dashboard/webinars/new/page.tsx`** — RSC that calls `createDraftWebinar` and `redirect`s. Functions like a server-action shortcut.
- **`app/dashboard/webinars/[id]/(wizard)/step-N/page.tsx`** — RSC: fetch Webinar by id (verifies ownership), render `<StepNForm webinar={...} updateAction={updateWebinarStepN} />`.

---

## Task 1: Extend Prisma schema + migration

**Files:**
- Modify: `packages/db/prisma/schema.prisma`

- [ ] **Step 1: Append the full domain block to `packages/db/prisma/schema.prisma`**

After the existing `Verification` model, append:

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

- [ ] **Step 2: Add back-relations on `User`**

Find the `User` model (already in `schema.prisma`). Inside it, add three new relation fields. The `User` block must end with these relations alongside `sessions`/`accounts`:

```prisma
model User {
  id            String    @id
  name          String
  email         String    @unique
  emailVerified Boolean   @default(false)
  image         String?
  role          String    @default("admin")
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  sessions        Session[]
  accounts        Account[]
  webinars        Webinar[]
  videos          Video[]
  accountSettings AccountSettings?

  @@map("user")
}
```

- [ ] **Step 3: Run the migration**

```bash
DATABASE_URL="postgresql://hotwebinar:hotwebinar@localhost:5432/hotwebinar?schema=public" \
  pnpm --filter db prisma migrate dev --name domain
```

Expected: `packages/db/prisma/migrations/<timestamp>_domain/migration.sql` is generated. The CLI applies it to the `hotwebinar` database. New tables visible via `docker exec hotwebinar-pg psql -U hotwebinar -d hotwebinar -c "\dt"` should now include `account_settings`, `video`, `webinar`, `chat_message`, `cta`, `lead`, `event` (alongside the four Better Auth tables).

- [ ] **Step 4: Regenerate the Prisma client**

```bash
pnpm --filter db generate
```

Expected: `packages/db/node_modules/.prisma/client` updated. Imports like `import { WebinarStatus } from "db"` now resolve.

- [ ] **Step 5: Commit**

```bash
git add packages/db/prisma/schema.prisma packages/db/prisma/migrations
git commit -m "feat(db): add full MVP domain schema (Webinar/Video/Lead/Event/Cta/Chat/AccountSettings)"
```

---

## Task 2: Add new dependencies + shadcn primitives

**Files:**
- Modify: `apps/web/package.json`
- Create: many `apps/web/src/components/ui/*.tsx`

- [ ] **Step 1: Add npm dependencies**

Append to `apps/web/package.json` `dependencies` (in alphabetical-ish order alongside the existing ones):

```json
"react-hook-form": "7.53.0",
"@hookform/resolvers": "3.9.0",
"date-fns": "4.1.0",
"react-day-picker": "9.1.3",
"slugify": "1.6.6",
"sonner": "1.5.0",
"@radix-ui/react-tabs": "1.1.0",
"@radix-ui/react-switch": "1.1.0",
"@radix-ui/react-select": "2.1.1",
"@radix-ui/react-dropdown-menu": "2.1.1",
"@radix-ui/react-alert-dialog": "1.1.1",
"@radix-ui/react-popover": "1.1.1"
```

And to `devDependencies`:

```json
"jsdom": "25.0.1",
"@testing-library/react": "16.0.1",
"@testing-library/user-event": "14.5.2"
```

- [ ] **Step 2: Install**

```bash
pnpm install
```

Expected: lockfile updated. Versions resolved without peer-dep conflicts (warnings about React 19 RC types are acceptable; same workaround as sub-plan A).

- [ ] **Step 3: Add shadcn primitives — Card**

Use `pnpm dlx shadcn@latest add card --yes` from `apps/web/`. If interactive prompts appear, accept defaults. Verify the file landed at `apps/web/src/components/ui/card.tsx`.

If the shadcn CLI errors (network, version mismatch, etc.), fall back to manual creation. The canonical content is:

```tsx
// apps/web/src/components/ui/card.tsx
import * as React from "react";
import { cn } from "@/lib/utils";

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("rounded-lg border bg-card text-card-foreground shadow-sm", className)}
      {...props}
    />
  )
);
Card.displayName = "Card";

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />
  )
);
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("text-xl font-semibold leading-none tracking-tight", className)} {...props} />
  )
);
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
  )
);
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
);
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center p-6 pt-0", className)} {...props} />
  )
);
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
```

- [ ] **Step 4: Add the rest of the shadcn primitives**

Run, one at a time, accepting overwrites only on files that don't yet exist:

```bash
cd apps/web
pnpm dlx shadcn@latest add badge --yes
pnpm dlx shadcn@latest add tabs --yes
pnpm dlx shadcn@latest add switch --yes
pnpm dlx shadcn@latest add select --yes
pnpm dlx shadcn@latest add dropdown-menu --yes
pnpm dlx shadcn@latest add alert-dialog --yes
pnpm dlx shadcn@latest add table --yes
pnpm dlx shadcn@latest add form --yes
pnpm dlx shadcn@latest add popover --yes
pnpm dlx shadcn@latest add calendar --yes
pnpm dlx shadcn@latest add sonner --yes
cd -
```

If any command fails (offline / registry hiccup), retry with `--force-resolutions` or fall back to copying canonical content from https://ui.shadcn.com/docs/components/<name> (paste the file contents into `apps/web/src/components/ui/<name>.tsx`). Do NOT pass `--all` — that would clobber the Button/Input/Label that sub-plan A wrote.

If the CLI tries to overwrite Button/Input/Label, decline.

- [ ] **Step 5: Wire `<Toaster />` into the root layout**

Edit `apps/web/src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "HotWebinar",
  description: "Webinars automáticos simulando ao vivo"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className="min-h-screen antialiased">
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
```

- [ ] **Step 6: Verify install + typecheck**

```bash
pnpm install
pnpm --filter web typecheck
```

Expected: `pnpm install` succeeds; typecheck clean.

- [ ] **Step 7: Commit**

```bash
git add apps/web/package.json apps/web/src/components/ui apps/web/src/app/layout.tsx pnpm-lock.yaml
git commit -m "feat(web): add shadcn primitives and form deps for B1"
```

---

## Task 3: Custom UI helpers (`seconds-input` + `date-time-picker`)

**Files:**
- Create: `apps/web/src/components/ui/seconds-input.tsx`
- Create: `apps/web/src/components/ui/date-time-picker.tsx`
- Create: `apps/web/src/test/components/seconds-input.test.tsx`

- [ ] **Step 1: Configure jsdom environment in `apps/web/vitest.config.ts`**

Replace the existing `apps/web/vitest.config.ts` with:

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    environmentMatchGlobs: [
      ["src/test/components/**", "jsdom"]
    ],
    include: ["src/test/**/*.test.ts", "src/test/**/*.test.tsx"],
    env: {
      DATABASE_URL: "postgresql://hotwebinar:hotwebinar@localhost:5432/hotwebinar?schema=public",
      BETTER_AUTH_SECRET: "test-secret-at-least-32-chars-long-okay",
      BETTER_AUTH_URL: "http://localhost:3000"
    }
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src")
    }
  }
});
```

- [ ] **Step 2: Write the failing test `apps/web/src/test/components/seconds-input.test.tsx`**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { SecondsInput } from "@/components/ui/seconds-input";

function Wrapper() {
  const [value, setValue] = useState<number | undefined>(undefined);
  return <SecondsInput value={value} onChange={setValue} aria-label="Tempo" />;
}

describe("SecondsInput", () => {
  it("renders mm:ss when value is set", async () => {
    function FixedWrapper() {
      const [v, setV] = useState<number | undefined>(125);
      return <SecondsInput value={v} onChange={setV} aria-label="Tempo" />;
    }
    render(<FixedWrapper />);
    const input = screen.getByLabelText("Tempo") as HTMLInputElement;
    expect(input.value).toBe("02:05");
  });

  it("parses mm:ss back to seconds on change", async () => {
    const user = userEvent.setup();
    let captured: number | undefined;
    function Capture() {
      const [v, setV] = useState<number | undefined>(0);
      return (
        <SecondsInput
          value={v}
          onChange={(n) => {
            captured = n;
            setV(n);
          }}
          aria-label="Tempo"
        />
      );
    }
    render(<Capture />);
    const input = screen.getByLabelText("Tempo");
    await user.clear(input);
    await user.type(input, "01:30");
    await user.tab();
    expect(captured).toBe(90);
  });

  it("rejects non-numeric input by clamping to 0", async () => {
    const user = userEvent.setup();
    let captured: number | undefined;
    function Capture() {
      const [v, setV] = useState<number | undefined>(60);
      return (
        <SecondsInput
          value={v}
          onChange={(n) => {
            captured = n;
            setV(n);
          }}
          aria-label="Tempo"
        />
      );
    }
    render(<Capture />);
    const input = screen.getByLabelText("Tempo");
    await user.clear(input);
    await user.type(input, "abc");
    await user.tab();
    expect(captured).toBe(0);
  });
});
```

- [ ] **Step 3: Run to verify failure**

```bash
pnpm --filter web test src/test/components/seconds-input.test.tsx
```

Expected: FAIL — module `@/components/ui/seconds-input` not found.

- [ ] **Step 4: Implement `apps/web/src/components/ui/seconds-input.tsx`**

```tsx
"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

export interface SecondsInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> {
  value: number | undefined;
  onChange: (value: number | undefined) => void;
}

function format(value: number | undefined): string {
  if (value === undefined || Number.isNaN(value)) return "";
  const m = Math.floor(value / 60);
  const s = value % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function parse(text: string): number {
  const trimmed = text.trim();
  if (trimmed === "") return 0;
  const match = trimmed.match(/^(\d+):(\d{1,2})$/);
  if (match) {
    const m = parseInt(match[1], 10);
    const s = parseInt(match[2], 10);
    if (!Number.isNaN(m) && !Number.isNaN(s) && s < 60) return m * 60 + s;
    return 0;
  }
  const asNumber = parseInt(trimmed, 10);
  if (!Number.isNaN(asNumber) && asNumber >= 0) return asNumber;
  return 0;
}

export const SecondsInput = React.forwardRef<HTMLInputElement, SecondsInputProps>(
  ({ className, value, onChange, ...props }, ref) => {
    const [text, setText] = React.useState(format(value));

    React.useEffect(() => {
      setText(format(value));
    }, [value]);

    return (
      <input
        ref={ref}
        type="text"
        inputMode="numeric"
        placeholder="00:00"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          const parsed = parse(text);
          setText(format(parsed));
          onChange(parsed);
        }}
        className={cn(
          "flex h-10 w-24 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          className
        )}
        {...props}
      />
    );
  }
);
SecondsInput.displayName = "SecondsInput";
```

- [ ] **Step 5: Run to verify it passes**

```bash
pnpm --filter web test src/test/components/seconds-input.test.tsx
```

Expected: 3 passing.

- [ ] **Step 6: Implement `apps/web/src/components/ui/date-time-picker.tsx`**

```tsx
"use client";
import * as React from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface DateTimePickerProps {
  value: Date | undefined;
  onChange: (value: Date | undefined) => void;
  ariaLabel?: string;
}

export function DateTimePicker({ value, onChange, ariaLabel }: DateTimePickerProps) {
  const [open, setOpen] = React.useState(false);
  const time = value ? format(value, "HH:mm") : "00:00";

  function handleDate(date: Date | undefined) {
    if (!date) return onChange(undefined);
    const [h, m] = time.split(":").map((n) => parseInt(n, 10));
    const next = new Date(date);
    next.setHours(h || 0, m || 0, 0, 0);
    onChange(next);
    setOpen(false);
  }

  function handleTime(t: string) {
    if (!value) return;
    const [h, m] = t.split(":").map((n) => parseInt(n, 10));
    const next = new Date(value);
    next.setHours(h || 0, m || 0, 0, 0);
    onChange(next);
  }

  return (
    <div className="flex gap-2" aria-label={ariaLabel}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn("w-48 justify-start text-left font-normal", !value && "text-muted-foreground")}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {value ? format(value, "dd/MM/yyyy", { locale: ptBR }) : "Selecione data"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0">
          <Calendar mode="single" selected={value} onSelect={handleDate} initialFocus locale={ptBR} />
        </PopoverContent>
      </Popover>
      <Input
        type="time"
        value={time}
        onChange={(e) => handleTime(e.target.value)}
        className="w-28"
      />
    </div>
  );
}
```

- [ ] **Step 7: Verify typecheck**

```bash
pnpm --filter web typecheck
```

Expected: clean.

- [ ] **Step 8: Commit**

```bash
git add apps/web/vitest.config.ts apps/web/src/components/ui/seconds-input.tsx apps/web/src/components/ui/date-time-picker.tsx apps/web/src/test/components
git commit -m "feat(web): add SecondsInput and DateTimePicker UI helpers"
```

---

## Task 4: Zod validation schemas (TDD)

**Files:**
- Create: `apps/web/src/lib/validations/webinar.ts`
- Create: `apps/web/src/lib/validations/settings.ts`
- Create: `apps/web/src/test/lib/validations/webinar.test.ts`
- Create: `apps/web/src/test/lib/validations/settings.test.ts`

- [ ] **Step 1: Write failing tests `apps/web/src/test/lib/validations/webinar.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import {
  step1Schema,
  step2Schema,
  step3Schema,
  step4Schema,
  step5Schema,
  step6Schema
} from "@/lib/validations/webinar";

describe("step1Schema", () => {
  it("accepts a valid input", () => {
    const r = step1Schema.safeParse({
      name: "Webinar Teste",
      title: "Título Público",
      slug: "webinar-teste",
      language: "pt-BR"
    });
    expect(r.success).toBe(true);
  });

  it("rejects slug with uppercase or spaces", () => {
    expect(step1Schema.safeParse({ name: "X", title: "Y", slug: "Bad Slug", language: "pt-BR" }).success).toBe(false);
    expect(step1Schema.safeParse({ name: "X", title: "Y", slug: "bad_slug", language: "pt-BR" }).success).toBe(false);
  });

  it("rejects short slug", () => {
    expect(step1Schema.safeParse({ name: "Foo Bar", title: "Foo Bar", slug: "ab", language: "pt-BR" }).success).toBe(false);
  });
});

describe("step2Schema", () => {
  it("rejects when endDate is not after startDate", () => {
    const start = new Date("2026-06-01T10:00:00Z");
    const end = new Date("2026-06-01T10:00:00Z");
    const r = step2Schema.safeParse({
      mode: "UNICO",
      startDate: start,
      endDate: end,
      timezone: "America/Sao_Paulo",
      waitingTitle: "Sala",
      waitingSubtitle: ""
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path.includes("endDate"))).toBe(true);
    }
  });

  it("accepts JIT mode", () => {
    const r = step2Schema.safeParse({
      mode: "JIT",
      startDate: new Date("2026-06-01T10:00:00Z"),
      endDate: new Date("2026-06-01T11:00:00Z"),
      timezone: "America/Sao_Paulo",
      waitingTitle: "X",
      waitingSubtitle: ""
    });
    expect(r.success).toBe(true);
  });
});

describe("step3Schema", () => {
  it("rejects invalid hex color", () => {
    expect(step3Schema.safeParse({
      logoUrl: "",
      primaryColor: "",
      loginButtonText: "Entrar",
      loginButtonColor: "not-a-color",
      nameEnabled: true, nameRequired: true,
      emailEnabled: true, emailRequired: true,
      phoneEnabled: true, phoneRequired: false,
      namePlaceholder: "", emailPlaceholder: "", phonePlaceholder: ""
    }).success).toBe(false);
  });

  it("accepts valid hex", () => {
    expect(step3Schema.safeParse({
      logoUrl: "",
      primaryColor: "",
      loginButtonText: "Entrar",
      loginButtonColor: "#16a34a",
      nameEnabled: true, nameRequired: true,
      emailEnabled: true, emailRequired: true,
      phoneEnabled: true, phoneRequired: false,
      namePlaceholder: "", emailPlaceholder: "", phonePlaceholder: ""
    }).success).toBe(true);
  });
});

describe("step4Schema", () => {
  it("requires URL", () => {
    expect(step4Schema.safeParse({ videoExternalUrl: "not-a-url" }).success).toBe(false);
    expect(step4Schema.safeParse({ videoExternalUrl: "https://example.com/video.mp4" }).success).toBe(true);
  });
});

describe("step5Schema (CTAs array)", () => {
  it("accepts empty array", () => {
    expect(step5Schema.safeParse({ ctas: [] }).success).toBe(true);
  });

  it("rejects CTA with invalid URL", () => {
    expect(step5Schema.safeParse({
      ctas: [{ label: "Comprar", url: "nope", showAtSec: 30 }]
    }).success).toBe(false);
  });

  it("preserves optional id field", () => {
    const r = step5Schema.safeParse({
      ctas: [{ id: "c1", label: "Comprar", url: "https://x.com", showAtSec: 30 }]
    });
    expect(r.success).toBe(true);
  });
});

describe("step6Schema (Chat array)", () => {
  it("accepts empty array", () => {
    expect(step6Schema.safeParse({ messages: [] }).success).toBe(true);
  });

  it("rejects empty author or text", () => {
    expect(step6Schema.safeParse({
      messages: [{ authorName: "", text: "Olá", showAtSec: 0 }]
    }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Write failing tests `apps/web/src/test/lib/validations/settings.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { accountSettingsSchema } from "@/lib/validations/settings";

describe("accountSettingsSchema", () => {
  it("accepts valid input", () => {
    expect(accountSettingsSchema.safeParse({
      defaultLanguage: "pt-BR",
      defaultTimezone: "America/Sao_Paulo",
      brandName: "Acme"
    }).success).toBe(true);
  });

  it("accepts empty brandName", () => {
    expect(accountSettingsSchema.safeParse({
      defaultLanguage: "pt-BR",
      defaultTimezone: "America/Sao_Paulo",
      brandName: ""
    }).success).toBe(true);
  });

  it("rejects empty timezone", () => {
    expect(accountSettingsSchema.safeParse({
      defaultLanguage: "pt-BR",
      defaultTimezone: "",
      brandName: "Acme"
    }).success).toBe(false);
  });
});
```

- [ ] **Step 3: Run to verify failure**

```bash
pnpm --filter web test src/test/lib/validations
```

Expected: FAIL — modules not found.

- [ ] **Step 4: Implement `apps/web/src/lib/validations/webinar.ts`**

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
  language: z.string().min(2).max(10)
});
export type Step1Input = z.infer<typeof step1Schema>;

export const step2Schema = z
  .object({
    mode: z.enum(["UNICO", "JIT"]),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    timezone: z.string().min(1),
    waitingTitle: z.string().min(1).max(80),
    waitingSubtitle: z.string().max(200)
  })
  .refine((v) => v.endDate > v.startDate, {
    message: "Fim deve ser após início",
    path: ["endDate"]
  });
export type Step2Input = z.infer<typeof step2Schema>;

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
  phonePlaceholder: z.string()
});
export type Step3Input = z.infer<typeof step3Schema>;

export const step4Schema = z.object({
  videoExternalUrl: z.string().url("Cole uma URL válida"),
  pitchAtSec: z.number().int().min(0).optional()
});
export type Step4Input = z.infer<typeof step4Schema>;

export const ctaItemSchema = z.object({
  id: z.string().optional(),
  label: z.string().min(1).max(80),
  url: z.string().url(),
  showAtSec: z.number().int().min(0),
  hideAtSec: z.number().int().min(0).optional()
});
export const step5Schema = z.object({ ctas: z.array(ctaItemSchema) });
export type Step5Input = z.infer<typeof step5Schema>;
export type CtaItem = z.infer<typeof ctaItemSchema>;

export const chatItemSchema = z.object({
  id: z.string().optional(),
  authorName: z.string().min(1).max(80),
  text: z.string().min(1).max(500),
  showAtSec: z.number().int().min(0),
  isOwner: z.boolean().default(false)
});
export const step6Schema = z.object({ messages: z.array(chatItemSchema) });
export type Step6Input = z.infer<typeof step6Schema>;
export type ChatItem = z.infer<typeof chatItemSchema>;
```

- [ ] **Step 5: Implement `apps/web/src/lib/validations/settings.ts`**

```ts
import { z } from "zod";

export const accountSettingsSchema = z.object({
  defaultLanguage: z.string().min(2).max(10),
  defaultTimezone: z.string().min(1),
  brandName: z.string().max(120).optional().or(z.literal(""))
});
export type AccountSettingsInput = z.infer<typeof accountSettingsSchema>;
```

- [ ] **Step 6: Run to verify it passes**

```bash
pnpm --filter web test src/test/lib/validations
```

Expected: all passing.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib/validations apps/web/src/test/lib/validations
git commit -m "feat(web): add Zod validation schemas for webinar wizard and settings"
```

---

## Task 5: Server actions — settings (TDD)

**Files:**
- Create: `apps/web/src/server/actions/settings.ts`
- Create: `apps/web/src/test/server/actions/settings.test.ts`

- [ ] **Step 1: Write failing test `apps/web/src/test/server/actions/settings.test.ts`**

```ts
import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { prisma } from "db";

const TEST_USER = {
  id: "test-user-1",
  email: "settings-test@example.com",
  name: "Settings Tester"
};

vi.mock("next/headers", () => ({
  headers: async () => new Headers()
}));

vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: async () => ({
        user: { id: TEST_USER.id, email: TEST_USER.email, name: TEST_USER.name },
        session: { id: "s1", userId: TEST_USER.id }
      })
    }
  }
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn()
}));

beforeEach(async () => {
  await prisma.accountSettings.deleteMany({});
  await prisma.session.deleteMany({});
  await prisma.account.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.user.create({
    data: { id: TEST_USER.id, email: TEST_USER.email, name: TEST_USER.name }
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("settings actions", () => {
  it("getAccountSettings returns defaults if no row exists", async () => {
    const { getAccountSettings } = await import("@/server/actions/settings");
    const result = await getAccountSettings();
    expect(result).toMatchObject({
      defaultLanguage: "pt-BR",
      defaultTimezone: "America/Sao_Paulo",
      brandName: ""
    });
  });

  it("upsertAccountSettings creates a row when none exists", async () => {
    const { upsertAccountSettings } = await import("@/server/actions/settings");
    const result = await upsertAccountSettings({
      defaultLanguage: "en-US",
      defaultTimezone: "Europe/London",
      brandName: "Test Brand"
    });
    expect(result).toEqual({ ok: true });
    const row = await prisma.accountSettings.findUnique({ where: { userId: TEST_USER.id } });
    expect(row).toMatchObject({
      defaultLanguage: "en-US",
      defaultTimezone: "Europe/London",
      brandName: "Test Brand"
    });
  });

  it("upsertAccountSettings updates an existing row", async () => {
    const { upsertAccountSettings } = await import("@/server/actions/settings");
    await prisma.accountSettings.create({
      data: {
        userId: TEST_USER.id,
        defaultLanguage: "pt-BR",
        defaultTimezone: "America/Sao_Paulo",
        brandName: "Old"
      }
    });
    await upsertAccountSettings({
      defaultLanguage: "es-ES",
      defaultTimezone: "Europe/Madrid",
      brandName: "New"
    });
    const rows = await prisma.accountSettings.findMany({ where: { userId: TEST_USER.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ defaultLanguage: "es-ES", brandName: "New" });
  });

  it("upsertAccountSettings rejects invalid input via Zod", async () => {
    const { upsertAccountSettings } = await import("@/server/actions/settings");
    const r = await upsertAccountSettings({
      defaultLanguage: "pt-BR",
      defaultTimezone: "",
      brandName: ""
    } as never);
    expect(r).toMatchObject({ error: expect.any(Object) });
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
pnpm --filter web test src/test/server/actions/settings.test.ts
```

Expected: FAIL — module `@/server/actions/settings` not found.

- [ ] **Step 3: Implement `apps/web/src/server/actions/settings.ts`**

```ts
"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "db";
import { auth } from "@/lib/auth";
import {
  accountSettingsSchema,
  type AccountSettingsInput
} from "@/lib/validations/settings";

type Result = { ok: true } | { error: { field?: string; message: string } };

const DEFAULTS = {
  defaultLanguage: "pt-BR",
  defaultTimezone: "America/Sao_Paulo",
  brandName: ""
};

async function requireSession() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");
  return session;
}

export async function getAccountSettings(): Promise<typeof DEFAULTS> {
  const session = await requireSession();
  const row = await prisma.accountSettings.findUnique({ where: { userId: session.user.id } });
  if (!row) return DEFAULTS;
  return {
    defaultLanguage: row.defaultLanguage,
    defaultTimezone: row.defaultTimezone,
    brandName: row.brandName ?? ""
  };
}

export async function upsertAccountSettings(input: AccountSettingsInput): Promise<Result> {
  const session = await requireSession();
  const parsed = accountSettingsSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: { field: issue.path.join("."), message: issue.message } };
  }
  await prisma.accountSettings.upsert({
    where: { userId: session.user.id },
    update: {
      defaultLanguage: parsed.data.defaultLanguage,
      defaultTimezone: parsed.data.defaultTimezone,
      brandName: parsed.data.brandName || null
    },
    create: {
      userId: session.user.id,
      defaultLanguage: parsed.data.defaultLanguage,
      defaultTimezone: parsed.data.defaultTimezone,
      brandName: parsed.data.brandName || null
    }
  });
  revalidatePath("/dashboard/settings");
  return { ok: true };
}
```

- [ ] **Step 4: Run to verify it passes**

```bash
pnpm --filter web test src/test/server/actions/settings.test.ts
```

Expected: 4 passing.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/server/actions/settings.ts apps/web/src/test/server/actions/settings.test.ts
git commit -m "feat(web): add settings server actions"
```

---

## Task 6: Settings page UI

**Files:**
- Create: `apps/web/src/app/dashboard/settings/page.tsx`
- Create: `apps/web/src/components/settings-form.tsx`

- [ ] **Step 1: Implement `apps/web/src/components/settings-form.tsx`**

```tsx
"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { upsertAccountSettings } from "@/server/actions/settings";
import { accountSettingsSchema, type AccountSettingsInput } from "@/lib/validations/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface SettingsFormProps {
  initial: AccountSettingsInput;
}

export function SettingsForm({ initial }: SettingsFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<AccountSettingsInput>({
    resolver: zodResolver(accountSettingsSchema),
    defaultValues: initial
  });

  async function onSubmit(values: AccountSettingsInput) {
    const result = await upsertAccountSettings(values);
    if ("ok" in result) {
      toast.success("Configurações salvas");
    } else {
      toast.error(result.error.message);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-xl space-y-6">
      <div className="space-y-2">
        <Label htmlFor="brandName">Nome da marca</Label>
        <Input id="brandName" {...register("brandName")} placeholder="Ex.: Hotwebinar" />
        {errors.brandName && <p className="text-sm text-destructive">{errors.brandName.message}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="defaultLanguage">Idioma padrão</Label>
        <Input id="defaultLanguage" {...register("defaultLanguage")} placeholder="pt-BR" />
        {errors.defaultLanguage && <p className="text-sm text-destructive">{errors.defaultLanguage.message}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="defaultTimezone">Fuso horário padrão</Label>
        <Input id="defaultTimezone" {...register("defaultTimezone")} placeholder="America/Sao_Paulo" />
        {errors.defaultTimezone && <p className="text-sm text-destructive">{errors.defaultTimezone.message}</p>}
      </div>
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Salvando..." : "Salvar"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 2: Implement `apps/web/src/app/dashboard/settings/page.tsx`**

```tsx
import { getAccountSettings } from "@/server/actions/settings";
import { SettingsForm } from "@/components/settings-form";

export default async function SettingsPage() {
  const initial = await getAccountSettings();
  return (
    <div className="container mx-auto py-10">
      <h1 className="text-3xl font-semibold">Configurações</h1>
      <p className="mt-2 text-muted-foreground">Defaults aplicados a novos webinars.</p>
      <div className="mt-8">
        <SettingsForm initial={initial} />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify typecheck**

```bash
pnpm --filter web typecheck
```

Expected: clean.

- [ ] **Step 4: Smoke test**

Start dev server (`pnpm dev`), visit `http://localhost:3000/dashboard/settings`, fill in `Nome da marca = Acme`, click Salvar. Expect success toast. Reload — value persists.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/dashboard/settings apps/web/src/components/settings-form.tsx
git commit -m "feat(web): add settings page with AccountSettings form"
```

---

## Task 7: Server actions — webinar (TDD)

**Files:**
- Create: `apps/web/src/server/actions/webinar.ts`
- Create: `apps/web/src/test/server/actions/webinar.test.ts`

- [ ] **Step 1: Write failing test `apps/web/src/test/server/actions/webinar.test.ts`**

```ts
import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { prisma } from "db";

const TEST_USER = {
  id: "wb-test-user",
  email: "webinar-test@example.com",
  name: "Webinar Tester"
};

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: async () => ({
        user: { id: TEST_USER.id, email: TEST_USER.email, name: TEST_USER.name },
        session: { id: "s", userId: TEST_USER.id }
      })
    }
  }
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

beforeEach(async () => {
  await prisma.event.deleteMany({});
  await prisma.lead.deleteMany({});
  await prisma.cta.deleteMany({});
  await prisma.chatMessage.deleteMany({});
  await prisma.webinar.deleteMany({});
  await prisma.video.deleteMany({});
  await prisma.accountSettings.deleteMany({});
  await prisma.session.deleteMany({});
  await prisma.account.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.user.create({ data: { id: TEST_USER.id, email: TEST_USER.email, name: TEST_USER.name } });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("createDraftWebinar", () => {
  it("creates a DRAFT for the authenticated user", async () => {
    const { createDraftWebinar } = await import("@/server/actions/webinar");
    const { id } = await createDraftWebinar();
    const w = await prisma.webinar.findUnique({ where: { id } });
    expect(w).toMatchObject({ ownerId: TEST_USER.id, status: "DRAFT", language: "pt-BR" });
  });
});

describe("updateWebinarStep1", () => {
  it("updates name/title/slug/language", async () => {
    const { createDraftWebinar, updateWebinarStep1 } = await import("@/server/actions/webinar");
    const { id } = await createDraftWebinar();
    const r = await updateWebinarStep1(id, { name: "X", title: "Hello", slug: "hello-x", language: "pt-BR" });
    expect(r).toEqual({ ok: true });
    const w = await prisma.webinar.findUnique({ where: { id } });
    expect(w).toMatchObject({ name: "X", title: "Hello", slug: "hello-x" });
  });

  it("rejects when called for another user's webinar", async () => {
    const { createDraftWebinar, updateWebinarStep1 } = await import("@/server/actions/webinar");
    await prisma.user.create({ data: { id: "other", email: "other@x.com", name: "Other" } });
    const stranger = await prisma.webinar.create({ data: { ownerId: "other" } });
    const r = await updateWebinarStep1(stranger.id, { name: "X", title: "Y", slug: "yyy", language: "pt-BR" });
    expect(r).toMatchObject({ error: { message: expect.stringMatching(/não encontrado|not_found/i) } });
  });
});

describe("updateWebinarStep4", () => {
  it("creates an EXTERNAL Video and connects it", async () => {
    const { createDraftWebinar, updateWebinarStep4 } = await import("@/server/actions/webinar");
    const { id } = await createDraftWebinar();
    const r = await updateWebinarStep4(id, { videoExternalUrl: "https://cdn.example.com/video.mp4", pitchAtSec: 600 });
    expect(r).toEqual({ ok: true });
    const w = await prisma.webinar.findUnique({ where: { id }, include: { video: true } });
    expect(w?.video).toMatchObject({
      source: "EXTERNAL",
      status: "READY",
      originalUrl: "https://cdn.example.com/video.mp4",
      hlsUrl: "https://cdn.example.com/video.mp4"
    });
    expect(w?.pitchAtSec).toBe(600);
  });
});

describe("updateWebinarStep5 (CTA upsert)", () => {
  it("creates new CTAs when payload has no IDs", async () => {
    const { createDraftWebinar, updateWebinarStep5 } = await import("@/server/actions/webinar");
    const { id } = await createDraftWebinar();
    await updateWebinarStep5(id, {
      ctas: [
        { label: "Comprar", url: "https://x.com", showAtSec: 30 },
        { label: "Saiba mais", url: "https://y.com", showAtSec: 60 }
      ]
    });
    const ctas = await prisma.cta.findMany({ where: { webinarId: id }, orderBy: { showAtSec: "asc" } });
    expect(ctas).toHaveLength(2);
    expect(ctas[0].label).toBe("Comprar");
  });

  it("updates existing CTAs by id and deletes ones omitted", async () => {
    const { createDraftWebinar, updateWebinarStep5 } = await import("@/server/actions/webinar");
    const { id } = await createDraftWebinar();
    await updateWebinarStep5(id, {
      ctas: [{ label: "A", url: "https://a.com", showAtSec: 10 }]
    });
    const [first] = await prisma.cta.findMany({ where: { webinarId: id } });
    await updateWebinarStep5(id, {
      ctas: [
        { id: first.id, label: "A2", url: "https://a.com", showAtSec: 15 },
        { label: "B", url: "https://b.com", showAtSec: 20 }
      ]
    });
    const after = await prisma.cta.findMany({ where: { webinarId: id }, orderBy: { showAtSec: "asc" } });
    expect(after).toHaveLength(2);
    expect(after.find((c) => c.id === first.id)?.label).toBe("A2");
  });
});

describe("publishWebinar", () => {
  it("rejects with missing-field list when fields incomplete", async () => {
    const { createDraftWebinar, publishWebinar } = await import("@/server/actions/webinar");
    const { id } = await createDraftWebinar();
    const r = await publishWebinar(id);
    expect(r).toMatchObject({ error: { message: expect.stringMatching(/Faltam campos/) } });
  });

  it("transitions DRAFT to ACTIVE when all fields present", async () => {
    const {
      createDraftWebinar,
      updateWebinarStep1,
      updateWebinarStep2,
      updateWebinarStep4,
      publishWebinar
    } = await import("@/server/actions/webinar");
    const { id } = await createDraftWebinar();
    await updateWebinarStep1(id, { name: "N", title: "T", slug: "active-test", language: "pt-BR" });
    await updateWebinarStep2(id, {
      mode: "UNICO",
      startDate: new Date("2026-06-01T10:00:00Z"),
      endDate: new Date("2026-06-01T11:00:00Z"),
      timezone: "America/Sao_Paulo",
      waitingTitle: "Sala",
      waitingSubtitle: ""
    });
    await updateWebinarStep4(id, { videoExternalUrl: "https://x.com/v.mp4" });
    const r = await publishWebinar(id);
    expect(r).toEqual({ ok: true });
    const w = await prisma.webinar.findUnique({ where: { id } });
    expect(w?.status).toBe("ACTIVE");
  });
});

describe("deleteWebinar", () => {
  it("cascades chat + ctas", async () => {
    const { createDraftWebinar, updateWebinarStep5, updateWebinarStep6, deleteWebinar } = await import(
      "@/server/actions/webinar"
    );
    const { id } = await createDraftWebinar();
    await updateWebinarStep5(id, { ctas: [{ label: "X", url: "https://x.com", showAtSec: 0 }] });
    await updateWebinarStep6(id, { messages: [{ authorName: "A", text: "Olá", showAtSec: 0, isOwner: false }] });
    await deleteWebinar(id);
    expect(await prisma.cta.count({ where: { webinarId: id } })).toBe(0);
    expect(await prisma.chatMessage.count({ where: { webinarId: id } })).toBe(0);
    expect(await prisma.webinar.findUnique({ where: { id } })).toBeNull();
  });
});

describe("duplicateWebinar", () => {
  it("creates a DRAFT copy with cloned CTAs and chat", async () => {
    const {
      createDraftWebinar,
      updateWebinarStep1,
      updateWebinarStep5,
      updateWebinarStep6,
      duplicateWebinar
    } = await import("@/server/actions/webinar");
    const { id } = await createDraftWebinar();
    await updateWebinarStep1(id, { name: "Orig", title: "Orig", slug: "orig", language: "pt-BR" });
    await updateWebinarStep5(id, { ctas: [{ label: "X", url: "https://x.com", showAtSec: 0 }] });
    await updateWebinarStep6(id, {
      messages: [{ authorName: "A", text: "Olá", showAtSec: 0, isOwner: false }]
    });
    const { newId } = await duplicateWebinar(id);
    const dup = await prisma.webinar.findUnique({
      where: { id: newId },
      include: { ctas: true, chatMessages: true }
    });
    expect(dup?.status).toBe("DRAFT");
    expect(dup?.slug).toBeNull();
    expect(dup?.title).toBe("Orig (cópia)");
    expect(dup?.ctas).toHaveLength(1);
    expect(dup?.chatMessages).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
pnpm --filter web test src/test/server/actions/webinar.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `apps/web/src/server/actions/webinar.ts`**

```ts
"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma, Prisma } from "db";
import { auth } from "@/lib/auth";
import {
  step1Schema,
  step2Schema,
  step3Schema,
  step4Schema,
  step5Schema,
  step6Schema,
  type Step1Input,
  type Step2Input,
  type Step3Input,
  type Step4Input,
  type Step5Input,
  type Step6Input
} from "@/lib/validations/webinar";

type Result = { ok: true } | { error: { field?: string; message: string } };

async function requireSession() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");
  return session;
}

async function loadOwned(id: string, userId: string) {
  const w = await prisma.webinar.findUnique({ where: { id } });
  if (!w || w.ownerId !== userId) return null;
  return w;
}

function notFound(): Result {
  return { error: { message: "Webinar não encontrado" } };
}

export async function createDraftWebinar(): Promise<{ id: string }> {
  const session = await requireSession();
  const settings = await prisma.accountSettings.findUnique({ where: { userId: session.user.id } });
  const w = await prisma.webinar.create({
    data: {
      ownerId: session.user.id,
      status: "DRAFT",
      language: settings?.defaultLanguage ?? "pt-BR",
      timezone: settings?.defaultTimezone ?? "America/Sao_Paulo"
    }
  });
  revalidatePath("/dashboard/webinars");
  return { id: w.id };
}

export async function updateWebinarStep1(id: string, input: Step1Input): Promise<Result> {
  const session = await requireSession();
  const owned = await loadOwned(id, session.user.id);
  if (!owned) return notFound();
  const parsed = step1Schema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: { field: issue.path.join("."), message: issue.message } };
  }
  try {
    await prisma.webinar.update({
      where: { id },
      data: {
        name: parsed.data.name,
        title: parsed.data.title,
        slug: parsed.data.slug,
        language: parsed.data.language
      }
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: { field: "slug", message: "Já existe um webinar com esse slug" } };
    }
    throw e;
  }
  revalidatePath(`/dashboard/webinars/${id}`);
  return { ok: true };
}

export async function updateWebinarStep2(id: string, input: Step2Input): Promise<Result> {
  const session = await requireSession();
  const owned = await loadOwned(id, session.user.id);
  if (!owned) return notFound();
  const parsed = step2Schema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: { field: issue.path.join("."), message: issue.message } };
  }
  await prisma.webinar.update({
    where: { id },
    data: {
      mode: parsed.data.mode,
      startDate: parsed.data.startDate,
      endDate: parsed.data.endDate,
      timezone: parsed.data.timezone,
      waitingTitle: parsed.data.waitingTitle,
      waitingSubtitle: parsed.data.waitingSubtitle
    }
  });
  revalidatePath(`/dashboard/webinars/${id}`);
  return { ok: true };
}

export async function updateWebinarStep3(id: string, input: Step3Input): Promise<Result> {
  const session = await requireSession();
  const owned = await loadOwned(id, session.user.id);
  if (!owned) return notFound();
  const parsed = step3Schema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: { field: issue.path.join("."), message: issue.message } };
  }
  await prisma.webinar.update({
    where: { id },
    data: {
      logoUrl: parsed.data.logoUrl || null,
      primaryColor: parsed.data.primaryColor || null,
      loginButtonText: parsed.data.loginButtonText,
      loginButtonColor: parsed.data.loginButtonColor,
      nameEnabled: parsed.data.nameEnabled,
      nameRequired: parsed.data.nameRequired,
      emailEnabled: parsed.data.emailEnabled,
      emailRequired: parsed.data.emailRequired,
      phoneEnabled: parsed.data.phoneEnabled,
      phoneRequired: parsed.data.phoneRequired,
      namePlaceholder: parsed.data.namePlaceholder,
      emailPlaceholder: parsed.data.emailPlaceholder,
      phonePlaceholder: parsed.data.phonePlaceholder
    }
  });
  revalidatePath(`/dashboard/webinars/${id}`);
  return { ok: true };
}

export async function updateWebinarStep4(id: string, input: Step4Input): Promise<Result> {
  const session = await requireSession();
  const owned = await loadOwned(id, session.user.id);
  if (!owned) return notFound();
  const parsed = step4Schema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: { field: issue.path.join("."), message: issue.message } };
  }

  let videoId = owned.videoId;
  if (videoId) {
    await prisma.video.update({
      where: { id: videoId },
      data: {
        source: "EXTERNAL",
        originalUrl: parsed.data.videoExternalUrl,
        hlsUrl: parsed.data.videoExternalUrl,
        status: "READY"
      }
    });
  } else {
    const v = await prisma.video.create({
      data: {
        ownerId: session.user.id,
        name: owned.title || "Vídeo externo",
        source: "EXTERNAL",
        originalUrl: parsed.data.videoExternalUrl,
        hlsUrl: parsed.data.videoExternalUrl,
        status: "READY",
        progress: 100
      }
    });
    videoId = v.id;
  }

  await prisma.webinar.update({
    where: { id },
    data: {
      videoId,
      pitchAtSec: parsed.data.pitchAtSec ?? null
    }
  });

  revalidatePath(`/dashboard/webinars/${id}`);
  return { ok: true };
}

export async function updateWebinarStep5(id: string, input: Step5Input): Promise<Result> {
  const session = await requireSession();
  const owned = await loadOwned(id, session.user.id);
  if (!owned) return notFound();
  const parsed = step5Schema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: { field: issue.path.join("."), message: issue.message } };
  }
  const incomingIds = new Set(parsed.data.ctas.filter((c) => c.id).map((c) => c.id!));
  const existing = await prisma.cta.findMany({ where: { webinarId: id } });
  const toDelete = existing.filter((e) => !incomingIds.has(e.id)).map((e) => e.id);

  await prisma.$transaction([
    prisma.cta.deleteMany({ where: { id: { in: toDelete } } }),
    ...parsed.data.ctas.map((c) =>
      c.id
        ? prisma.cta.update({
            where: { id: c.id },
            data: { label: c.label, url: c.url, showAtSec: c.showAtSec, hideAtSec: c.hideAtSec ?? null }
          })
        : prisma.cta.create({
            data: {
              webinarId: id,
              label: c.label,
              url: c.url,
              showAtSec: c.showAtSec,
              hideAtSec: c.hideAtSec ?? null
            }
          })
    )
  ]);

  revalidatePath(`/dashboard/webinars/${id}`);
  return { ok: true };
}

export async function updateWebinarStep6(id: string, input: Step6Input): Promise<Result> {
  const session = await requireSession();
  const owned = await loadOwned(id, session.user.id);
  if (!owned) return notFound();
  const parsed = step6Schema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: { field: issue.path.join("."), message: issue.message } };
  }
  const incomingIds = new Set(parsed.data.messages.filter((m) => m.id).map((m) => m.id!));
  const existing = await prisma.chatMessage.findMany({ where: { webinarId: id } });
  const toDelete = existing.filter((e) => !incomingIds.has(e.id)).map((e) => e.id);

  await prisma.$transaction([
    prisma.chatMessage.deleteMany({ where: { id: { in: toDelete } } }),
    ...parsed.data.messages.map((m) =>
      m.id
        ? prisma.chatMessage.update({
            where: { id: m.id },
            data: {
              authorName: m.authorName,
              text: m.text,
              showAtSec: m.showAtSec,
              isOwner: m.isOwner
            }
          })
        : prisma.chatMessage.create({
            data: {
              webinarId: id,
              authorName: m.authorName,
              text: m.text,
              showAtSec: m.showAtSec,
              isOwner: m.isOwner
            }
          })
    )
  ]);

  revalidatePath(`/dashboard/webinars/${id}`);
  return { ok: true };
}

export async function publishWebinar(id: string): Promise<Result> {
  const session = await requireSession();
  const owned = await loadOwned(id, session.user.id);
  if (!owned) return notFound();
  const missing: string[] = [];
  if (!owned.name) missing.push("name");
  if (!owned.title) missing.push("title");
  if (!owned.slug) missing.push("slug");
  if (!owned.startDate) missing.push("startDate");
  if (!owned.endDate) missing.push("endDate");
  if (!owned.videoId) missing.push("video");
  if (missing.length) {
    return { error: { message: `Faltam campos: ${missing.join(", ")}` } };
  }
  await prisma.webinar.update({ where: { id }, data: { status: "ACTIVE" } });
  revalidatePath("/dashboard/webinars");
  return { ok: true };
}

export async function deleteWebinar(id: string): Promise<Result> {
  const session = await requireSession();
  const owned = await loadOwned(id, session.user.id);
  if (!owned) return notFound();
  await prisma.webinar.delete({ where: { id } });
  revalidatePath("/dashboard/webinars");
  return { ok: true };
}

export async function duplicateWebinar(id: string): Promise<{ newId: string } | { error: { message: string } }> {
  const session = await requireSession();
  const src = await loadOwned(id, session.user.id);
  if (!src) return { error: { message: "Webinar não encontrado" } };

  const ctas = await prisma.cta.findMany({ where: { webinarId: id } });
  const messages = await prisma.chatMessage.findMany({ where: { webinarId: id } });

  const dup = await prisma.webinar.create({
    data: {
      ownerId: session.user.id,
      videoId: src.videoId,
      name: `${src.name} (cópia)`,
      title: `${src.title} (cópia)`,
      slug: null,
      language: src.language,
      mode: src.mode,
      timezone: src.timezone,
      waitingTitle: src.waitingTitle,
      waitingSubtitle: src.waitingSubtitle,
      logoUrl: src.logoUrl,
      primaryColor: src.primaryColor,
      loginButtonText: src.loginButtonText,
      loginButtonColor: src.loginButtonColor,
      nameEnabled: src.nameEnabled,
      nameRequired: src.nameRequired,
      emailEnabled: src.emailEnabled,
      emailRequired: src.emailRequired,
      phoneEnabled: src.phoneEnabled,
      phoneRequired: src.phoneRequired,
      namePlaceholder: src.namePlaceholder,
      emailPlaceholder: src.emailPlaceholder,
      phonePlaceholder: src.phonePlaceholder,
      pitchAtSec: src.pitchAtSec,
      status: "DRAFT"
    }
  });

  if (ctas.length) {
    await prisma.cta.createMany({
      data: ctas.map((c) => ({
        webinarId: dup.id,
        label: c.label,
        url: c.url,
        showAtSec: c.showAtSec,
        hideAtSec: c.hideAtSec
      }))
    });
  }
  if (messages.length) {
    await prisma.chatMessage.createMany({
      data: messages.map((m) => ({
        webinarId: dup.id,
        authorName: m.authorName,
        text: m.text,
        showAtSec: m.showAtSec,
        isOwner: m.isOwner
      }))
    });
  }

  revalidatePath("/dashboard/webinars");
  return { newId: dup.id };
}
```

- [ ] **Step 4: Run to verify it passes**

```bash
pnpm --filter web test src/test/server/actions/webinar.test.ts
```

Expected: all describe blocks green.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/server/actions/webinar.ts apps/web/src/test/server/actions/webinar.test.ts
git commit -m "feat(web): add webinar server actions (CRUD + publish + duplicate)"
```

---

## Task 8: Wizard shell + nav

**Files:**
- Create: `apps/web/src/components/wizard/wizard-shell.tsx`
- Create: `apps/web/src/components/wizard/wizard-nav.tsx`
- Create: `apps/web/src/app/dashboard/webinars/[id]/(wizard)/layout.tsx`
- Create: `apps/web/src/app/dashboard/webinars/[id]/page.tsx`

- [ ] **Step 1: Implement `apps/web/src/components/wizard/wizard-shell.tsx`**

```tsx
import Link from "next/link";
import { cn } from "@/lib/utils";

const STEPS = [
  { num: 1, label: "Início" },
  { num: 2, label: "Webinar" },
  { num: 3, label: "Login" },
  { num: 4, label: "Vídeo" },
  { num: 5, label: "Oferta" },
  { num: 6, label: "Chat" }
];

export function WizardShell({
  webinarId,
  currentStep,
  children
}: {
  webinarId: string;
  currentStep: number;
  children: React.ReactNode;
}) {
  return (
    <div className="container mx-auto py-8">
      <ol className="flex flex-wrap gap-3">
        {STEPS.map((s) => {
          const active = s.num === currentStep;
          const done = s.num < currentStep;
          return (
            <li key={s.num}>
              <Link
                href={`/dashboard/webinars/${webinarId}/step-${s.num}`}
                className={cn(
                  "flex items-center gap-2 rounded-md border px-3 py-2 text-sm",
                  active && "border-destructive bg-destructive/10 font-semibold text-destructive",
                  done && !active && "text-foreground",
                  !active && !done && "text-muted-foreground"
                )}
              >
                <span className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold",
                  active ? "bg-destructive text-destructive-foreground" : "bg-accent"
                )}>
                  {s.num}
                </span>
                {s.label}
              </Link>
            </li>
          );
        })}
      </ol>
      <div className="mt-8">{children}</div>
    </div>
  );
}
```

- [ ] **Step 2: Implement `apps/web/src/components/wizard/wizard-nav.tsx`**

```tsx
"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function WizardNav({
  webinarId,
  step,
  submitting,
  submitLabel
}: {
  webinarId: string;
  step: number;
  submitting: boolean;
  submitLabel?: string;
}) {
  const prev = step > 1 ? `/dashboard/webinars/${webinarId}/step-${step - 1}` : null;
  return (
    <div className="mt-8 flex items-center justify-between border-t pt-4">
      {prev ? (
        <Button asChild variant="outline" type="button">
          <Link href={prev}>← Voltar</Link>
        </Button>
      ) : (
        <span />
      )}
      <Button type="submit" disabled={submitting}>
        {submitting ? "Salvando..." : (submitLabel ?? "Continuar →")}
      </Button>
    </div>
  );
}
```

- [ ] **Step 3: Implement `apps/web/src/app/dashboard/webinars/[id]/(wizard)/layout.tsx`**

```tsx
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "db";
import { WizardShell } from "@/components/wizard/wizard-shell";

const STEP_RE = /\/step-(\d)$/;

export default async function WizardLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) notFound();
  const w = await prisma.webinar.findUnique({ where: { id } });
  if (!w || w.ownerId !== session.user.id) notFound();

  const h = await headers();
  const path = h.get("x-pathname") ?? "";
  const m = path.match(STEP_RE);
  const step = m ? parseInt(m[1], 10) : 1;

  return (
    <WizardShell webinarId={id} currentStep={step}>
      {children}
    </WizardShell>
  );
}
```

- [ ] **Step 4: Implement `apps/web/src/app/dashboard/webinars/[id]/page.tsx`**

```tsx
import { redirect } from "next/navigation";

export default async function WebinarRoot({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/dashboard/webinars/${id}/step-1`);
}
```

- [ ] **Step 5: Verify typecheck**

```bash
pnpm --filter web typecheck
```

Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/wizard apps/web/src/app/dashboard/webinars/\[id\]/page.tsx apps/web/src/app/dashboard/webinars/\[id\]/\(wizard\)/layout.tsx
git commit -m "feat(web): add wizard shell, nav, and route layout"
```

---

## Task 9: Step 1 (Início) form + page

**Files:**
- Create: `apps/web/src/components/wizard/step-1-form.tsx`
- Create: `apps/web/src/app/dashboard/webinars/[id]/(wizard)/step-1/page.tsx`

- [ ] **Step 1: Implement `apps/web/src/components/wizard/step-1-form.tsx`**

```tsx
"use client";
import { useEffect, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import slugify from "slugify";
import { step1Schema, type Step1Input } from "@/lib/validations/webinar";
import { updateWebinarStep1 } from "@/server/actions/webinar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WizardNav } from "@/components/wizard/wizard-nav";

export interface Step1FormProps {
  webinarId: string;
  initial: Step1Input;
}

export function Step1Form({ webinarId, initial }: Step1FormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    setError,
    formState: { errors }
  } = useForm<Step1Input>({
    resolver: zodResolver(step1Schema),
    defaultValues: initial
  });

  const title = watch("title");
  useEffect(() => {
    const currentSlug = (watch("slug") ?? "").trim();
    if (currentSlug === "" && title) {
      setValue("slug", slugify(title, { lower: true, strict: true }), { shouldValidate: false });
    }
  }, [title, setValue, watch]);

  function onSubmit(values: Step1Input) {
    startTransition(async () => {
      const res = await updateWebinarStep1(webinarId, values);
      if ("ok" in res) {
        router.push(`/dashboard/webinars/${webinarId}/step-2`);
      } else {
        if (res.error.field) {
          setError(res.error.field as keyof Step1Input, { message: res.error.message });
        } else {
          toast.error(res.error.message);
        }
      }
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl space-y-6">
      <h2 className="text-2xl font-semibold">Início</h2>

      <div className="space-y-2">
        <Label htmlFor="name">Nome interno</Label>
        <Input id="name" {...register("name")} />
        {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="title">Título público</Label>
        <Input id="title" {...register("title")} />
        {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="slug">URL amigável</Label>
        <Input id="slug" {...register("slug")} />
        <p className="text-xs text-muted-foreground">
          https://hotwebinar.com.br/w/<span className="font-mono">{watch("slug") || "<slug>"}</span>
        </p>
        {errors.slug && <p className="text-sm text-destructive">{errors.slug.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="language">Idioma</Label>
        <Input id="language" {...register("language")} placeholder="pt-BR" />
        {errors.language && <p className="text-sm text-destructive">{errors.language.message}</p>}
      </div>

      <WizardNav webinarId={webinarId} step={1} submitting={pending} />
    </form>
  );
}
```

- [ ] **Step 2: Implement `apps/web/src/app/dashboard/webinars/[id]/(wizard)/step-1/page.tsx`**

```tsx
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "db";
import { Step1Form } from "@/components/wizard/step-1-form";

export default async function Step1Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) notFound();
  const w = await prisma.webinar.findUnique({ where: { id } });
  if (!w || w.ownerId !== session.user.id) notFound();

  return (
    <Step1Form
      webinarId={id}
      initial={{
        name: w.name,
        title: w.title,
        slug: w.slug ?? "",
        language: w.language
      }}
    />
  );
}
```

- [ ] **Step 3: Verify typecheck**

```bash
pnpm --filter web typecheck
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/wizard/step-1-form.tsx apps/web/src/app/dashboard/webinars/\[id\]/\(wizard\)/step-1
git commit -m "feat(web): add wizard step 1 (Início)"
```

---

## Task 10: Step 2 (Webinar — modes + dates) form + page

**Files:**
- Create: `apps/web/src/components/wizard/step-2-form.tsx`
- Create: `apps/web/src/app/dashboard/webinars/[id]/(wizard)/step-2/page.tsx`

- [ ] **Step 1: Implement `apps/web/src/components/wizard/step-2-form.tsx`**

```tsx
"use client";
import { useTransition } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { step2Schema, type Step2Input } from "@/lib/validations/webinar";
import { updateWebinarStep2 } from "@/server/actions/webinar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { WizardNav } from "@/components/wizard/wizard-nav";

export interface Step2FormProps {
  webinarId: string;
  initial: Step2Input;
}

export function Step2Form({ webinarId, initial }: Step2FormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
    setError,
    watch
  } = useForm<Step2Input>({
    resolver: zodResolver(step2Schema),
    defaultValues: initial
  });

  const mode = watch("mode");

  function onSubmit(values: Step2Input) {
    startTransition(async () => {
      const res = await updateWebinarStep2(webinarId, values);
      if ("ok" in res) {
        router.push(`/dashboard/webinars/${webinarId}/step-3`);
      } else if (res.error.field) {
        setError(res.error.field as keyof Step2Input, { message: res.error.message });
      } else {
        toast.error(res.error.message);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-3xl space-y-6">
      <h2 className="text-2xl font-semibold">Webinar</h2>

      <Controller
        control={control}
        name="mode"
        render={({ field }) => (
          <Tabs value={field.value} onValueChange={field.onChange}>
            <TabsList>
              <TabsTrigger value="UNICO">Webinar único</TabsTrigger>
              <TabsTrigger value="JIT">Just in time</TabsTrigger>
            </TabsList>
            <TabsContent value="UNICO" className="mt-4 text-sm text-muted-foreground">
              Um evento único, em uma data e horário específicos.
            </TabsContent>
            <TabsContent value="JIT" className="mt-4 text-sm text-muted-foreground">
              Vídeo passa em tempo real desde o horário de início. Quem chega depois vê o offset correspondente.
            </TabsContent>
          </Tabs>
        )}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Data e hora de início</Label>
          <Controller
            control={control}
            name="startDate"
            render={({ field }) => (
              <DateTimePicker value={field.value} onChange={field.onChange} ariaLabel="Início" />
            )}
          />
          {errors.startDate && <p className="text-sm text-destructive">{errors.startDate.message}</p>}
        </div>
        <div className="space-y-2">
          <Label>Data e hora de finalização</Label>
          <Controller
            control={control}
            name="endDate"
            render={({ field }) => (
              <DateTimePicker value={field.value} onChange={field.onChange} ariaLabel="Fim" />
            )}
          />
          {errors.endDate && <p className="text-sm text-destructive">{errors.endDate.message}</p>}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="timezone">Fuso horário</Label>
        <Input id="timezone" {...register("timezone")} placeholder="America/Sao_Paulo" />
        {errors.timezone && <p className="text-sm text-destructive">{errors.timezone.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="waitingTitle">Título da sala de espera</Label>
        <Input id="waitingTitle" {...register("waitingTitle")} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="waitingSubtitle">Subtítulo da sala de espera</Label>
        <Input id="waitingSubtitle" {...register("waitingSubtitle")} />
      </div>

      <input type="hidden" value={mode} {...register("mode")} />

      <WizardNav webinarId={webinarId} step={2} submitting={pending} />
    </form>
  );
}
```

- [ ] **Step 2: Implement `apps/web/src/app/dashboard/webinars/[id]/(wizard)/step-2/page.tsx`**

```tsx
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "db";
import { Step2Form } from "@/components/wizard/step-2-form";

export default async function Step2Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) notFound();
  const w = await prisma.webinar.findUnique({ where: { id } });
  if (!w || w.ownerId !== session.user.id) notFound();

  return (
    <Step2Form
      webinarId={id}
      initial={{
        mode: w.mode,
        startDate: w.startDate ?? new Date(Date.now() + 24 * 60 * 60 * 1000),
        endDate: w.endDate ?? new Date(Date.now() + 25 * 60 * 60 * 1000),
        timezone: w.timezone,
        waitingTitle: w.waitingTitle,
        waitingSubtitle: w.waitingSubtitle
      }}
    />
  );
}
```

- [ ] **Step 3: Verify typecheck**

```bash
pnpm --filter web typecheck
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/wizard/step-2-form.tsx apps/web/src/app/dashboard/webinars/\[id\]/\(wizard\)/step-2
git commit -m "feat(web): add wizard step 2 (Webinar mode and dates)"
```

---

## Task 11: Step 3 (Login form config) page

**Files:**
- Create: `apps/web/src/components/wizard/step-3-form.tsx`
- Create: `apps/web/src/app/dashboard/webinars/[id]/(wizard)/step-3/page.tsx`

- [ ] **Step 1: Implement `apps/web/src/components/wizard/step-3-form.tsx`**

```tsx
"use client";
import { useTransition } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { step3Schema, type Step3Input } from "@/lib/validations/webinar";
import { updateWebinarStep3 } from "@/server/actions/webinar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { WizardNav } from "@/components/wizard/wizard-nav";

export interface Step3FormProps {
  webinarId: string;
  initial: Step3Input;
}

function FieldToggleRow({
  prefix,
  label,
  control,
  register,
  watch
}: {
  prefix: "name" | "email" | "phone";
  label: string;
  control: any;
  register: any;
  watch: any;
}) {
  const enabled = watch(`${prefix}Enabled`);
  return (
    <div className="grid grid-cols-1 gap-3 rounded-md border p-4 md:grid-cols-3">
      <div>
        <p className="font-medium">{label}</p>
        <Controller
          control={control}
          name={`${prefix}Enabled`}
          render={({ field }) => (
            <label className="mt-2 flex items-center gap-2 text-sm">
              <Switch checked={field.value} onCheckedChange={field.onChange} /> Habilitado
            </label>
          )}
        />
      </div>
      <Controller
        control={control}
        name={`${prefix}Required`}
        render={({ field }) => (
          <label className="flex items-center gap-2 text-sm">
            <Switch
              checked={field.value}
              onCheckedChange={field.onChange}
              disabled={!enabled}
            />
            Obrigatório
          </label>
        )}
      />
      <div className="space-y-1">
        <Label htmlFor={`${prefix}Placeholder`}>Placeholder</Label>
        <Input id={`${prefix}Placeholder`} {...register(`${prefix}Placeholder`)} disabled={!enabled} />
      </div>
    </div>
  );
}

export function Step3Form({ webinarId, initial }: Step3FormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
    setError,
    watch
  } = useForm<Step3Input>({
    resolver: zodResolver(step3Schema),
    defaultValues: initial
  });

  function onSubmit(values: Step3Input) {
    startTransition(async () => {
      const res = await updateWebinarStep3(webinarId, values);
      if ("ok" in res) {
        router.push(`/dashboard/webinars/${webinarId}/step-4`);
      } else if (res.error.field) {
        setError(res.error.field as keyof Step3Input, { message: res.error.message });
      } else {
        toast.error(res.error.message);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-3xl space-y-6">
      <h2 className="text-2xl font-semibold">Login (opt-in)</h2>

      <section className="space-y-4">
        <h3 className="font-semibold">Identidade visual</h3>
        <div className="space-y-2">
          <Label htmlFor="logoUrl">URL do logo</Label>
          <Input id="logoUrl" {...register("logoUrl")} />
          {errors.logoUrl && <p className="text-sm text-destructive">{errors.logoUrl.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="primaryColor">Cor primária (hex)</Label>
          <Input id="primaryColor" type="color" {...register("primaryColor")} className="h-10 w-20" />
          {errors.primaryColor && <p className="text-sm text-destructive">{errors.primaryColor.message}</p>}
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="font-semibold">Botão entrar</h3>
        <div className="space-y-2">
          <Label htmlFor="loginButtonText">Texto</Label>
          <Input id="loginButtonText" {...register("loginButtonText")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="loginButtonColor">Cor (hex)</Label>
          <Input id="loginButtonColor" type="color" {...register("loginButtonColor")} className="h-10 w-20" />
          {errors.loginButtonColor && <p className="text-sm text-destructive">{errors.loginButtonColor.message}</p>}
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="font-semibold">Form opt-in</h3>
        <FieldToggleRow prefix="name" label="Nome" control={control} register={register} watch={watch} />
        <FieldToggleRow prefix="email" label="E-mail" control={control} register={register} watch={watch} />
        <FieldToggleRow prefix="phone" label="Telefone" control={control} register={register} watch={watch} />
      </section>

      <WizardNav webinarId={webinarId} step={3} submitting={pending} />
    </form>
  );
}
```

- [ ] **Step 2: Implement `apps/web/src/app/dashboard/webinars/[id]/(wizard)/step-3/page.tsx`**

```tsx
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "db";
import { Step3Form } from "@/components/wizard/step-3-form";

export default async function Step3Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) notFound();
  const w = await prisma.webinar.findUnique({ where: { id } });
  if (!w || w.ownerId !== session.user.id) notFound();

  return (
    <Step3Form
      webinarId={id}
      initial={{
        logoUrl: w.logoUrl ?? "",
        primaryColor: w.primaryColor ?? "",
        loginButtonText: w.loginButtonText,
        loginButtonColor: w.loginButtonColor,
        nameEnabled: w.nameEnabled,
        nameRequired: w.nameRequired,
        emailEnabled: w.emailEnabled,
        emailRequired: w.emailRequired,
        phoneEnabled: w.phoneEnabled,
        phoneRequired: w.phoneRequired,
        namePlaceholder: w.namePlaceholder,
        emailPlaceholder: w.emailPlaceholder,
        phonePlaceholder: w.phonePlaceholder
      }}
    />
  );
}
```

- [ ] **Step 3: Verify typecheck**

```bash
pnpm --filter web typecheck
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/wizard/step-3-form.tsx apps/web/src/app/dashboard/webinars/\[id\]/\(wizard\)/step-3
git commit -m "feat(web): add wizard step 3 (Login form config)"
```

---

## Task 12: Step 4 (Vídeo — URL externa + upload disabled) page

**Files:**
- Create: `apps/web/src/components/wizard/step-4-form.tsx`
- Create: `apps/web/src/app/dashboard/webinars/[id]/(wizard)/step-4/page.tsx`

- [ ] **Step 1: Implement `apps/web/src/components/wizard/step-4-form.tsx`**

```tsx
"use client";
import { useTransition } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { step4Schema, type Step4Input } from "@/lib/validations/webinar";
import { updateWebinarStep4 } from "@/server/actions/webinar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { SecondsInput } from "@/components/ui/seconds-input";
import { WizardNav } from "@/components/wizard/wizard-nav";

export interface Step4FormProps {
  webinarId: string;
  initial: Step4Input;
}

export function Step4Form({ webinarId, initial }: Step4FormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
    setError
  } = useForm<Step4Input>({
    resolver: zodResolver(step4Schema),
    defaultValues: initial
  });

  const url = watch("videoExternalUrl");

  function onSubmit(values: Step4Input) {
    startTransition(async () => {
      const res = await updateWebinarStep4(webinarId, values);
      if ("ok" in res) {
        router.push(`/dashboard/webinars/${webinarId}/step-5`);
      } else if (res.error.field) {
        setError(res.error.field as keyof Step4Input, { message: res.error.message });
      } else {
        toast.error(res.error.message);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-3xl space-y-6">
      <h2 className="text-2xl font-semibold">Vídeo</h2>

      <Tabs defaultValue="external">
        <TabsList>
          <TabsTrigger value="external">URL externa</TabsTrigger>
          <TabsTrigger value="upload" disabled>
            Upload <Badge variant="outline" className="ml-2">Em breve — sub-plan B2</Badge>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="external" className="mt-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="videoExternalUrl">URL do vídeo (mp4 / m3u8)</Label>
            <Input id="videoExternalUrl" {...register("videoExternalUrl")} placeholder="https://cdn.example.com/v.mp4" />
            {errors.videoExternalUrl && <p className="text-sm text-destructive">{errors.videoExternalUrl.message}</p>}
          </div>
          {url ? (
            <div className="overflow-hidden rounded-md border bg-black">
              <video src={url} controls className="h-64 w-full" />
            </div>
          ) : null}
        </TabsContent>
      </Tabs>

      <div className="space-y-2">
        <Label>Momento "chegou no pitch"</Label>
        <Controller
          control={control}
          name="pitchAtSec"
          render={({ field }) => (
            <SecondsInput
              value={field.value}
              onChange={field.onChange}
              aria-label="pitchAtSec"
            />
          )}
        />
        <p className="text-xs text-muted-foreground">
          Tempo (mm:ss) em que o lead atinge o pitch — usado pelo funil.
        </p>
      </div>

      <WizardNav webinarId={webinarId} step={4} submitting={pending} />
    </form>
  );
}
```

- [ ] **Step 2: Implement `apps/web/src/app/dashboard/webinars/[id]/(wizard)/step-4/page.tsx`**

```tsx
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "db";
import { Step4Form } from "@/components/wizard/step-4-form";

export default async function Step4Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) notFound();
  const w = await prisma.webinar.findUnique({ where: { id }, include: { video: true } });
  if (!w || w.ownerId !== session.user.id) notFound();

  return (
    <Step4Form
      webinarId={id}
      initial={{
        videoExternalUrl: w.video?.originalUrl ?? "",
        pitchAtSec: w.pitchAtSec ?? undefined
      }}
    />
  );
}
```

- [ ] **Step 3: Verify typecheck**

```bash
pnpm --filter web typecheck
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/wizard/step-4-form.tsx apps/web/src/app/dashboard/webinars/\[id\]/\(wizard\)/step-4
git commit -m "feat(web): add wizard step 4 (Vídeo URL externa)"
```

---

## Task 13: Step 5 (Oferta — CTAs editable table) page

**Files:**
- Create: `apps/web/src/components/wizard/step-5-form.tsx`
- Create: `apps/web/src/app/dashboard/webinars/[id]/(wizard)/step-5/page.tsx`

- [ ] **Step 1: Implement `apps/web/src/components/wizard/step-5-form.tsx`**

```tsx
"use client";
import { useTransition } from "react";
import { useForm, Controller, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { step5Schema, type Step5Input } from "@/lib/validations/webinar";
import { updateWebinarStep5 } from "@/server/actions/webinar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SecondsInput } from "@/components/ui/seconds-input";
import { WizardNav } from "@/components/wizard/wizard-nav";

export interface Step5FormProps {
  webinarId: string;
  initial: Step5Input;
}

export function Step5Form({ webinarId, initial }: Step5FormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    control,
    formState: { errors }
  } = useForm<Step5Input>({
    resolver: zodResolver(step5Schema),
    defaultValues: initial
  });
  const { fields, append, remove } = useFieldArray({ control, name: "ctas" });

  function onSubmit(values: Step5Input) {
    startTransition(async () => {
      const res = await updateWebinarStep5(webinarId, values);
      if ("ok" in res) {
        router.push(`/dashboard/webinars/${webinarId}/step-6`);
      } else {
        toast.error(res.error.message);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <h2 className="text-2xl font-semibold">Oferta (CTAs)</h2>

      <div className="space-y-3">
        {fields.map((f, i) => (
          <div key={f.id} className="grid grid-cols-12 items-end gap-2 rounded-md border p-3">
            <div className="col-span-3 space-y-1">
              <Label htmlFor={`ctas.${i}.label`}>Label</Label>
              <Input id={`ctas.${i}.label`} {...register(`ctas.${i}.label` as const)} />
              {errors.ctas?.[i]?.label && <p className="text-xs text-destructive">{errors.ctas[i]?.label?.message}</p>}
            </div>
            <div className="col-span-4 space-y-1">
              <Label htmlFor={`ctas.${i}.url`}>URL</Label>
              <Input id={`ctas.${i}.url`} {...register(`ctas.${i}.url` as const)} />
              {errors.ctas?.[i]?.url && <p className="text-xs text-destructive">{errors.ctas[i]?.url?.message}</p>}
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Mostrar</Label>
              <Controller
                control={control}
                name={`ctas.${i}.showAtSec` as const}
                render={({ field }) => <SecondsInput value={field.value} onChange={field.onChange} aria-label="Mostrar" />}
              />
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Ocultar</Label>
              <Controller
                control={control}
                name={`ctas.${i}.hideAtSec` as const}
                render={({ field }) => <SecondsInput value={field.value} onChange={field.onChange} aria-label="Ocultar" />}
              />
            </div>
            <div className="col-span-1">
              <Button type="button" variant="ghost" size="icon" onClick={() => remove(i)} aria-label="Remover">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={() => append({ label: "", url: "", showAtSec: 0 })}
      >
        <Plus className="mr-2 h-4 w-4" /> Adicionar CTA
      </Button>

      <WizardNav webinarId={webinarId} step={5} submitting={pending} />
    </form>
  );
}
```

- [ ] **Step 2: Implement `apps/web/src/app/dashboard/webinars/[id]/(wizard)/step-5/page.tsx`**

```tsx
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "db";
import { Step5Form } from "@/components/wizard/step-5-form";

export default async function Step5Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) notFound();
  const w = await prisma.webinar.findUnique({
    where: { id },
    include: { ctas: { orderBy: { showAtSec: "asc" } } }
  });
  if (!w || w.ownerId !== session.user.id) notFound();

  return (
    <Step5Form
      webinarId={id}
      initial={{
        ctas: w.ctas.map((c) => ({
          id: c.id,
          label: c.label,
          url: c.url,
          showAtSec: c.showAtSec,
          hideAtSec: c.hideAtSec ?? undefined
        }))
      }}
    />
  );
}
```

- [ ] **Step 3: Verify typecheck**

```bash
pnpm --filter web typecheck
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/wizard/step-5-form.tsx apps/web/src/app/dashboard/webinars/\[id\]/\(wizard\)/step-5
git commit -m "feat(web): add wizard step 5 (Oferta CTAs editable table)"
```

---

## Task 14: Step 6 (Chat) + publish

**Files:**
- Create: `apps/web/src/components/wizard/step-6-form.tsx`
- Create: `apps/web/src/app/dashboard/webinars/[id]/(wizard)/step-6/page.tsx`

- [ ] **Step 1: Implement `apps/web/src/components/wizard/step-6-form.tsx`**

```tsx
"use client";
import { useState, useTransition } from "react";
import { useForm, Controller, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { step6Schema, type Step6Input } from "@/lib/validations/webinar";
import { updateWebinarStep6, publishWebinar } from "@/server/actions/webinar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SecondsInput } from "@/components/ui/seconds-input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from "@/components/ui/alert-dialog";

export interface Step6FormProps {
  webinarId: string;
  initial: Step6Input;
}

export function Step6Form({ webinarId, initial }: Step6FormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [tsv, setTsv] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const {
    register,
    handleSubmit,
    control,
    formState: { errors }
  } = useForm<Step6Input>({
    resolver: zodResolver(step6Schema),
    defaultValues: initial
  });
  const { fields, append, remove } = useFieldArray({ control, name: "messages" });

  function onSubmit(values: Step6Input) {
    startTransition(async () => {
      const r1 = await updateWebinarStep6(webinarId, values);
      if (!("ok" in r1)) {
        toast.error(r1.error.message);
        return;
      }
      const r2 = await publishWebinar(webinarId);
      if ("ok" in r2) {
        toast.success("Webinar publicado");
        router.push("/dashboard/webinars");
      } else {
        toast.error(r2.error.message);
      }
    });
  }

  function importTsv() {
    const rows = tsv
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => line.split("\t"));
    for (const cols of rows) {
      if (cols.length >= 3) {
        const [authorName, text, secStr] = cols;
        const showAtSec = Number.parseInt(secStr, 10);
        if (!Number.isNaN(showAtSec)) {
          append({ authorName, text, showAtSec, isOwner: false });
        }
      }
    }
    setTsv("");
    setImportOpen(false);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Chat scriptado</h2>
        <AlertDialog open={importOpen} onOpenChange={setImportOpen}>
          <AlertDialogTrigger asChild>
            <Button type="button" variant="outline">Importar TSV</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Importar mensagens (TSV)</AlertDialogTitle>
              <AlertDialogDescription>
                Cola linhas no formato <code>nome\tmensagem\tsegundos</code>. Uma por linha.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <textarea
              value={tsv}
              onChange={(e) => setTsv(e.target.value)}
              className="h-40 w-full rounded-md border p-2 font-mono text-sm"
            />
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={importTsv}>Importar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <p className="text-sm text-muted-foreground">
        Use <code>{"{lead.name}"}</code> na mensagem para personalizar com o nome do lead (renderizado pelo player na sub-plan C).
      </p>

      <div className="space-y-3">
        {fields.map((f, i) => (
          <div key={f.id} className="grid grid-cols-12 items-end gap-2 rounded-md border p-3">
            <div className="col-span-3 space-y-1">
              <Label htmlFor={`messages.${i}.authorName`}>Autor</Label>
              <Input id={`messages.${i}.authorName`} {...register(`messages.${i}.authorName` as const)} />
              {errors.messages?.[i]?.authorName && (
                <p className="text-xs text-destructive">{errors.messages[i]?.authorName?.message}</p>
              )}
            </div>
            <div className="col-span-6 space-y-1">
              <Label htmlFor={`messages.${i}.text`}>Mensagem</Label>
              <Input id={`messages.${i}.text`} {...register(`messages.${i}.text` as const)} />
              {errors.messages?.[i]?.text && (
                <p className="text-xs text-destructive">{errors.messages[i]?.text?.message}</p>
              )}
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Mostrar</Label>
              <Controller
                control={control}
                name={`messages.${i}.showAtSec` as const}
                render={({ field }) => <SecondsInput value={field.value} onChange={field.onChange} aria-label="Mostrar" />}
              />
            </div>
            <div className="col-span-1">
              <Button type="button" variant="ghost" size="icon" onClick={() => remove(i)} aria-label="Remover">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={() => append({ authorName: "", text: "", showAtSec: 0, isOwner: false })}
      >
        <Plus className="mr-2 h-4 w-4" /> Adicionar mensagem
      </Button>

      <div className="mt-8 flex items-center justify-between border-t pt-4">
        <Button asChild variant="outline" type="button">
          <a href={`/dashboard/webinars/${webinarId}/step-5`}>← Voltar</a>
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando..." : "Salvar e Ativar"}
        </Button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Implement `apps/web/src/app/dashboard/webinars/[id]/(wizard)/step-6/page.tsx`**

```tsx
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "db";
import { Step6Form } from "@/components/wizard/step-6-form";

export default async function Step6Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) notFound();
  const w = await prisma.webinar.findUnique({
    where: { id },
    include: { chatMessages: { orderBy: { showAtSec: "asc" } } }
  });
  if (!w || w.ownerId !== session.user.id) notFound();

  return (
    <Step6Form
      webinarId={id}
      initial={{
        messages: w.chatMessages.map((m) => ({
          id: m.id,
          authorName: m.authorName,
          text: m.text,
          showAtSec: m.showAtSec,
          isOwner: m.isOwner
        }))
      }}
    />
  );
}
```

- [ ] **Step 3: Verify typecheck**

```bash
pnpm --filter web typecheck
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/wizard/step-6-form.tsx apps/web/src/app/dashboard/webinars/\[id\]/\(wizard\)/step-6
git commit -m "feat(web): add wizard step 6 (Chat) and publish flow"
```

---

## Task 15: Webinars list page + filters + actions

**Files:**
- Create: `apps/web/src/app/dashboard/webinars/page.tsx`
- Create: `apps/web/src/app/dashboard/webinars/new/page.tsx`
- Create: `apps/web/src/components/webinars/new-webinar-button.tsx`
- Create: `apps/web/src/components/webinars/webinars-filters.tsx`
- Create: `apps/web/src/components/webinars/webinars-table.tsx`
- Create: `apps/web/src/components/webinars/row-actions.tsx`
- Create: `apps/web/src/components/webinars/delete-confirm-dialog.tsx`

- [ ] **Step 1: Implement `apps/web/src/app/dashboard/webinars/new/page.tsx`**

```tsx
import { redirect } from "next/navigation";
import { createDraftWebinar } from "@/server/actions/webinar";

export default async function NewWebinarPage() {
  const { id } = await createDraftWebinar();
  redirect(`/dashboard/webinars/${id}/step-1`);
}
```

- [ ] **Step 2: Implement `apps/web/src/components/webinars/new-webinar-button.tsx`**

```tsx
"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createDraftWebinar } from "@/server/actions/webinar";

export function NewWebinarButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      onClick={() =>
        startTransition(async () => {
          const { id } = await createDraftWebinar();
          router.push(`/dashboard/webinars/${id}/step-1`);
        })
      }
      disabled={pending}
    >
      <Plus className="mr-2 h-4 w-4" /> {pending ? "Criando..." : "Criar novo"}
    </Button>
  );
}
```

- [ ] **Step 3: Implement `apps/web/src/components/webinars/webinars-filters.tsx`**

```tsx
"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function WebinarsFilters() {
  const params = useSearchParams();
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [q, setQ] = useState(params.get("q") ?? "");

  function push(next: URLSearchParams) {
    next.delete("page");
    router.push(`/dashboard/webinars?${next.toString()}`);
  }

  function onChange(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value && value !== "ALL") next.set(key, value);
    else next.delete(key);
    startTransition(() => push(next));
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Pesquisar</label>
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onBlur={() => onChange("q", q)}
          placeholder="Nome ou título"
          className="w-64"
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Status</label>
        <Select value={params.get("status") ?? "ALL"} onValueChange={(v) => onChange("status", v)}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos</SelectItem>
            <SelectItem value="DRAFT">Rascunho</SelectItem>
            <SelectItem value="ACTIVE">Ativo</SelectItem>
            <SelectItem value="ARCHIVED">Arquivado</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Tipo</label>
        <Select value={params.get("tipo") ?? "ALL"} onValueChange={(v) => onChange("tipo", v)}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos</SelectItem>
            <SelectItem value="UNICO">Único</SelectItem>
            <SelectItem value="JIT">Just in time</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Ordenar</label>
        <Select value={params.get("sort") ?? "recent"} onValueChange={(v) => onChange("sort", v)}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Mais recentes</SelectItem>
            <SelectItem value="oldest">Mais antigos</SelectItem>
            <SelectItem value="az">A–Z</SelectItem>
            <SelectItem value="za">Z–A</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Implement `apps/web/src/components/webinars/delete-confirm-dialog.tsx`**

```tsx
"use client";
import { useTransition } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { deleteWebinar } from "@/server/actions/webinar";

export function DeleteConfirmDialog({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir webinar?</AlertDialogTitle>
          <AlertDialogDescription>
            Você está prestes a excluir <strong>{title || "Sem título"}</strong>. Essa ação é permanente e remove chats + CTAs + leads associados.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const r = await deleteWebinar(id);
                  if ("ok" in r) {
                    toast.success("Webinar excluído");
                    router.refresh();
                  } else toast.error(r.error.message);
                })
              }
            >
              {pending ? "Excluindo..." : "Excluir"}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

- [ ] **Step 5: Implement `apps/web/src/components/webinars/row-actions.tsx`**

```tsx
"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, Pencil, Files, Trash2, Users, BarChart3, MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { duplicateWebinar } from "@/server/actions/webinar";
import { DeleteConfirmDialog } from "./delete-confirm-dialog";

export function RowActions({
  id,
  title,
  slug,
  publicBaseUrl
}: {
  id: string;
  title: string;
  slug: string | null;
  publicBaseUrl: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  async function copyLink() {
    if (!slug) {
      toast.error("Defina o slug antes de copiar o link");
      return;
    }
    await navigator.clipboard.writeText(`${publicBaseUrl}/w/${slug}`);
    toast.success("Link copiado");
  }

  function onDuplicate() {
    startTransition(async () => {
      const r = await duplicateWebinar(id);
      if ("newId" in r) router.push(`/dashboard/webinars/${r.newId}/step-1`);
      else toast.error(r.error.message);
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={() => router.push(`/dashboard/webinars/${id}/step-1`)}>
          <Pencil className="mr-2 h-4 w-4" /> Editar
        </DropdownMenuItem>
        <DropdownMenuItem onClick={copyLink}>
          <Copy className="mr-2 h-4 w-4" /> Copiar link público
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onDuplicate} disabled={pending}>
          <Files className="mr-2 h-4 w-4" /> {pending ? "Duplicando..." : "Duplicar"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push(`/dashboard/webinars/${id}/leads`)}>
          <Users className="mr-2 h-4 w-4" /> Leads
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push(`/dashboard/webinars/${id}/metrics`)}>
          <BarChart3 className="mr-2 h-4 w-4" /> Métricas
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DeleteConfirmDialog id={id} title={title}>
          <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
            <Trash2 className="mr-2 h-4 w-4" /> Excluir
          </DropdownMenuItem>
        </DeleteConfirmDialog>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

- [ ] **Step 6: Implement `apps/web/src/components/webinars/webinars-table.tsx`**

```tsx
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { format } from "date-fns";
import { RowActions } from "./row-actions";

interface Row {
  id: string;
  name: string;
  title: string;
  slug: string | null;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  mode: "UNICO" | "JIT";
  startDate: Date | null;
  endDate: Date | null;
}

const STATUS_LABEL: Record<Row["status"], string> = {
  DRAFT: "Rascunho",
  ACTIVE: "Ativo",
  ARCHIVED: "Arquivado"
};

export function WebinarsTable({ rows, publicBaseUrl }: { rows: Row[]; publicBaseUrl: string }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-md border bg-card p-8 text-center text-sm text-muted-foreground">
        Nenhum webinar — clique em "Criar novo" para começar.
      </div>
    );
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nome / Data e hora</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Tipo</TableHead>
          <TableHead className="w-12" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.id}>
            <TableCell>
              <div className="font-medium">{r.title || r.name || "Sem título"}</div>
              <div className="text-xs text-muted-foreground">
                {r.startDate ? format(r.startDate, "dd/MM/yyyy HH:mm") : "—"}
                {" → "}
                {r.endDate ? format(r.endDate, "dd/MM/yyyy HH:mm") : "—"}
              </div>
            </TableCell>
            <TableCell><Badge variant={r.status === "ACTIVE" ? "default" : "outline"}>{STATUS_LABEL[r.status]}</Badge></TableCell>
            <TableCell><Badge variant="destructive">{r.mode === "UNICO" ? "Único" : "JIT"}</Badge></TableCell>
            <TableCell>
              <RowActions
                id={r.id}
                title={r.title || r.name}
                slug={r.slug}
                publicBaseUrl={publicBaseUrl}
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

- [ ] **Step 7: Implement `apps/web/src/app/dashboard/webinars/page.tsx`**

```tsx
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Prisma } from "db";
import { prisma } from "db";
import { auth } from "@/lib/auth";
import { WebinarsFilters } from "@/components/webinars/webinars-filters";
import { WebinarsTable } from "@/components/webinars/webinars-table";
import { NewWebinarButton } from "@/components/webinars/new-webinar-button";

const PAGE_SIZE = 20;

export default async function WebinarsPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login?from=/dashboard/webinars");
  const sp = await searchParams;
  const get = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const q = get("q");
  const status = get("status");
  const tipo = get("tipo");
  const sort = get("sort") || "recent";
  const page = Math.max(1, parseInt(get("page") || "1", 10));

  const where: Prisma.WebinarWhereInput = {
    ownerId: session.user.id,
    ...(q && { OR: [{ name: { contains: q, mode: "insensitive" } }, { title: { contains: q, mode: "insensitive" } }] }),
    ...(status === "DRAFT" || status === "ACTIVE" || status === "ARCHIVED" ? { status } : {}),
    ...(tipo === "UNICO" || tipo === "JIT" ? { mode: tipo } : {})
  };
  const orderBy: Prisma.WebinarOrderByWithRelationInput =
    sort === "az" ? { title: "asc" } :
    sort === "za" ? { title: "desc" } :
    sort === "oldest" ? { createdAt: "asc" } :
    { createdAt: "desc" };

  const [rows, total] = await Promise.all([
    prisma.webinar.findMany({
      where,
      orderBy,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE
    }),
    prisma.webinar.count({ where })
  ]);

  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const publicBaseUrl = process.env.NEXT_PUBLIC_BETTER_AUTH_URL ?? "http://localhost:3000";

  return (
    <div className="container mx-auto py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold">Webinars</h1>
        <NewWebinarButton />
      </div>
      <div className="mt-6">
        <WebinarsFilters />
      </div>
      <div className="mt-6">
        <WebinarsTable rows={rows} publicBaseUrl={publicBaseUrl} />
      </div>
      <div className="mt-6 flex items-center justify-between text-sm text-muted-foreground">
        <span>Total: {total} · Página {page} de {lastPage}</span>
        <div className="flex gap-2">
          {page > 1 && (
            <a href={`/dashboard/webinars?${new URLSearchParams({ ...Object.fromEntries(Object.entries(sp).map(([k, v]) => [k, String(v ?? "")])), page: String(page - 1) }).toString()}`} className="rounded-md border px-3 py-1">Anterior</a>
          )}
          {page < lastPage && (
            <a href={`/dashboard/webinars?${new URLSearchParams({ ...Object.fromEntries(Object.entries(sp).map(([k, v]) => [k, String(v ?? "")])), page: String(page + 1) }).toString()}`} className="rounded-md border px-3 py-1">Próximo</a>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Verify typecheck**

```bash
pnpm --filter web typecheck
```

Expected: clean.

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/app/dashboard/webinars/page.tsx apps/web/src/app/dashboard/webinars/new apps/web/src/components/webinars
git commit -m "feat(web): add webinars list page with filters, table, and row actions"
```

---

## Task 16: Stub pages (videos / leads / metrics)

**Files:**
- Create: `apps/web/src/app/dashboard/videos/page.tsx`
- Create: `apps/web/src/app/dashboard/webinars/[id]/leads/page.tsx`
- Create: `apps/web/src/app/dashboard/webinars/[id]/metrics/page.tsx`

- [ ] **Step 1: Implement `apps/web/src/app/dashboard/videos/page.tsx`**

```tsx
export default function VideosPage() {
  return (
    <div className="container mx-auto py-10">
      <h1 className="text-3xl font-semibold">Vídeos</h1>
      <p className="mt-2 text-muted-foreground">
        Em breve — sub-plan B2 entrega upload, MinIO storage e transcode HLS.
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Implement `apps/web/src/app/dashboard/webinars/[id]/leads/page.tsx`**

```tsx
export default function LeadsStub() {
  return (
    <div className="container mx-auto py-10">
      <h1 className="text-3xl font-semibold">Leads</h1>
      <p className="mt-2 text-muted-foreground">
        Em breve — sub-plan E entrega lista real de leads.
      </p>
    </div>
  );
}
```

- [ ] **Step 3: Implement `apps/web/src/app/dashboard/webinars/[id]/metrics/page.tsx`**

```tsx
export default function MetricsStub() {
  return (
    <div className="container mx-auto py-10">
      <h1 className="text-3xl font-semibold">Métricas</h1>
      <p className="mt-2 text-muted-foreground">
        Em breve — sub-plan E entrega funil + heatmap CTA por webinar.
      </p>
    </div>
  );
}
```

- [ ] **Step 4: Verify typecheck**

```bash
pnpm --filter web typecheck
```

Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/dashboard/videos apps/web/src/app/dashboard/webinars/\[id\]/leads apps/web/src/app/dashboard/webinars/\[id\]/metrics
git commit -m "feat(web): add stubs for /videos, /webinars/[id]/leads, /webinars/[id]/metrics"
```

---

## Task 17: E2E webinar CRUD smoke test

**Files:**
- Create: `apps/web/src/test/e2e/webinar-crud.spec.ts`

- [ ] **Step 1: Implement `apps/web/src/test/e2e/webinar-crud.spec.ts`**

```ts
import { test, expect } from "@playwright/test";

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "admin@example.com";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "test-password-min-12";

async function login(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(ADMIN_EMAIL);
  await page.getByLabel("Senha").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL("/dashboard");
}

test("admin can create, publish, edit, duplicate, and delete a webinar", async ({ page }) => {
  test.slow();
  await login(page);

  await page.goto("/dashboard/webinars");
  await expect(page.getByRole("heading", { name: "Webinars" })).toBeVisible();

  const slug = `e2e-${Date.now()}`;

  await page.getByRole("button", { name: /Criar novo/ }).click();
  await expect(page).toHaveURL(/\/dashboard\/webinars\/.+\/step-1$/);

  await page.getByLabel("Nome interno").fill("E2E Webinar");
  await page.getByLabel("Título público").fill("E2E Webinar Público");
  await page.getByLabel("URL amigável").fill(slug);
  await page.getByLabel("Idioma").fill("pt-BR");
  await page.getByRole("button", { name: /Continuar/ }).click();

  await expect(page).toHaveURL(/\/step-2$/);
  await page.getByRole("button", { name: /Continuar/ }).click();

  await expect(page).toHaveURL(/\/step-3$/);
  await page.getByRole("button", { name: /Continuar/ }).click();

  await expect(page).toHaveURL(/\/step-4$/);
  await page.getByLabel(/URL do vídeo/).fill("https://example.com/v.mp4");
  await page.getByRole("button", { name: /Continuar/ }).click();

  await expect(page).toHaveURL(/\/step-5$/);
  await page.getByRole("button", { name: /Continuar/ }).click();

  await expect(page).toHaveURL(/\/step-6$/);
  await page.getByRole("button", { name: /Salvar e Ativar/ }).click();
  await expect(page).toHaveURL("/dashboard/webinars");
  await expect(page.getByText("E2E Webinar Público")).toBeVisible();

  await page.getByText("E2E Webinar Público").locator("xpath=ancestor::tr").getByRole("button").last().click();
  await page.getByRole("menuitem", { name: /Excluir/ }).click();
  await page.getByRole("button", { name: /Excluir$/ }).click();
  await expect(page.getByText("E2E Webinar Público")).toHaveCount(0);
});
```

- [ ] **Step 2: Re-seed admin (E2E password) before running**

```bash
docker exec hotwebinar-pg psql -U hotwebinar -d hotwebinar -c "TRUNCATE \"user\", \"account\", \"session\", \"verification\" CASCADE"
SEED_ADMIN_EMAIL=admin@example.com \
SEED_ADMIN_PASSWORD=test-password-min-12 \
SEED_ADMIN_NAME=Admin \
DATABASE_URL=postgresql://hotwebinar:hotwebinar@localhost:5432/hotwebinar?schema=public \
BETTER_AUTH_SECRET=e2e-test-secret-at-least-32-chars-long-okay \
BETTER_AUTH_URL=http://localhost:3000 \
  pnpm --filter web seed
```

- [ ] **Step 3: Run E2E**

```bash
pnpm --filter web test:e2e
```

Expected: all 3 tests pass (2 from sub-plan A login + 1 new webinar CRUD).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/test/e2e/webinar-crud.spec.ts
git commit -m "test(web): add E2E webinar CRUD golden path"
```

---

## Final acceptance

- [ ] **Step 1: Walk through DoD**

1. `pnpm db:migrate:dev` applies the `domain` migration cleanly on a fresh DB.
2. `/dashboard/webinars` renders empty state + "Criar novo".
3. "Criar novo" creates DRAFT inheriting language/timezone, redirects to step-1.
4. Wizard 6 steps render forms, validate Zod, save on "Continuar". "Voltar" works.
5. Step 4 URL externa creates a `Video { source: EXTERNAL, status: READY }` linked to Webinar.
6. Step 5 CTAs editable table works (add/remove/edit). Persists with id-preservation.
7. Step 6 Chat editable + TSV import works. Persists with id-preservation.
8. Step 6 "Salvar e Ativar" publishes (or surfaces missing-field message).
9. List page shows webinars with badges, search, sort, status filter, tipo filter, pagination 20.
10. Row actions: edit, copy link, duplicate, delete (AlertDialog), leads/metrics stubs.
11. `/dashboard/settings` loads + saves AccountSettings.
12. `/dashboard/videos`, `/dashboard/webinars/[id]/leads`, `/dashboard/webinars/[id]/metrics` render stubs.
13. Sidebar links resolve.
14. `pnpm -r test` + `pnpm --filter web test:e2e` pass.
15. `pnpm -r typecheck` clean.

- [ ] **Step 2: Final commit if anything changed during acceptance**

```bash
git status
git add -p
git commit -m "chore(web): B1 acceptance fixes"
```

---

## Self-Review (notes for the implementer)

- **Spec coverage:** every section/requirement of the design spec has at least one task. The 4 deferred items (B2 upload, C player, E analytics, F deploy) are explicit out-of-scope.
- **Migration timing:** Task 1 must run before any other task that imports `db` types or hits `prisma.webinar.*`. The earliest such consumer is Task 5 (settings actions test). If Task 1 isn't applied yet, test files will fail to import or query.
- **shadcn install:** if the CLI fails (offline, registry issue), copy primitives manually from https://ui.shadcn.com/docs/components/<name>. Do NOT pass `--all` — would clobber Button/Input/Label.
- **`x-pathname` header:** Task 8's wizard layout reads `x-pathname` to pick the active step. Sub-plan A noted that no one currently writes this header, so the layout falls back. For B1 it works because each step page is a distinct route, and the layout is recreated per route (so `pathname` derivation could also use `usePathname()` after splitting Sidebar to a client component). If active-step highlight is broken, switch the layout to a client component or add a server-side helper that reads the URL through `headers()`.
- **DateTimePicker timezone:** the picker stores the chosen Date in local time. The user's chosen `timezone` field is currently informational; full TZ-aware persistence is sub-plan E concern.
- **Filters URL encoding:** the pagination links re-serialize `searchParams` in raw form. Edge cases (array-typed params) shouldn't appear in B1 since all filters are scalar, but if they do, the `Object.fromEntries` cast may need to handle arrays.
- **Test isolation across actions tests:** both `webinar.test.ts` and `settings.test.ts` truncate the user table in `beforeEach`. They will compete if they ever run in parallel against the same DB. Vitest runs files in workers in parallel by default but tests within a file are sequential — keep them in separate files and accept the duplicated truncate. If you want stricter isolation, set `pool: "threads"` + `poolOptions.threads.singleThread: true` in `vitest.config.ts`.
- **Chat `{lead.name}` interpolation:** purely declarative in B1. The player in sub-plan C does the substitution at render time.
- **Wizard "Voltar":** uses `<Link>` to navigate. Browser back also works. `react-hook-form` dirty-state warning on browser unload is desired but not implemented in this plan — add to sub-plan B1 follow-up if regressions appear.
- **Open-redirect guard:** sub-plan A added one to `/login`. No new redirect surface in B1 needs guards.
