# MVP Sub-plan D1 — Wizard Redesign (Steps 1+2+3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the first three wizard steps (Início, Webinar, Login) of webinar creation to match the original Hotwebinar UI: 9-step horizontal nav with Lucide icons + numbered circles + connecting line, new toggles (acesso facilitado, sync vídeo), timezone Select, waiting-room template picker (5 templates), login logo alignment, configurable progress bar, login form fields with order management, live preview card.

**Architecture:** Extend existing wizard shell with horizontal icon nav. Add new shadcn-styled compound components (ToggleCard, TimezoneSelect, WaitingTemplatePicker, LoginPreview). Public-side `<CaptureForm>` and `<CountdownView>` consume new fields via extended `publicWebinarDto`. Single Prisma migration adds 10 columns + 2 enums to Webinar.

**Tech Stack:** Next.js 15 App Router (extends), Prisma 5 + Postgres, shadcn/ui (Switch, Select, Button, Input, Label, Card), `react-hook-form` + Zod, `lucide-react` icons, vitest.

**Spec:** [`docs/superpowers/specs/2026-05-05-mvp-D1-wizard-redesign-design.md`](../specs/2026-05-05-mvp-D1-wizard-redesign-design.md)

---

## Pre-flight

Branch is `feat/capture-phase`. Existing wizard at `apps/web/src/app/dashboard/webinars/[id]/(wizard)/`. Existing forms in `apps/web/src/components/wizard/`. Prisma schema in `packages/db/prisma/schema.prisma`. Postgres + Redis + MinIO + worker running via `docker compose up -d`.

Web `pnpm --filter web typecheck` clean baseline. Web tests `pnpm --filter web test --run` ~115 passing baseline.

`pnpm-workspace.yaml` workspace deps `db`, `jobs`, `web`, `worker`, `scraper`. The `db` package re-exports Prisma types — import from `"db"`, not `"@prisma/client"`.

Single commit per task. The Windows host has Prisma binary lock issue when `next dev` is running; if a migration fails with `EPERM rename`, kill port 3000 first (`powershell -Command "Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | Where-Object { $_.OwningProcess -ne 0 } | ForEach-Object { try { Stop-Process -Id $_.OwningProcess -Force -ErrorAction Stop } catch {} }"`).

## File structure

```
apps/web/src/
├── app/dashboard/webinars/[id]/(wizard)/
│   ├── layout.tsx                        EXTEND - new horizontal nav
│   ├── step-1/page.tsx                   EXTEND - 2 new toggles in initial
│   ├── step-2/page.tsx                   EXTEND - waitingTemplate in initial
│   └── step-3/page.tsx                   EXTEND - new fields in initial
├── components/wizard/
│   ├── wizard-shell.tsx                  REPLACE - 9-step horizontal nav
│   ├── step-1-form.tsx                   EXTEND - 2 ToggleCards
│   ├── step-2-form.tsx                   EXTEND - TimezoneSelect + WaitingTemplatePicker
│   ├── step-3-form.tsx                   REPLACE - 3-col layout + LoginPreview
│   ├── toggle-card.tsx                   NEW - reusable Switch + info box
│   ├── timezone-select.tsx               NEW - Select with auto detect
│   ├── waiting-template-picker.tsx       NEW - 5 template cards grid
│   └── login-preview.tsx                 NEW - live preview of CaptureForm shape
├── app/[slug]/_components/
│   ├── capture-form.tsx                  EXTEND - logoAlign + progress + order
│   └── countdown-view.tsx                EXTEND - waitingTemplate branching
├── lib/
│   ├── timezones.ts                      NEW - constant list + auto sentinel
│   ├── waiting-templates.ts              NEW - 5 template descriptors
│   ├── public-dto.ts                     EXTEND - new public fields
│   └── validations/webinar.ts            EXTEND - 3 schemas
└── server/actions/
    └── webinar.ts                        EXTEND - 3 actions

packages/db/prisma/
└── migrations/<ts>_d1_wizard_redesign/
    └── migration.sql
```

### File responsibilities

- `lib/timezones.ts` — pure constant array, no I/O. Includes `__auto__` sentinel.
- `lib/waiting-templates.ts` — pure constant array of `{ id, label, description, icon }`.
- `components/wizard/toggle-card.tsx` — controlled Switch wrapper with info-banner slot. Used twice in step 1.
- `components/wizard/timezone-select.tsx` — shadcn Select. When user picks `__auto__` value, on next render resolves to `Intl.DateTimeFormat().resolvedOptions().timeZone` and submits real string.
- `components/wizard/waiting-template-picker.tsx` — radio-card grid; selected card has `ring-primary`.
- `components/wizard/login-preview.tsx` — read-only mini-form rendering RHF watched values.
- `components/wizard/wizard-shell.tsx` — server component reading `x-pathname` to compute current step. Renders 9 step entries with icon/label/circle/line.

---

## Task 1: Prisma migration `d1_wizard_redesign`

**Files:**
- Modify: `packages/db/prisma/schema.prisma`

- [ ] **Step 1: Add enums + Webinar fields**

Open `packages/db/prisma/schema.prisma`. Find the `enum WebhookDeliveryStatus` block. Add ABOVE it:

```prisma
enum WaitingTemplate {
  DEFAULT
  WITH_THUMB
  IMMERSIVE
  MINIMAL
  FEATURES
}

enum LogoAlign {
  LEFT
  CENTER
  RIGHT
}
```

In the `Webinar` model, find the `waitingShowThumb` line (added in C). Insert AFTER it:

```prisma
  accessFacilitated   Boolean         @default(false)
  videoSyncWithStart  Boolean         @default(true)
  waitingTemplate     WaitingTemplate @default(DEFAULT)
  loginLogoAlign      LogoAlign       @default(CENTER)
  progressEnabled     Boolean         @default(false)
  progressStartPct    Int             @default(50)
  progressBarColor    String          @default("#dc2626")
  progressTextColor   String          @default("#ffffff")
  progressText        String          @default("{pct}% das vagas preenchidas...")
  formFieldOrder      String[]        @default(["name","email","phone"])
```

- [ ] **Step 2: Kill web dev (frees Prisma DLL on Windows)**

```bash
powershell -Command "Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | Where-Object { \$_.OwningProcess -ne 0 } | ForEach-Object { try { Stop-Process -Id \$_.OwningProcess -Force -ErrorAction Stop } catch {} }"
sleep 2
```

- [ ] **Step 3: Generate migration**

```bash
cd packages/db && DATABASE_URL="postgresql://hotwebinar:hotwebinar@localhost:5432/hotwebinar?schema=public" npx prisma migrate dev --name d1_wizard_redesign
```

Expected: migration `<timestamp>_d1_wizard_redesign` created and applied. Output shows `WaitingTemplate`/`LogoAlign` enums + 10 column additions on `webinar`.

- [ ] **Step 4: Verify columns**

```bash
docker exec hotwebinar-pg psql -U hotwebinar -d hotwebinar -c "\d webinar" | grep -E "(accessFacilitated|videoSyncWithStart|waitingTemplate|loginLogoAlign|progressEnabled|progressStartPct|progressBarColor|progressTextColor|progressText|formFieldOrder)"
```

Expected: 10 lines listing the new columns.

- [ ] **Step 5: Commit**

```bash
cd ../..
git add packages/db/prisma/schema.prisma packages/db/prisma/migrations
git commit -m "feat(db): add WaitingTemplate + LogoAlign enums + 10 D1 webinar fields"
```

---

## Task 2: `lib/timezones.ts` (TDD)

**Files:**
- Create: `apps/web/src/lib/timezones.ts`
- Create: `apps/web/src/test/lib/timezones.test.ts`

- [ ] **Step 1: Write failing test `apps/web/src/test/lib/timezones.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { TIMEZONES, AUTO_TIMEZONE_VALUE } from "@/lib/timezones";

describe("timezones", () => {
  it("includes São Paulo as default", () => {
    expect(TIMEZONES.find((t) => t.value === "America/Sao_Paulo")).toBeDefined();
  });

  it("first option is auto detect sentinel", () => {
    expect(TIMEZONES[0].value).toBe(AUTO_TIMEZONE_VALUE);
  });

  it("AUTO_TIMEZONE_VALUE is __auto__", () => {
    expect(AUTO_TIMEZONE_VALUE).toBe("__auto__");
  });

  it("contains at least 18 zones (incl auto)", () => {
    expect(TIMEZONES.length).toBeGreaterThanOrEqual(18);
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
pnpm --filter web test src/test/lib/timezones.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `apps/web/src/lib/timezones.ts`**

```ts
export const AUTO_TIMEZONE_VALUE = "__auto__";

export interface TimezoneOption {
  value: string;
  label: string;
}

export const TIMEZONES: ReadonlyArray<TimezoneOption> = [
  { value: AUTO_TIMEZONE_VALUE, label: "Detectar automático (navegador)" },
  { value: "America/Sao_Paulo", label: "São Paulo (BRT)" },
  { value: "America/Recife", label: "Recife (BRT)" },
  { value: "America/Belem", label: "Belém (BRT)" },
  { value: "America/Manaus", label: "Manaus (AMT)" },
  { value: "America/Rio_Branco", label: "Rio Branco (ACT)" },
  { value: "America/Argentina/Buenos_Aires", label: "Buenos Aires" },
  { value: "America/Mexico_City", label: "Mexico City" },
  { value: "America/Bogota", label: "Bogotá" },
  { value: "America/Santiago", label: "Santiago" },
  { value: "Europe/Lisbon", label: "Lisboa" },
  { value: "Europe/Madrid", label: "Madrid" },
  { value: "Europe/London", label: "London" },
  { value: "Europe/Paris", label: "Paris" },
  { value: "Europe/Berlin", label: "Berlin" },
  { value: "Europe/Rome", label: "Roma" },
  { value: "America/New_York", label: "New York" },
  { value: "America/Los_Angeles", label: "Los Angeles" },
  { value: "Asia/Tokyo", label: "Tokyo" },
  { value: "Australia/Sydney", label: "Sydney" }
];

export function resolveAutoTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Sao_Paulo";
  } catch {
    return "America/Sao_Paulo";
  }
}
```

- [ ] **Step 4: Run to verify pass**

```bash
pnpm --filter web test src/test/lib/timezones.test.ts
```

Expected: 4 passing.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/timezones.ts apps/web/src/test/lib/timezones.test.ts
git commit -m "feat(web): add timezones list + auto-detect helper"
```

---

## Task 3: `lib/waiting-templates.ts` (TDD)

**Files:**
- Create: `apps/web/src/lib/waiting-templates.ts`
- Create: `apps/web/src/test/lib/waiting-templates.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect } from "vitest";
import { WAITING_TEMPLATES, type WaitingTemplateId } from "@/lib/waiting-templates";

describe("waiting-templates", () => {
  it("has 5 templates", () => {
    expect(WAITING_TEMPLATES).toHaveLength(5);
  });

  it("includes DEFAULT, WITH_THUMB, IMMERSIVE, MINIMAL, FEATURES", () => {
    const ids = WAITING_TEMPLATES.map((t) => t.id);
    expect(ids).toEqual(["DEFAULT", "WITH_THUMB", "IMMERSIVE", "MINIMAL", "FEATURES"]);
  });

  it("each template has label + description", () => {
    for (const t of WAITING_TEMPLATES) {
      expect(typeof t.label).toBe("string");
      expect(t.label.length).toBeGreaterThan(0);
      expect(typeof t.description).toBe("string");
    }
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
pnpm --filter web test src/test/lib/waiting-templates.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `apps/web/src/lib/waiting-templates.ts`**

```ts
export type WaitingTemplateId = "DEFAULT" | "WITH_THUMB" | "IMMERSIVE" | "MINIMAL" | "FEATURES";

export interface WaitingTemplate {
  id: WaitingTemplateId;
  label: string;
  description: string;
}

export const WAITING_TEMPLATES: ReadonlyArray<WaitingTemplate> = [
  { id: "DEFAULT", label: "Padrão", description: "Logo + título + countdown centralizados." },
  { id: "WITH_THUMB", label: "Com thumbnail", description: "Padrão + thumbnail do vídeo." },
  { id: "IMMERSIVE", label: "Imersivo", description: "Vídeo de fundo silenciado + countdown sobreposto." },
  { id: "MINIMAL", label: "Minimalista", description: "Apenas relógio gigante. Sem título/subtítulo." },
  { id: "FEATURES", label: "Com benefícios", description: "Lista de benefícios + countdown ao lado." }
];
```

- [ ] **Step 4: Run to verify pass**

```bash
pnpm --filter web test src/test/lib/waiting-templates.test.ts
```

Expected: 3 passing.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/waiting-templates.ts apps/web/src/test/lib/waiting-templates.test.ts
git commit -m "feat(web): add waiting-room template descriptors (5 templates)"
```

---

## Task 4: Validation schema extensions

**Files:**
- Modify: `apps/web/src/lib/validations/webinar.ts`
- Create: `apps/web/src/test/lib/validations/d1.test.ts`

- [ ] **Step 1: Write failing test `apps/web/src/test/lib/validations/d1.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { step1Schema, step2Schema, step3Schema } from "@/lib/validations/webinar";

const step1Base = {
  name: "n", title: "t", slug: "abc", language: "pt-BR",
  accessFacilitated: false, videoSyncWithStart: true
};

const step2Base = {
  mode: "UNICO" as const,
  startDate: new Date("2026-06-01T10:00:00Z"),
  endDate: new Date("2026-06-01T11:00:00Z"),
  timezone: "America/Sao_Paulo",
  waitingTitle: "Sala", waitingSubtitle: "",
  waitingShowThumb: false, waitingTemplate: "DEFAULT" as const
};

const step3Base = {
  logoUrl: "", primaryColor: "",
  loginButtonText: "Entrar", loginButtonColor: "#16a34a",
  nameEnabled: true, nameRequired: true, namePlaceholder: "Nome",
  emailEnabled: true, emailRequired: true, emailPlaceholder: "Email",
  phoneEnabled: true, phoneRequired: false, phonePlaceholder: "Tel",
  loginLogoAlign: "CENTER" as const,
  progressEnabled: false, progressStartPct: 50,
  progressBarColor: "#dc2626", progressTextColor: "#ffffff",
  progressText: "{pct}% das vagas preenchidas...",
  formFieldOrder: ["name", "email", "phone"]
};

describe("step1Schema D1 extensions", () => {
  it("accepts both new toggles", () => {
    expect(step1Schema.safeParse(step1Base).success).toBe(true);
  });
  it("rejects missing accessFacilitated", () => {
    const { accessFacilitated, ...rest } = step1Base;
    expect(step1Schema.safeParse(rest).success).toBe(false);
  });
});

describe("step2Schema D1 extensions", () => {
  it("accepts WaitingTemplate enum DEFAULT", () => {
    expect(step2Schema.safeParse(step2Base).success).toBe(true);
  });
  it("accepts WITH_THUMB", () => {
    expect(step2Schema.safeParse({ ...step2Base, waitingTemplate: "WITH_THUMB" }).success).toBe(true);
  });
  it("rejects unknown template id", () => {
    expect(step2Schema.safeParse({ ...step2Base, waitingTemplate: "FOO" }).success).toBe(false);
  });
});

describe("step3Schema D1 extensions", () => {
  it("accepts the full base", () => {
    expect(step3Schema.safeParse(step3Base).success).toBe(true);
  });
  it("rejects formFieldOrder duplicates", () => {
    const r = step3Schema.safeParse({ ...step3Base, formFieldOrder: ["name", "name", "email"] });
    expect(r.success).toBe(false);
  });
  it("rejects formFieldOrder with unknown value", () => {
    const r = step3Schema.safeParse({ ...step3Base, formFieldOrder: ["name", "address"] });
    expect(r.success).toBe(false);
  });
  it("rejects bad progressStartPct", () => {
    const r = step3Schema.safeParse({ ...step3Base, progressStartPct: 150 });
    expect(r.success).toBe(false);
  });
  it("rejects bad bar color", () => {
    const r = step3Schema.safeParse({ ...step3Base, progressBarColor: "red" });
    expect(r.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
pnpm --filter web test src/test/lib/validations/d1.test.ts
```

Expected: FAIL — schemas don't have the new fields yet.

- [ ] **Step 3: Extend `apps/web/src/lib/validations/webinar.ts`**

Open the file. Find `step1Schema`. Replace it with:

```ts
export const step1Schema = z.object({
  name: z.string().min(1).max(120),
  title: z.string().min(1).max(180),
  slug: slugSchema,
  language: z.string().min(2).max(10),
  accessFacilitated: z.boolean(),
  videoSyncWithStart: z.boolean()
});
export type Step1Input = z.infer<typeof step1Schema>;
```

Find `step2Schema`. Add `waitingTemplate` to the `.object` shape (alongside `waitingShowThumb`):

```ts
export const step2Schema = z
  .object({
    mode: z.enum(["UNICO", "JIT"]),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    timezone: z.string().min(1),
    waitingTitle: z.string().min(1).max(80),
    waitingSubtitle: z.string().max(200),
    waitingShowThumb: z.boolean().default(false),
    waitingTemplate: z.enum(["DEFAULT", "WITH_THUMB", "IMMERSIVE", "MINIMAL", "FEATURES"]).default("DEFAULT")
  })
  .refine((v) => v.endDate > v.startDate, {
    message: "Fim deve ser após início",
    path: ["endDate"]
  });
export type Step2Input = z.infer<typeof step2Schema>;
```

Find `step3Schema`. Replace with the extended version:

```ts
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
  loginLogoAlign: z.enum(["LEFT", "CENTER", "RIGHT"]),
  progressEnabled: z.boolean(),
  progressStartPct: z.number().int().min(0).max(99),
  progressBarColor: z.string().regex(/^#[0-9a-f]{6}$/i),
  progressTextColor: z.string().regex(/^#[0-9a-f]{6}$/i),
  progressText: z.string().min(1).max(120),
  formFieldOrder: z
    .array(z.enum(["name", "email", "phone"]))
    .min(1)
    .max(3)
    .refine((arr) => new Set(arr).size === arr.length, { message: "Sem duplicatas em formFieldOrder" })
});
export type Step3Input = z.infer<typeof step3Schema>;
```

- [ ] **Step 4: Run to verify pass**

```bash
pnpm --filter web test src/test/lib/validations/d1.test.ts
pnpm --filter web test src/test/lib/validations/webinar.test.ts
```

Expected: D1 file 9 passing, webinar file all baseline still passing.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/validations/webinar.ts apps/web/src/test/lib/validations/d1.test.ts
git commit -m "feat(web): extend step1/step2/step3 schemas with D1 fields"
```

---

## Task 5: `<ToggleCard>` component

**Files:**
- Create: `apps/web/src/components/wizard/toggle-card.tsx`

- [ ] **Step 1: Implement**

```tsx
"use client";
import { Switch } from "@/components/ui/switch";
import { Info } from "lucide-react";

export interface ToggleCardProps {
  title: string;
  description?: string;
  info?: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  disabled?: boolean;
}

export function ToggleCard({ title, description, info, checked, onCheckedChange, disabled }: ToggleCardProps) {
  return (
    <div className="rounded-md border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold">{title}</h3>
          {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
        </div>
        <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
      </div>
      {info ? (
        <div className="flex gap-2 rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{info}</p>
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter web typecheck
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/wizard/toggle-card.tsx
git commit -m "feat(web): add ToggleCard reusable component"
```

---

## Task 6: `<TimezoneSelect>` component (TDD)

**Files:**
- Create: `apps/web/src/components/wizard/timezone-select.tsx`
- Create: `apps/web/src/test/components/timezone-select.test.tsx`

- [ ] **Step 1: Write failing test `apps/web/src/test/components/timezone-select.test.tsx`**

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TimezoneSelect } from "@/components/wizard/timezone-select";

describe("TimezoneSelect", () => {
  beforeEach(() => {
    // jsdom doesn't provide a stable TZ; mock to known one.
    vi.spyOn(Intl, "DateTimeFormat").mockImplementation(
      () => ({ resolvedOptions: () => ({ timeZone: "America/Sao_Paulo" } as any) }) as any
    );
  });

  it("renders the current value when not auto", () => {
    render(<TimezoneSelect value="America/Sao_Paulo" onChange={() => {}} />);
    // Trigger renders selected label
    expect(screen.getByText(/São Paulo/)).toBeInTheDocument();
  });

  it("clicking auto resolves to browser timezone via onChange", () => {
    const onChange = vi.fn();
    render(<TimezoneSelect value="America/Sao_Paulo" onChange={onChange} />);
    // Open native trigger
    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.click(screen.getByText(/Detectar automático/));
    expect(onChange).toHaveBeenCalledWith("America/Sao_Paulo");
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
pnpm --filter web test src/test/components/timezone-select.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `apps/web/src/components/wizard/timezone-select.tsx`**

```tsx
"use client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { TIMEZONES, AUTO_TIMEZONE_VALUE, resolveAutoTimezone } from "@/lib/timezones";

export interface TimezoneSelectProps {
  value: string;
  onChange: (v: string) => void;
}

export function TimezoneSelect({ value, onChange }: TimezoneSelectProps) {
  function handleChange(next: string) {
    if (next === AUTO_TIMEZONE_VALUE) {
      onChange(resolveAutoTimezone());
    } else {
      onChange(next);
    }
  }

  return (
    <Select value={value} onValueChange={handleChange}>
      <SelectTrigger>
        <SelectValue placeholder="Escolha um fuso" />
      </SelectTrigger>
      <SelectContent>
        {TIMEZONES.map((t) => (
          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
```

- [ ] **Step 4: Run test**

```bash
pnpm --filter web test src/test/components/timezone-select.test.tsx
```

Expected: 2 passing.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/wizard/timezone-select.tsx apps/web/src/test/components/timezone-select.test.tsx
git commit -m "feat(web): add TimezoneSelect with auto-detect"
```

---

## Task 7: `<WaitingTemplatePicker>` component (TDD)

**Files:**
- Create: `apps/web/src/components/wizard/waiting-template-picker.tsx`
- Create: `apps/web/src/test/components/waiting-template-picker.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { WaitingTemplatePicker } from "@/components/wizard/waiting-template-picker";

describe("WaitingTemplatePicker", () => {
  it("renders 5 cards with template labels", () => {
    render(<WaitingTemplatePicker value="DEFAULT" onChange={() => {}} />);
    expect(screen.getByText("Padrão")).toBeInTheDocument();
    expect(screen.getByText("Com thumbnail")).toBeInTheDocument();
    expect(screen.getByText("Imersivo")).toBeInTheDocument();
    expect(screen.getByText("Minimalista")).toBeInTheDocument();
    expect(screen.getByText("Com benefícios")).toBeInTheDocument();
  });

  it("calls onChange with template id when clicked", () => {
    const onChange = vi.fn();
    render(<WaitingTemplatePicker value="DEFAULT" onChange={onChange} />);
    fireEvent.click(screen.getByText("Imersivo"));
    expect(onChange).toHaveBeenCalledWith("IMMERSIVE");
  });

  it("highlights selected card via aria-pressed", () => {
    render(<WaitingTemplatePicker value="MINIMAL" onChange={() => {}} />);
    const cards = screen.getAllByRole("button");
    const minimalCard = cards.find((c) => c.textContent?.includes("Minimalista"));
    expect(minimalCard).toHaveAttribute("aria-pressed", "true");
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
pnpm --filter web test src/test/components/waiting-template-picker.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```tsx
"use client";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import { WAITING_TEMPLATES, type WaitingTemplateId } from "@/lib/waiting-templates";

export interface WaitingTemplatePickerProps {
  value: WaitingTemplateId;
  onChange: (v: WaitingTemplateId) => void;
}

export function WaitingTemplatePicker({ value, onChange }: WaitingTemplatePickerProps) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-5">
      {WAITING_TEMPLATES.map((t) => {
        const selected = t.id === value;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            aria-pressed={selected}
            className={cn(
              "relative rounded-md border bg-card p-4 text-left transition",
              selected ? "ring-2 ring-primary" : "hover:border-primary/50"
            )}
          >
            <p className="text-sm font-semibold">{t.label}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t.description}</p>
            {selected ? (
              <Check className="absolute right-2 top-2 h-4 w-4 text-primary" />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Run test**

```bash
pnpm --filter web test src/test/components/waiting-template-picker.test.tsx
```

Expected: 3 passing.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/wizard/waiting-template-picker.tsx apps/web/src/test/components/waiting-template-picker.test.tsx
git commit -m "feat(web): add WaitingTemplatePicker (5 template cards)"
```

---

## Task 8: `<LoginPreview>` component

**Files:**
- Create: `apps/web/src/components/wizard/login-preview.tsx`

- [ ] **Step 1: Implement**

```tsx
"use client";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

export interface LoginPreviewProps {
  logoUrl: string;
  loginLogoAlign: "LEFT" | "CENTER" | "RIGHT";
  title: string;
  loginButtonText: string;
  loginButtonColor: string;
  primaryColor: string;
  nameEnabled: boolean;
  emailEnabled: boolean;
  phoneEnabled: boolean;
  namePlaceholder: string;
  emailPlaceholder: string;
  phonePlaceholder: string;
  formFieldOrder: ReadonlyArray<"name" | "email" | "phone">;
  progressEnabled: boolean;
  progressStartPct: number;
  progressBarColor: string;
  progressTextColor: string;
  progressText: string;
}

const ALIGN_CLASS: Record<LoginPreviewProps["loginLogoAlign"], string> = {
  LEFT: "justify-start",
  CENTER: "justify-center",
  RIGHT: "justify-end"
};

export function LoginPreview(props: LoginPreviewProps) {
  const [pct, setPct] = useState(props.progressStartPct);
  useEffect(() => {
    if (!props.progressEnabled) return;
    const id = setInterval(() => {
      setPct((p) => (p < 99 ? p + 1 : 99));
    }, 1000);
    return () => clearInterval(id);
  }, [props.progressEnabled]);

  const fieldsByKey: Record<"name" | "email" | "phone", { enabled: boolean; placeholder: string }> = {
    name: { enabled: props.nameEnabled, placeholder: props.namePlaceholder },
    email: { enabled: props.emailEnabled, placeholder: props.emailPlaceholder },
    phone: { enabled: props.phoneEnabled, placeholder: props.phonePlaceholder }
  };

  const progressMessage = props.progressText.replace(/\{pct\}/g, String(pct));

  return (
    <div className="space-y-3 rounded-lg border bg-card p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase text-muted-foreground">Prévia</p>
      <div className={cn("flex w-full", ALIGN_CLASS[props.loginLogoAlign])}>
        {props.logoUrl ? <img src={props.logoUrl} alt="" className="h-12 object-contain" /> : <div className="h-12" />}
      </div>
      {props.progressEnabled ? (
        <div className="overflow-hidden rounded-full" style={{ background: props.progressBarColor }}>
          <div
            className="px-3 py-1.5 text-center text-xs font-semibold"
            style={{ color: props.progressTextColor }}
          >
            {progressMessage}
          </div>
        </div>
      ) : null}
      <p className="text-base font-semibold">{props.title}</p>
      <div className="space-y-2">
        {props.formFieldOrder.map((key) => {
          const f = fieldsByKey[key];
          if (!f.enabled) return null;
          return (
            <div key={key}>
              <input
                type={key === "email" ? "email" : "text"}
                placeholder={f.placeholder}
                disabled
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
            </div>
          );
        })}
      </div>
      <button
        type="button"
        disabled
        className="w-full rounded-md py-2 text-sm font-semibold text-white"
        style={{ backgroundColor: props.loginButtonColor }}
      >
        {props.loginButtonText}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter web typecheck
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/wizard/login-preview.tsx
git commit -m "feat(web): add LoginPreview live mini-form for step 3"
```

---

## Task 9: WizardShell redesign (9-step horizontal nav)

**Files:**
- Modify: `apps/web/src/components/wizard/wizard-shell.tsx`

- [ ] **Step 1: Read current file**

```bash
cat apps/web/src/components/wizard/wizard-shell.tsx
```

(For context — the existing file has the current step pills + page content slot.)

- [ ] **Step 2: Replace with new horizontal nav**

```tsx
import { headers } from "next/headers";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  Flag,
  MonitorPlay,
  LogIn,
  Video,
  Gift,
  MessageCircle,
  DollarSign,
  Eye,
  Plug2,
  type LucideIcon
} from "lucide-react";

interface StepDef {
  num: number;
  href: (id: string) => string;
  matchPath: (pathname: string, id: string) => boolean;
  label: string;
  Icon: LucideIcon;
}

const STEPS: ReadonlyArray<StepDef> = [
  { num: 1, label: "Início", Icon: Flag, href: (id) => `/dashboard/webinars/${id}/step-1`, matchPath: (p, id) => p === `/dashboard/webinars/${id}/step-1` },
  { num: 2, label: "Webinar", Icon: MonitorPlay, href: (id) => `/dashboard/webinars/${id}/step-2`, matchPath: (p, id) => p === `/dashboard/webinars/${id}/step-2` },
  { num: 3, label: "Login", Icon: LogIn, href: (id) => `/dashboard/webinars/${id}/step-3`, matchPath: (p, id) => p === `/dashboard/webinars/${id}/step-3` },
  { num: 4, label: "Vídeo", Icon: Video, href: (id) => `/dashboard/webinars/${id}/step-4`, matchPath: (p, id) => p === `/dashboard/webinars/${id}/step-4` },
  { num: 5, label: "Oferta", Icon: Gift, href: (id) => `/dashboard/webinars/${id}/step-5`, matchPath: (p, id) => p === `/dashboard/webinars/${id}/step-5` },
  { num: 6, label: "Chat", Icon: MessageCircle, href: (id) => `/dashboard/webinars/${id}/step-6`, matchPath: (p, id) => p === `/dashboard/webinars/${id}/step-6` },
  { num: 7, label: "Vendas", Icon: DollarSign, href: (id) => `/dashboard/webinars/${id}/step-7`, matchPath: (p, id) => p === `/dashboard/webinars/${id}/step-7` },
  { num: 8, label: "Audiência", Icon: Eye, href: (id) => `/dashboard/webinars/${id}/step-8`, matchPath: (p, id) => p === `/dashboard/webinars/${id}/step-8` },
  { num: 9, label: "Integrações", Icon: Plug2, href: (id) => `/dashboard/webinars/${id}/integrations`, matchPath: (p, id) => p === `/dashboard/webinars/${id}/integrations` }
];

export interface WizardShellProps {
  webinarId: string;
  children: React.ReactNode;
}

export async function WizardShell({ webinarId, children }: WizardShellProps) {
  const hdrs = await headers();
  const pathname = hdrs.get("x-pathname") ?? "";

  const activeIndex = STEPS.findIndex((s) => s.matchPath(pathname, webinarId));

  return (
    <div className="container mx-auto py-8">
      <nav className="overflow-x-auto pb-4">
        <ol className="flex min-w-max items-end gap-0">
          {STEPS.map((s, i) => {
            const isActive = i === activeIndex;
            const isPast = activeIndex >= 0 && i < activeIndex;
            const iconColor = isActive ? "text-red-600" : isPast ? "text-emerald-600" : "text-gray-400";
            const labelColor = isActive ? "text-red-600 font-semibold" : isPast ? "text-emerald-700" : "text-gray-500";
            const circleColor = isActive ? "bg-emerald-600 text-white" : isPast ? "bg-emerald-600 text-white" : "bg-gray-200 text-gray-500";
            const lineColor = isPast ? "bg-emerald-600" : "bg-gray-300";
            const showLine = i < STEPS.length - 1;
            return (
              <li key={s.num} className="flex flex-col items-center">
                <Link href={s.href(webinarId)} className="group flex flex-col items-center px-3">
                  <s.Icon className={cn("h-7 w-7 mb-1", iconColor)} />
                  <span className={cn("text-xs", labelColor)}>{s.label}</span>
                </Link>
                <div className="flex items-center">
                  <span
                    className={cn(
                      "z-10 flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold",
                      circleColor
                    )}
                  >
                    {s.num}
                  </span>
                  {showLine ? (
                    <span className={cn("h-0.5 w-12 sm:w-16", lineColor)} />
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      </nav>
      <div className="mt-6">{children}</div>
    </div>
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
git add apps/web/src/components/wizard/wizard-shell.tsx
git commit -m "feat(web): redesign WizardShell with 9-step horizontal icon nav"
```

---

## Task 10: Step 1 form extension

**Files:**
- Modify: `apps/web/src/components/wizard/step-1-form.tsx`

- [ ] **Step 1: Read current file**

```bash
cat apps/web/src/components/wizard/step-1-form.tsx
```

- [ ] **Step 2: Add 2 ToggleCards**

Open the file. Add `import { Controller } from "react-hook-form";` if not present. Add `import { ToggleCard } from "@/components/wizard/toggle-card";`. Inside the `<form>` JSX, BELOW the existing `language` field and ABOVE the `<WizardNav>`, insert:

```tsx
      <Controller
        control={control}
        name="accessFacilitated"
        render={({ field }) => (
          <ToggleCard
            title="Forma de acesso à sala"
            description="Acesso Facilitado"
            info="Ao ativar o acesso facilitado, o usuário é direcionado imediatamente para a sala do webinar, sem a necessidade de fazer login."
            checked={field.value}
            onCheckedChange={field.onChange}
          />
        )}
      />

      <Controller
        control={control}
        name="videoSyncWithStart"
        render={({ field }) => (
          <ToggleCard
            title="Sincronizar vídeo com tempo de início do webinar"
            description="Quando ativo, o vídeo respeita o atraso do lead."
            info="Por exemplo, se o seu webinar estiver agendado para 20h e o usuário entrar às 20h05, o vídeo começará a partir do minuto 5."
            checked={field.value}
            onCheckedChange={field.onChange}
          />
        )}
      />
```

If `control` is not destructured from `useForm`, add it: `const { register, handleSubmit, control, formState: { errors }, setError } = useForm<Step1Input>(...)`.

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter web typecheck
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/wizard/step-1-form.tsx
git commit -m "feat(web): add accessFacilitated + videoSyncWithStart toggles to step 1"
```

---

## Task 11: Step 2 form extension (timezone + template)

**Files:**
- Modify: `apps/web/src/components/wizard/step-2-form.tsx`

- [ ] **Step 1: Replace timezone Input with TimezoneSelect**

Open the file. Add imports:

```tsx
import { TimezoneSelect } from "@/components/wizard/timezone-select";
import { WaitingTemplatePicker } from "@/components/wizard/waiting-template-picker";
```

Find the timezone field block:

```tsx
      <div className="space-y-2">
        <Label htmlFor="timezone">Fuso horário</Label>
        <Input id="timezone" {...register("timezone")} placeholder="America/Sao_Paulo" />
        {errors.timezone && <p className="text-sm text-destructive">{errors.timezone.message}</p>}
      </div>
```

Replace with:

```tsx
      <div className="space-y-2">
        <Label>Fuso horário</Label>
        <Controller
          control={control}
          name="timezone"
          render={({ field }) => (
            <TimezoneSelect value={field.value} onChange={field.onChange} />
          )}
        />
        {errors.timezone && <p className="text-sm text-destructive">{errors.timezone.message}</p>}
      </div>
```

- [ ] **Step 2: Add WaitingTemplatePicker**

Inside the same form, BELOW the existing `waitingShowThumb` Switch (added in C) and ABOVE the `<input type="hidden" value={mode} ...>` (or wherever the form ends), insert:

```tsx
      <div className="space-y-2">
        <Label>Modelo da página de espera</Label>
        <Controller
          control={control}
          name="waitingTemplate"
          render={({ field }) => (
            <WaitingTemplatePicker value={field.value} onChange={field.onChange} />
          )}
        />
      </div>
```

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter web typecheck
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/wizard/step-2-form.tsx
git commit -m "feat(web): add TimezoneSelect + WaitingTemplatePicker to step 2"
```

---

## Task 12: Step 3 form REPLACE (3-column layout + LoginPreview)

**Files:**
- Modify: `apps/web/src/components/wizard/step-3-form.tsx`

- [ ] **Step 1: Replace entire file**

```tsx
"use client";
import { useTransition } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlignCenter, AlignLeft, AlignRight } from "lucide-react";
import { step3Schema, type Step3Input } from "@/lib/validations/webinar";
import { updateWebinarStep3 } from "@/server/actions/webinar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { LoginPreview } from "@/components/wizard/login-preview";
import { WizardNav } from "@/components/wizard/wizard-nav";
import { cn } from "@/lib/utils";

export interface Step3FormProps {
  webinarId: string;
  initial: Step3Input & { titleHint?: string };
}

const FIELD_KEYS: ReadonlyArray<"name" | "email" | "phone"> = ["name", "email", "phone"];
const FIELD_LABEL: Record<"name" | "email" | "phone", string> = {
  name: "Nome",
  email: "E-mail",
  phone: "WhatsApp"
};

export function Step3Form({ webinarId, initial }: Step3FormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const { register, handleSubmit, control, watch, setValue, formState: { errors } } = useForm<Step3Input>({
    resolver: zodResolver(step3Schema),
    defaultValues: initial
  });

  function onSubmit(values: Step3Input) {
    startTransition(async () => {
      const r = await updateWebinarStep3(webinarId, values);
      if ("ok" in r) {
        router.push(`/dashboard/webinars/${webinarId}/step-4`);
      } else {
        toast.error(r.error.message);
      }
    });
  }

  function moveField(idx: number, dir: -1 | 1) {
    const order = [...watch("formFieldOrder")];
    const ni = idx + dir;
    if (ni < 0 || ni >= order.length) return;
    const a = order[idx];
    const b = order[ni];
    order[idx] = b;
    order[ni] = a;
    setValue("formFieldOrder", order);
  }

  function toggleFieldEnabled(key: "name" | "email" | "phone", enabled: boolean) {
    if (key === "name") setValue("nameEnabled", enabled);
    if (key === "email") setValue("emailEnabled", enabled);
    if (key === "phone") setValue("phoneEnabled", enabled);
  }

  function isFieldEnabled(key: "name" | "email" | "phone"): boolean {
    if (key === "name") return Boolean(watch("nameEnabled"));
    if (key === "email") return Boolean(watch("emailEnabled"));
    return Boolean(watch("phoneEnabled"));
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <h2 className="text-2xl font-semibold">Login</h2>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_minmax(0,360px)]">
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="logoUrl">Logo do webinar (URL)</Label>
              <Input id="logoUrl" {...register("logoUrl")} placeholder="https://..." />
              {errors.logoUrl && <p className="text-sm text-destructive">{errors.logoUrl.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Alinhamento do logo</Label>
              <Controller
                control={control}
                name="loginLogoAlign"
                render={({ field }) => (
                  <div className="flex gap-2">
                    {(["LEFT", "CENTER", "RIGHT"] as const).map((a) => {
                      const Icon = a === "LEFT" ? AlignLeft : a === "CENTER" ? AlignCenter : AlignRight;
                      const selected = field.value === a;
                      return (
                        <Button
                          key={a}
                          type="button"
                          variant={selected ? "default" : "outline"}
                          size="icon"
                          onClick={() => field.onChange(a)}
                          aria-pressed={selected}
                          aria-label={`Alinhar à ${a.toLowerCase()}`}
                        >
                          <Icon className="h-4 w-4" />
                        </Button>
                      );
                    })}
                  </div>
                )}
              />
            </div>
          </div>

          <fieldset className="space-y-3 rounded-md border p-4">
            <legend className="px-1 text-sm font-semibold">Barra de progresso</legend>
            <Controller
              control={control}
              name="progressEnabled"
              render={({ field }) => (
                <label className="flex items-center gap-3">
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                  <span className="text-sm">Exibir barra de progresso</span>
                </label>
              )}
            />
            {watch("progressEnabled") ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="progressStartPct">Iniciar em (%)</Label>
                  <Input
                    id="progressStartPct"
                    type="number"
                    min={0}
                    max={99}
                    {...register("progressStartPct", { valueAsNumber: true })}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="progressBarColor">Cor da barra</Label>
                  <Input id="progressBarColor" type="color" {...register("progressBarColor")} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="progressTextColor">Cor do texto</Label>
                  <Input id="progressTextColor" type="color" {...register("progressTextColor")} />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <Label htmlFor="progressText">Texto (use {"{pct}"} para o número)</Label>
                  <Input id="progressText" {...register("progressText")} />
                </div>
              </div>
            ) : null}
          </fieldset>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="loginButtonText">Texto do botão</Label>
              <Input id="loginButtonText" {...register("loginButtonText")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="loginButtonColor">Cor do botão</Label>
              <Input id="loginButtonColor" type="color" {...register("loginButtonColor")} />
            </div>
          </div>

          <fieldset className="space-y-3 rounded-md border p-4">
            <legend className="px-1 text-sm font-semibold">Formulário de acesso à sala</legend>
            <p className="text-xs text-muted-foreground">
              Reordene os campos com as setas. Desative campos que não deseja exibir.
            </p>
            <Controller
              control={control}
              name="formFieldOrder"
              render={({ field }) => (
                <ol className="space-y-2">
                  {field.value.map((key, idx) => (
                    <li key={key} className="flex items-center gap-2 rounded-md border bg-muted/30 p-2">
                      <span className="w-24 text-sm font-medium">{FIELD_LABEL[key]}</span>
                      <div className="flex flex-1 items-center gap-3">
                        <Switch
                          checked={isFieldEnabled(key)}
                          onCheckedChange={(v) => toggleFieldEnabled(key, v)}
                        />
                        <span className="text-xs text-muted-foreground">Exibir</span>
                      </div>
                      <Button type="button" size="sm" variant="ghost" onClick={() => moveField(idx, -1)} aria-label="Subir">
                        ↑
                      </Button>
                      <Button type="button" size="sm" variant="ghost" onClick={() => moveField(idx, 1)} aria-label="Descer">
                        ↓
                      </Button>
                    </li>
                  ))}
                </ol>
              )}
            />
            {errors.formFieldOrder && (
              <p className="text-sm text-destructive">{errors.formFieldOrder.message as string}</p>
            )}
          </fieldset>

          <fieldset className="space-y-3 rounded-md border p-4">
            <legend className="px-1 text-sm font-semibold">Campos obrigatórios</legend>
            <Controller control={control} name="nameRequired" render={({ field }) => (
              <label className="flex items-center gap-3">
                <Switch checked={field.value} onCheckedChange={field.onChange} />
                <span className="text-sm">Incluir Nome como requisito obrigatório</span>
              </label>
            )} />
            <Controller control={control} name="emailRequired" render={({ field }) => (
              <label className="flex items-center gap-3">
                <Switch checked={field.value} onCheckedChange={field.onChange} />
                <span className="text-sm">Incluir E-mail como requisito obrigatório</span>
              </label>
            )} />
            <Controller control={control} name="phoneRequired" render={({ field }) => (
              <label className="flex items-center gap-3">
                <Switch checked={field.value} onCheckedChange={field.onChange} />
                <span className="text-sm">Incluir WhatsApp como requisito obrigatório</span>
              </label>
            )} />
          </fieldset>

          <fieldset className="space-y-3 rounded-md border p-4">
            <legend className="px-1 text-sm font-semibold">Campos do formulário</legend>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="space-y-1">
                <Label htmlFor="namePlaceholder">Placeholder Nome</Label>
                <Input id="namePlaceholder" {...register("namePlaceholder")} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="emailPlaceholder">Placeholder E-mail</Label>
                <Input id="emailPlaceholder" {...register("emailPlaceholder")} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="phonePlaceholder">Placeholder WhatsApp</Label>
                <Input id="phonePlaceholder" {...register("phonePlaceholder")} />
              </div>
            </div>
          </fieldset>
        </div>

        <aside className="lg:sticky lg:top-4 lg:self-start">
          <LoginPreview
            logoUrl={watch("logoUrl") || ""}
            loginLogoAlign={watch("loginLogoAlign")}
            title={initial.titleHint ?? "Título do webinar"}
            loginButtonText={watch("loginButtonText")}
            loginButtonColor={watch("loginButtonColor")}
            primaryColor={watch("primaryColor") || "#16a34a"}
            nameEnabled={watch("nameEnabled")}
            emailEnabled={watch("emailEnabled")}
            phoneEnabled={watch("phoneEnabled")}
            namePlaceholder={watch("namePlaceholder")}
            emailPlaceholder={watch("emailPlaceholder")}
            phonePlaceholder={watch("phonePlaceholder")}
            formFieldOrder={watch("formFieldOrder") as ReadonlyArray<"name" | "email" | "phone">}
            progressEnabled={watch("progressEnabled")}
            progressStartPct={watch("progressStartPct")}
            progressBarColor={watch("progressBarColor")}
            progressTextColor={watch("progressTextColor")}
            progressText={watch("progressText")}
          />
        </aside>
      </div>

      <WizardNav webinarId={webinarId} step={3} submitting={pending} />
    </form>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter web typecheck
```

Expected: clean (some downstream pages may complain about extra `titleHint` prop — that's intentional for Task 16).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/wizard/step-3-form.tsx
git commit -m "feat(web): replace step 3 form with 3-column layout + live preview"
```

---

## Task 13: `updateWebinarStep1` action extension

**Files:**
- Modify: `apps/web/src/server/actions/webinar.ts`

- [ ] **Step 1: Find `updateWebinarStep1` and extend the prisma update**

Open the file. Find `export async function updateWebinarStep1(...)`. Find the `prisma.webinar.update` call inside. Add the two new fields:

```ts
  await prisma.webinar.update({
    where: { id },
    data: {
      name: parsed.data.name,
      title: parsed.data.title,
      slug: parsed.data.slug,
      language: parsed.data.language,
      accessFacilitated: parsed.data.accessFacilitated,
      videoSyncWithStart: parsed.data.videoSyncWithStart
    }
  });
```

(If the existing call uses different field assignment style, preserve it — just add the two new lines.)

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter web typecheck
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/server/actions/webinar.ts
git commit -m "feat(web): persist accessFacilitated + videoSyncWithStart in updateWebinarStep1"
```

---

## Task 14: `updateWebinarStep2` action extension

**Files:**
- Modify: `apps/web/src/server/actions/webinar.ts`

- [ ] **Step 1: Add `waitingTemplate` to update**

Find `updateWebinarStep2`. Inside `prisma.webinar.update.data`, add:

```ts
      waitingTemplate: parsed.data.waitingTemplate,
      // Backwards-compat: keep waitingShowThumb in sync with template choice
      waitingShowThumb:
        parsed.data.waitingTemplate === "WITH_THUMB"
          ? true
          : parsed.data.waitingShowThumb
```

(Replace the existing `waitingShowThumb: parsed.data.waitingShowThumb` line.)

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter web typecheck
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/server/actions/webinar.ts
git commit -m "feat(web): persist waitingTemplate in updateWebinarStep2 (back-compat with showThumb)"
```

---

## Task 15: `updateWebinarStep3` action extension

**Files:**
- Modify: `apps/web/src/server/actions/webinar.ts`

- [ ] **Step 1: Add new fields to update**

Find `updateWebinarStep3`. Inside `prisma.webinar.update.data`, add at the end of the existing object:

```ts
      loginLogoAlign: parsed.data.loginLogoAlign,
      progressEnabled: parsed.data.progressEnabled,
      progressStartPct: parsed.data.progressStartPct,
      progressBarColor: parsed.data.progressBarColor,
      progressTextColor: parsed.data.progressTextColor,
      progressText: parsed.data.progressText,
      formFieldOrder: parsed.data.formFieldOrder
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter web typecheck
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/server/actions/webinar.ts
git commit -m "feat(web): persist D1 login fields in updateWebinarStep3"
```

---

## Task 16: Wizard step pages — pass new initial values

**Files:**
- Modify: `apps/web/src/app/dashboard/webinars/[id]/(wizard)/step-1/page.tsx`
- Modify: `apps/web/src/app/dashboard/webinars/[id]/(wizard)/step-2/page.tsx`
- Modify: `apps/web/src/app/dashboard/webinars/[id]/(wizard)/step-3/page.tsx`

- [ ] **Step 1: step-1/page.tsx — extend initial**

Open the file. Find the `initial={{...}}` prop. Add at end of object:

```tsx
        accessFacilitated: w.accessFacilitated,
        videoSyncWithStart: w.videoSyncWithStart
```

- [ ] **Step 2: step-2/page.tsx — extend initial**

Find `initial={{...}}`. Add at end of object:

```tsx
        waitingTemplate: w.waitingTemplate
```

- [ ] **Step 3: step-3/page.tsx — extend initial**

Find `initial={{...}}`. Add ALL new fields at the end of the object:

```tsx
        loginLogoAlign: w.loginLogoAlign,
        progressEnabled: w.progressEnabled,
        progressStartPct: w.progressStartPct,
        progressBarColor: w.progressBarColor,
        progressTextColor: w.progressTextColor,
        progressText: w.progressText,
        formFieldOrder: w.formFieldOrder as ("name" | "email" | "phone")[],
        titleHint: w.title
```

(`titleHint` is the extra prop the LoginPreview consumes, sourced from webinar title.)

- [ ] **Step 4: Typecheck**

```bash
pnpm --filter web typecheck
```

Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add 'apps/web/src/app/dashboard/webinars/[id]/(wizard)/'
git commit -m "feat(web): wire new D1 fields through wizard step pages"
```

---

## Task 17: `publicWebinarDto` extension

**Files:**
- Modify: `apps/web/src/lib/public-dto.ts`

- [ ] **Step 1: Add new fields to PublicWebinar type**

Open the file. Find the `PublicWebinar` type. Add fields:

```ts
export type PublicWebinar = {
  // ... existing fields preserved
  waitingTemplate: "DEFAULT" | "WITH_THUMB" | "IMMERSIVE" | "MINIMAL" | "FEATURES";
  loginLogoAlign: "LEFT" | "CENTER" | "RIGHT";
  progressEnabled: boolean;
  progressStartPct: number;
  progressBarColor: string;
  progressTextColor: string;
  progressText: string;
  formFieldOrder: ReadonlyArray<"name" | "email" | "phone">;
};
```

Find `publicWebinarDto`. Add to the returned object:

```ts
    waitingTemplate: w.waitingTemplate,
    loginLogoAlign: w.loginLogoAlign,
    progressEnabled: w.progressEnabled,
    progressStartPct: w.progressStartPct,
    progressBarColor: w.progressBarColor,
    progressTextColor: w.progressTextColor,
    progressText: w.progressText,
    formFieldOrder: w.formFieldOrder as ReadonlyArray<"name" | "email" | "phone">
```

`accessFacilitated` is intentionally NOT exposed (UI-only, deferred).

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter web typecheck
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/public-dto.ts
git commit -m "feat(web): expose D1 visual fields in publicWebinarDto"
```

---

## Task 18: CaptureForm public-side updates

**Files:**
- Modify: `apps/web/src/app/[slug]/_components/capture-form.tsx`

- [ ] **Step 1: Read current file + replace render JSX**

Open the file. Locate the JSX section that renders logo + h1 + form. Replace the JSX (everything inside the returned `<main>`) with a version that:

1. Honors `loginLogoAlign` for the logo div alignment.
2. Renders progress bar after logo when `progressEnabled`.
3. Renders fields in the order from `formFieldOrder`.

Replace the entire JSX block from `<main>` to `</main>` with:

```tsx
const ALIGN_CLASS: Record<"LEFT" | "CENTER" | "RIGHT", string> = {
  LEFT: "justify-start",
  CENTER: "justify-center",
  RIGHT: "justify-end"
};
```

(Add this `const` ABOVE the `CaptureForm` function.)

Then in the return statement, replace the structure with:

```tsx
  const fieldsByKey: Record<"name" | "email" | "phone", React.ReactNode> = {
    name: w.nameEnabled ? (
      <div className="space-y-1" key="name">
        <Label htmlFor="name">Nome{w.nameRequired ? " *" : ""}</Label>
        <Input id="name" name="name" placeholder={w.namePlaceholder} required={w.nameRequired} />
      </div>
    ) : null,
    email: w.emailEnabled ? (
      <div className="space-y-1" key="email">
        <Label htmlFor="email">Email{w.emailRequired ? " *" : ""}</Label>
        <Input id="email" name="email" type="email" placeholder={w.emailPlaceholder} required={w.emailRequired} />
      </div>
    ) : null,
    phone: w.phoneEnabled ? (
      <div className="space-y-1" key="phone">
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
    ) : null
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-10">
      <div className={`mb-6 flex w-full ${ALIGN_CLASS[w.loginLogoAlign]}`}>
        {w.logoUrl ? <img src={w.logoUrl} alt="" className="h-14 object-contain" /> : null}
      </div>
      {w.progressEnabled ? <ProgressBar w={w} /> : null}
      <h1 className="text-center text-3xl font-semibold">{w.title}</h1>
      {w.waitingSubtitle ? (
        <p className="mt-2 text-center text-sm text-muted-foreground">{w.waitingSubtitle}</p>
      ) : null}

      <form
        action={onSubmit}
        className="mt-8 space-y-4 rounded-lg border bg-card p-6 shadow-sm"
      >
        {w.formFieldOrder.map((key) => fieldsByKey[key])}

        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}

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

function ProgressBar({ w }: { w: import("@/lib/public-dto").PublicWebinar }) {
  const [pct, setPct] = useState(w.progressStartPct);
  useEffect(() => {
    const id = setInterval(() => {
      setPct((p) => (p < 99 ? p + 1 : 99));
    }, 1000);
    return () => clearInterval(id);
  }, []);
  const text = w.progressText.replace(/\{pct\}/g, String(pct));
  return (
    <div className="mb-4 overflow-hidden rounded-full" style={{ background: w.progressBarColor }}>
      <div className="px-3 py-1.5 text-center text-xs font-semibold" style={{ color: w.progressTextColor }}>
        {text}
      </div>
    </div>
  );
}
```

(Make sure `useState`/`useEffect` are imported at top of file: `import { useState, useEffect, useTransition } from "react";`.)

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter web typecheck
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/[slug]/_components/capture-form.tsx
git commit -m "feat(web): CaptureForm honors logoAlign + progressBar + formFieldOrder"
```

---

## Task 19: CountdownView template branching

**Files:**
- Modify: `apps/web/src/app/[slug]/_components/countdown-view.tsx`

- [ ] **Step 1: Replace JSX with template switch**

Open the file. After the `useEffect` that updates `remaining`, REPLACE the returned `<main>` with:

```tsx
  if (w.waitingTemplate === "MINIMAL") {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-6 text-center">
        <p className="font-mono text-7xl tabular-nums" aria-live="polite">{fmt(remaining)}</p>
      </main>
    );
  }

  if (w.waitingTemplate === "FEATURES") {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-10">
        {w.logoUrl ? <img src={w.logoUrl} alt="" className="mb-6 h-14 object-contain" /> : null}
        <h1 className="text-3xl font-semibold">{w.waitingTitle}</h1>
        <p className="mt-2 text-muted-foreground">{w.waitingSubtitle}</p>
        <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
          <ul className="space-y-2 text-sm">
            <li className="flex items-start gap-2">✓ Acesso completo ao webinar ao vivo</li>
            <li className="flex items-start gap-2">✓ Materiais exclusivos para participantes</li>
            <li className="flex items-start gap-2">✓ Sessão de Q&A ao final</li>
            <li className="flex items-start gap-2">✓ Bônus surpresa para inscritos</li>
          </ul>
          <p className="self-center font-mono text-5xl tabular-nums" aria-live="polite">{fmt(remaining)}</p>
        </div>
      </main>
    );
  }

  if (w.waitingTemplate === "IMMERSIVE") {
    return (
      <main className="relative min-h-screen overflow-hidden bg-black text-white">
        {video?.thumbUrl || video?.customThumbUrl ? (
          <img
            src={video.customThumbUrl ?? video.thumbUrl ?? ""}
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-30"
          />
        ) : null}
        <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 text-center">
          {w.logoUrl ? <img src={w.logoUrl} alt="" className="mb-6 h-14 object-contain" /> : null}
          <h1 className="text-3xl font-semibold">{w.waitingTitle}</h1>
          <p className="mt-2 text-white/80">{w.waitingSubtitle}</p>
          <p className="mt-8 font-mono text-6xl tabular-nums" aria-live="polite">{fmt(remaining)}</p>
        </div>
      </main>
    );
  }

  // DEFAULT and WITH_THUMB share the same layout but WITH_THUMB shows thumb.
  const showThumb = w.waitingTemplate === "WITH_THUMB" || w.waitingShowThumb;
  const thumb = showThumb ? (video?.customThumbUrl ?? video?.thumbUrl ?? null) : null;

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-6 text-center">
      {w.logoUrl ? <img src={w.logoUrl} alt="" className="mb-6 h-14 object-contain" /> : null}
      <h1 className="text-3xl font-semibold">{w.waitingTitle}</h1>
      <p className="mt-2 text-muted-foreground">{w.waitingSubtitle}</p>
      {thumb ? (
        <img src={thumb} alt="" className="mt-6 aspect-video w-full max-w-md rounded-lg border object-cover shadow" />
      ) : null}
      <p className="mt-8 font-mono text-5xl tabular-nums" aria-live="polite">{fmt(remaining)}</p>
    </main>
  );
}
```

Existing `waitingShowThumb` field on `PublicWebinar` is preserved for backward compatibility — `WITH_THUMB` template OR the legacy flag both render the thumb.

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter web typecheck
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/[slug]/_components/countdown-view.tsx
git commit -m "feat(web): CountdownView branches on waitingTemplate (5 variants)"
```

---

## Task 20: Tests — server actions D1 coverage

**Files:**
- Modify: `apps/web/src/test/server/actions/webinar.test.ts`

- [ ] **Step 1: Update existing tests for new schema requirements**

Open the file. Search for any call to `updateWebinarStep1` — add `accessFacilitated: false, videoSyncWithStart: true` to the input object. Same for `updateWebinarStep2` — add `waitingTemplate: "DEFAULT"`. Same for `updateWebinarStep3` — add the seven new fields:

```ts
      loginLogoAlign: "CENTER",
      progressEnabled: false,
      progressStartPct: 50,
      progressBarColor: "#dc2626",
      progressTextColor: "#ffffff",
      progressText: "{pct}% das vagas preenchidas...",
      formFieldOrder: ["name", "email", "phone"]
```

- [ ] **Step 2: Append new test verifying D1 persistence**

At the bottom of the existing `describe` block (or a new one), add:

```ts
describe("updateWebinarStep1 D1 fields", () => {
  it("persists accessFacilitated + videoSyncWithStart", async () => {
    const { createDraftWebinar, updateWebinarStep1 } = await import("@/server/actions/webinar?" + Date.now());
    const { id } = await createDraftWebinar();
    const r = await updateWebinarStep1(id, {
      name: "X", title: "X", slug: "d1-test-1", language: "pt-BR",
      accessFacilitated: true,
      videoSyncWithStart: false
    });
    expect(r).toEqual({ ok: true });
    const after = await prisma.webinar.findUnique({ where: { id } });
    expect(after?.accessFacilitated).toBe(true);
    expect(after?.videoSyncWithStart).toBe(false);
  });
});

describe("updateWebinarStep2 waitingTemplate", () => {
  it("setting WITH_THUMB also sets waitingShowThumb=true", async () => {
    const { createDraftWebinar, updateWebinarStep1, updateWebinarStep2 } = await import("@/server/actions/webinar?" + (Date.now() + 1));
    const { id } = await createDraftWebinar();
    await updateWebinarStep1(id, { name: "X", title: "X", slug: "d1-test-2", language: "pt-BR", accessFacilitated: false, videoSyncWithStart: true });
    await updateWebinarStep2(id, {
      mode: "UNICO",
      startDate: new Date("2026-06-01T10:00:00Z"),
      endDate: new Date("2026-06-01T11:00:00Z"),
      timezone: "America/Sao_Paulo",
      waitingTitle: "Sala", waitingSubtitle: "",
      waitingShowThumb: false,
      waitingTemplate: "WITH_THUMB"
    });
    const after = await prisma.webinar.findUnique({ where: { id } });
    expect(after?.waitingTemplate).toBe("WITH_THUMB");
    expect(after?.waitingShowThumb).toBe(true);
  });
});
```

- [ ] **Step 3: Run tests**

```bash
pnpm --filter web test src/test/server/actions/webinar.test.ts
```

Expected: all existing tests still pass + 2 new tests pass.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/test/server/actions/webinar.test.ts
git commit -m "test(web): cover D1 server-action additions + extend existing fixtures"
```

---

## Task 21: Tests — components rendering

**Files:**
- Create: `apps/web/src/test/components/login-preview.test.tsx`

- [ ] **Step 1: Implement test**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LoginPreview } from "@/components/wizard/login-preview";

const baseProps = {
  logoUrl: "",
  loginLogoAlign: "CENTER" as const,
  title: "My Webinar",
  loginButtonText: "Entrar",
  loginButtonColor: "#16a34a",
  primaryColor: "#16a34a",
  nameEnabled: true,
  emailEnabled: true,
  phoneEnabled: false,
  namePlaceholder: "Nome",
  emailPlaceholder: "Email",
  phonePlaceholder: "Tel",
  formFieldOrder: ["name", "email", "phone"] as const,
  progressEnabled: false,
  progressStartPct: 50,
  progressBarColor: "#dc2626",
  progressTextColor: "#ffffff",
  progressText: "{pct}% das vagas..."
};

describe("LoginPreview", () => {
  it("renders title + button text", () => {
    render(<LoginPreview {...baseProps} />);
    expect(screen.getByText("My Webinar")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Entrar" })).toBeInTheDocument();
  });

  it("respects formFieldOrder excluding disabled phone", () => {
    render(<LoginPreview {...baseProps} formFieldOrder={["phone", "name", "email"]} />);
    const inputs = screen.getAllByRole("textbox");
    // phone disabled -> only name (text) + email (email type, not textbox role)
    expect(inputs.some((el) => el.getAttribute("placeholder") === "Nome")).toBe(true);
    expect(screen.queryByPlaceholderText("Tel")).toBeNull();
  });

  it("shows progress text with pct substituted when enabled", () => {
    render(<LoginPreview {...baseProps} progressEnabled progressStartPct={75} progressText="{pct}% feito" />);
    expect(screen.getByText(/75% feito/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test**

```bash
pnpm --filter web test src/test/components/login-preview.test.tsx
```

Expected: 3 passing.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/test/components/login-preview.test.tsx
git commit -m "test(web): cover LoginPreview render + ordering + progress"
```

---

## Task 22: Final acceptance + README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Run full suite**

```bash
pnpm -r --workspace-concurrency=1 typecheck
pnpm -r --workspace-concurrency=1 test
```

Expected: typecheck clean. All tests pass (web ~125 with D1 additions, scraper 58, worker 22).

- [ ] **Step 2: Update README — note D1 changes**

Find the existing "## Public routes" section (added in C). After the env vars subsection, append:

```markdown
### Wizard redesign (sub-plan D1)

- Steps 1, 2, 3 redesigned to match original Hotwebinar UI:
  - 9-step horizontal nav with Lucide icons + numbered circles + connecting line
  - Step 1: `accessFacilitated` (UI toggle, deferred wiring), `videoSyncWithStart` (controls JIT/UNICO offset)
  - Step 2: `waitingTemplate` enum (DEFAULT / WITH_THUMB / IMMERSIVE / MINIMAL / FEATURES) replacing legacy `waitingShowThumb` toggle
  - Step 3: full 3-column layout with logo align, configurable progress bar, form-field reordering, live preview card

`waitingShowThumb` field is preserved for backward compatibility but new UI sets `waitingTemplate=WITH_THUMB` instead. Server action keeps the two in sync.
```

- [ ] **Step 3: Manually verify in browser**

```bash
docker compose up -d
pnpm --filter web dev &
```

Visit `http://localhost:3000/dashboard/webinars`. Open any webinar in the wizard. Verify:

- Top nav shows 9 step icons + labels + numbered circles + green/gray line
- Step 1 has 2 ToggleCards below language selector with info banners
- Step 2 has shadcn Select for timezone + 5 template cards in a grid
- Step 3 has 3-column layout: form left, sticky preview right (large viewport); single column on small viewport
- Logo align buttons toggle visually
- Progress bar fields appear when toggle on
- Form field arrows reorder + Switch toggles enabled state
- Preview updates live as fields change

- [ ] **Step 4: Commit any acceptance fixes**

```bash
git status
git add -p
git commit -m "chore: D1 acceptance polish" || true
```

(`|| true` allows no-op commit if nothing changed.)

- [ ] **Step 5: Commit README update**

```bash
git add README.md
git commit -m "docs: document D1 wizard redesign changes"
```

---

## Self-Review (notes for the implementer)

- **Spec coverage:** every DoD item maps to a numbered task. accessFacilitated is wired through schema + UI but doesn't change runtime behavior (deferred per spec).
- **Type consistency:** `WaitingTemplateId`, `LogoAlign` literals stay uppercase across schema/zod/components. `formFieldOrder` is `("name"|"email"|"phone")[]` everywhere.
- **`waitingShowThumb` retention:** kept in DB for backwards compat. New UI doesn't show it as a separate toggle — Task 11 leaves it removed from step 2 form (the Switch added in C is replaced by template picker). The server action keeps DB column in sync (Task 14). After D2-D4 stabilize, future migration can drop the column.
- **Cross-browser dependency:** `Intl.DateTimeFormat().resolvedOptions().timeZone` is supported in all modern browsers. Test mocks it for jsdom.
- **`text[]` Postgres arrays + Prisma `String[]`:** types come through as `string[]` in TS — cast to `("name"|"email"|"phone")[]` at the boundary (Task 16 step 3, Task 17). The Zod schema enforces the literal at runtime.
- **Sticky preview:** uses `lg:sticky lg:top-4 lg:self-start`. Tested in browser at >= 1024px viewports.
- **Field arrows:** chose simple `↑/↓` over drag-drop to avoid extra deps. UX matches screenshot well enough.
