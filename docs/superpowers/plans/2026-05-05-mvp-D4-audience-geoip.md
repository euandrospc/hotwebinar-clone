# MVP Sub-plan D4 — Audiência + GeoIP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Wizard Step 8 (Audiência) with simulated audience counter (NONE/FIXED/DYNAMIC modes + min/max + live badge) plus best-effort GeoIP enrichment (city/region/lat/lng) at lead opt-in. Player renders an `<AudienceBadge>` in the header that animates a deterministic counter over time.

**Architecture:** 4 audience columns + 1 enum on Webinar. 4 geo columns on Lead. Pure deterministic simulation function shared by wizard chart (Recharts) and player counter (5 s ticks). GeoIP via ipapi.co fire-and-forget after `submitOptin` — silent fail.

**Tech Stack:** Next.js 15 App Router (Turbopack), Prisma 5 + Postgres, Zod, react-hook-form, shadcn/ui (+ new `radio-group` primitive), recharts, lucide-react, vitest + @testing-library/react.

---

## File Structure

### Created

| Path | Responsibility |
|---|---|
| `packages/db/prisma/migrations/20260505230000_d4_audience_and_geo/migration.sql` | New `AudienceMode` enum, 4 audience cols on Webinar, 4 geo cols on Lead |
| `apps/web/src/lib/audience-sim.ts` | Pure deterministic simulation: `hashSeed`, `simulateAudienceAt`, `simulateAudienceSeries` |
| `apps/web/src/lib/geoip.ts` | `enrichLeadGeo(leadId, ip)` ipapi.co fetch + Lead update; silent fail |
| `apps/web/src/components/ui/radio-group.tsx` | shadcn RadioGroup primitive |
| `apps/web/src/components/wizard/audience-chart.tsx` | Recharts `<LineChart>` over `simulateAudienceSeries` |
| `apps/web/src/components/wizard/step-8-form.tsx` | RHF form: RadioGroup mode + min/max + live switch + sticky chart aside |
| `apps/web/src/app/[slug]/_components/audience-badge.tsx` | Player header badge: live dot + counter |
| `apps/web/src/test/lib/audience-sim.test.ts` | Hash + simulate at/series tests |
| `apps/web/src/test/lib/validations/step8.test.ts` | step8Schema unit tests |
| `apps/web/src/test/lib/geoip.test.ts` | enrichLeadGeo (mocked fetch) tests |
| `apps/web/src/test/components/audience-badge.test.tsx` | NONE/FIXED/DYNAMIC + live dot toggle tests |
| `apps/web/src/test/components/audience-chart.test.tsx` | Mode-based render tests |

### Modified

| Path | Reason |
|---|---|
| `packages/db/prisma/schema.prisma` | Add `AudienceMode` enum + 4 Webinar cols + 4 Lead cols |
| `apps/web/src/lib/validations/webinar.ts` | Add `step8Schema` + `Step8Input` |
| `apps/web/src/server/actions/webinar.ts` | Add `updateWebinarStep8` |
| `apps/web/src/server/actions/public.ts` | `submitOptin` calls `void enrichLeadGeo(lead.id, ip)` after persist |
| `apps/web/src/app/dashboard/webinars/[id]/(wizard)/step-8/page.tsx` | Replace stub with real form + initial values |
| `apps/web/src/lib/public-dto.ts` | Add 4 audience fields to `PublicWebinar` + `publicWebinarDto` |
| `apps/web/src/app/[slug]/_components/player-shell.tsx` | Render `<AudienceBadge>` in header |
| `apps/web/src/test/server/actions/webinar.test.ts` | Extend with `updateWebinarStep8` describe |
| `apps/web/src/test/server/actions/public-optin.test.ts` | Add geoip enrichment fire-and-forget verification |
| `apps/web/package.json` (auto via pnpm) | Add `recharts`, `@radix-ui/react-radio-group` |
| `README.md` | Document D4 changes |

---

## Task Plan (14 tasks)

---

### Task 1: Migration + schema

**Files:**
- Create: `packages/db/prisma/migrations/20260505230000_d4_audience_and_geo/migration.sql`
- Modify: `packages/db/prisma/schema.prisma`

- [ ] **Step 1: Stop dev server (Windows EPERM avoidance)**

If port 3000 has a running Next.js process, free it before applying the migration. Use:

```
powershell -Command "Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess | ForEach-Object { Stop-Process -Id \$_ -Force -ErrorAction SilentlyContinue }"
```

- [ ] **Step 2: Edit `packages/db/prisma/schema.prisma`**

(a) Add new enum near the other enums (after `enum LogoAlign`):

```prisma
enum AudienceMode {
  NONE
  FIXED
  DYNAMIC
}
```

(b) In `model Webinar { ... }`, append 4 new columns near the end of the field list (before relations):

```prisma
  audienceMode      AudienceMode @default(NONE)
  audienceMin       Int          @default(50)
  audienceMax       Int          @default(500)
  audienceLiveBadge Boolean      @default(true)
```

(c) In `model Lead { ... }`, append 4 new columns next to the existing `country` column:

```prisma
  city   String?
  region String?
  lat    Float?
  lng    Float?
```

- [ ] **Step 3: Create migration SQL `packages/db/prisma/migrations/20260505230000_d4_audience_and_geo/migration.sql`**

```sql
-- 1. Audience enum
CREATE TYPE "AudienceMode" AS ENUM ('NONE', 'FIXED', 'DYNAMIC');

-- 2. Webinar audience columns
ALTER TABLE "webinar"
  ADD COLUMN "audienceMode"      "AudienceMode" NOT NULL DEFAULT 'NONE',
  ADD COLUMN "audienceMin"       INTEGER NOT NULL DEFAULT 50,
  ADD COLUMN "audienceMax"       INTEGER NOT NULL DEFAULT 500,
  ADD COLUMN "audienceLiveBadge" BOOLEAN NOT NULL DEFAULT true;

-- 3. Lead geo columns
ALTER TABLE "lead"
  ADD COLUMN "city"   TEXT,
  ADD COLUMN "region" TEXT,
  ADD COLUMN "lat"    DOUBLE PRECISION,
  ADD COLUMN "lng"    DOUBLE PRECISION;
```

- [ ] **Step 4: Apply + regenerate**

From `packages/db`:

```bash
pnpm --filter db exec prisma migrate dev --name d4_audience_and_geo
pnpm --filter db exec prisma generate
pnpm --filter db exec prisma format
```

If the existing migration directory matches the proposed name, accept it. Verify the regenerated client `node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/.prisma/client/index.d.ts` mentions `AudienceMode`.

- [ ] **Step 5: Commit**

```bash
git add packages/db/prisma/schema.prisma packages/db/prisma/migrations/20260505230000_d4_audience_and_geo
git commit -m "feat(db): D4 schema — AudienceMode enum + 4 webinar audience cols + 4 lead geo cols"
```

---

### Task 2: Validations — step8Schema

**Files:**
- Modify: `apps/web/src/lib/validations/webinar.ts`
- Create: `apps/web/src/test/lib/validations/step8.test.ts`

- [ ] **Step 1: Write failing test `apps/web/src/test/lib/validations/step8.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { step8Schema } from "@/lib/validations/webinar";

const VALID = {
  audienceMode: "DYNAMIC" as const,
  audienceMin: 50,
  audienceMax: 500,
  audienceLiveBadge: true
};

describe("step8Schema", () => {
  it("accepts valid input", () => {
    expect(step8Schema.safeParse(VALID).success).toBe(true);
  });
  it("accepts NONE + FIXED modes", () => {
    expect(step8Schema.safeParse({ ...VALID, audienceMode: "NONE" }).success).toBe(true);
    expect(step8Schema.safeParse({ ...VALID, audienceMode: "FIXED" }).success).toBe(true);
  });
  it("rejects invalid mode", () => {
    expect(step8Schema.safeParse({ ...VALID, audienceMode: "OTHER" }).success).toBe(false);
  });
  it("rejects max < min", () => {
    expect(step8Schema.safeParse({ ...VALID, audienceMin: 500, audienceMax: 100 }).success).toBe(false);
  });
  it("rejects negative min", () => {
    expect(step8Schema.safeParse({ ...VALID, audienceMin: -1 }).success).toBe(false);
  });
  it("accepts min === max", () => {
    expect(step8Schema.safeParse({ ...VALID, audienceMin: 200, audienceMax: 200 }).success).toBe(true);
  });
});
```

- [ ] **Step 2: Run, verify failure**

```bash
pnpm --filter web exec vitest run src/test/lib/validations/step8.test.ts
```

Expected: FAIL — `step8Schema` not exported.

- [ ] **Step 3: Append to `apps/web/src/lib/validations/webinar.ts`** (after step7 exports)

```ts
export const step8Schema = z.object({
  audienceMode: z.enum(["NONE", "FIXED", "DYNAMIC"]),
  audienceMin: z.number().int().min(0).max(1_000_000),
  audienceMax: z.number().int().min(0).max(1_000_000),
  audienceLiveBadge: z.boolean()
}).refine((d) => d.audienceMax >= d.audienceMin, {
  message: "Max deve ser ≥ Min",
  path: ["audienceMax"]
});
export type Step8Input = z.infer<typeof step8Schema>;
```

- [ ] **Step 4: Run test**

```bash
pnpm --filter web exec vitest run src/test/lib/validations/step8.test.ts
```

Expected: PASS (6/6).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/validations/webinar.ts apps/web/src/test/lib/validations/step8.test.ts
git commit -m "feat(web): D4 step8Schema validations"
```

---

### Task 3: lib/audience-sim — hash + simulate

**Files:**
- Create: `apps/web/src/lib/audience-sim.ts`
- Create: `apps/web/src/test/lib/audience-sim.test.ts`

- [ ] **Step 1: Write failing test `apps/web/src/test/lib/audience-sim.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import {
  hashSeed,
  simulateAudienceAt,
  simulateAudienceSeries
} from "@/lib/audience-sim";

describe("hashSeed", () => {
  it("is deterministic", () => {
    expect(hashSeed("abc")).toBe(hashSeed("abc"));
    expect(hashSeed("abc")).not.toBe(hashSeed("abd"));
  });
});

describe("simulateAudienceAt — DYNAMIC", () => {
  it("stays within [min, max] across timeline", () => {
    const min = 100;
    const max = 200;
    for (let t = 0; t <= 3600; t += 60) {
      const v = simulateAudienceAt(t, 3600, min, max, "seed-x", "DYNAMIC");
      expect(v).toBeGreaterThanOrEqual(min);
      expect(v).toBeLessThanOrEqual(max);
    }
  });
  it("is deterministic per seed + t", () => {
    expect(simulateAudienceAt(120, 3600, 50, 500, "seed-1", "DYNAMIC"))
      .toBe(simulateAudienceAt(120, 3600, 50, 500, "seed-1", "DYNAMIC"));
  });
  it("varies across t in DYNAMIC mode", () => {
    const a = simulateAudienceAt(60, 3600, 50, 500, "s", "DYNAMIC");
    const b = simulateAudienceAt(1800, 3600, 50, 500, "s", "DYNAMIC");
    const c = simulateAudienceAt(3500, 3600, 50, 500, "s", "DYNAMIC");
    // At least one pair differs (very likely with envelope + jitter)
    expect(a !== b || b !== c || a !== c).toBe(true);
  });
});

describe("simulateAudienceAt — FIXED", () => {
  it("returns same value at any t", () => {
    const seed = "fixed-seed";
    const v0 = simulateAudienceAt(0, 3600, 100, 200, seed, "FIXED");
    const v1 = simulateAudienceAt(1800, 3600, 100, 200, seed, "FIXED");
    const v2 = simulateAudienceAt(3500, 3600, 100, 200, seed, "FIXED");
    expect(v0).toBe(v1);
    expect(v1).toBe(v2);
    expect(v0).toBeGreaterThanOrEqual(100);
    expect(v0).toBeLessThanOrEqual(200);
  });
});

describe("simulateAudienceSeries", () => {
  it("returns N+1 samples from 0 to duration", () => {
    const series = simulateAudienceSeries(3600, 50, 500, "s", "DYNAMIC", 12);
    expect(series).toHaveLength(13);
    expect(series[0].t).toBe(0);
    expect(series[12].t).toBe(3600);
    for (const p of series) {
      expect(p.count).toBeGreaterThanOrEqual(50);
      expect(p.count).toBeLessThanOrEqual(500);
    }
  });
});
```

- [ ] **Step 2: Run, verify failure**

```bash
pnpm --filter web exec vitest run src/test/lib/audience-sim.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `apps/web/src/lib/audience-sim.ts`**

```ts
export type AudienceMode = "NONE" | "FIXED" | "DYNAMIC";

export function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  }
  return Math.abs(h | 0);
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

export function simulateAudienceAt(
  t: number,
  duration: number,
  min: number,
  max: number,
  seed: string,
  mode: AudienceMode = "DYNAMIC"
): number {
  if (max <= min) return min;
  const h = hashSeed(seed);
  if (mode === "FIXED") {
    return min + (h % (max - min + 1));
  }
  const norm = duration > 0 ? Math.min(t / duration, 1) : 0;
  const envelope =
    norm < 0.3 ? norm / 0.3
    : norm < 0.8 ? 1
    : 1 - ((norm - 0.8) / 0.2) * 0.2;
  const jitter = Math.sin((t + h) * 0.13) * 0.05;
  const range = max - min;
  return Math.round(min + range * clamp01(envelope + jitter));
}

export function simulateAudienceSeries(
  duration: number,
  min: number,
  max: number,
  seed: string,
  mode: AudienceMode = "DYNAMIC",
  samples = 60
): Array<{ t: number; count: number }> {
  const out: Array<{ t: number; count: number }> = [];
  for (let i = 0; i <= samples; i++) {
    const t = (duration / samples) * i;
    out.push({ t, count: simulateAudienceAt(t, duration, min, max, seed, mode) });
  }
  return out;
}
```

- [ ] **Step 4: Run test**

```bash
pnpm --filter web exec vitest run src/test/lib/audience-sim.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/audience-sim.ts apps/web/src/test/lib/audience-sim.test.ts
git commit -m "feat(web): D4 audience-sim — deterministic hash + S-curve simulator"
```

---

### Task 4: lib/geoip — enrichLeadGeo

**Files:**
- Create: `apps/web/src/lib/geoip.ts`
- Create: `apps/web/src/test/lib/geoip.test.ts`

- [ ] **Step 1: Write failing test `apps/web/src/test/lib/geoip.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { prisma } from "db";
import { enrichLeadGeo } from "@/lib/geoip";

const TEST_USER = { id: "geo-user", email: "geo@example.com", name: "Geo" };

beforeEach(async () => {
  await prisma.lead.deleteMany({});
  await prisma.webinar.deleteMany({});
  await prisma.session.deleteMany({});
  await prisma.account.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.user.create({ data: TEST_USER });
  vi.unstubAllGlobals();
});

afterAll(async () => prisma.$disconnect());

async function makeLead() {
  const w = await prisma.webinar.create({
    data: { ownerId: TEST_USER.id, name: "T", title: "T", slug: "g-" + Math.random().toString(36).slice(2, 6) }
  });
  return prisma.lead.create({
    data: { webinarId: w.id, name: "L", email: `l${Date.now()}@e.com` }
  });
}

describe("enrichLeadGeo", () => {
  it("persists country/region/city/lat/lng on success", async () => {
    const lead = await makeLead();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ country_code: "BR", region: "SP", city: "São Paulo", latitude: -23.5, longitude: -46.6 })
    });
    vi.stubGlobal("fetch", fetchMock);
    await enrichLeadGeo(lead.id, "8.8.8.8");
    const after = await prisma.lead.findUnique({ where: { id: lead.id } });
    expect(after?.country).toBe("BR");
    expect(after?.region).toBe("SP");
    expect(after?.city).toBe("São Paulo");
    expect(after?.lat).toBe(-23.5);
    expect(after?.lng).toBe(-46.6);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://ipapi.co/8.8.8.8/json/",
      expect.objectContaining({ headers: expect.any(Object) })
    );
  });
  it("skips silently for empty / unknown / private IPs", async () => {
    const lead = await makeLead();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await enrichLeadGeo(lead.id, "");
    await enrichLeadGeo(lead.id, "unknown");
    await enrichLeadGeo(lead.id, "127.0.0.1");
    await enrichLeadGeo(lead.id, "192.168.1.10");
    await enrichLeadGeo(lead.id, "10.0.0.5");
    expect(fetchMock).not.toHaveBeenCalled();
    const after = await prisma.lead.findUnique({ where: { id: lead.id } });
    expect(after?.country).toBeNull();
    expect(after?.lat).toBeNull();
  });
  it("swallows HTTP errors", async () => {
    const lead = await makeLead();
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);
    await expect(enrichLeadGeo(lead.id, "8.8.8.8")).resolves.toBeUndefined();
    const after = await prisma.lead.findUnique({ where: { id: lead.id } });
    expect(after?.country).toBeNull();
  });
  it("swallows network errors", async () => {
    const lead = await makeLead();
    const fetchMock = vi.fn().mockRejectedValue(new Error("network"));
    vi.stubGlobal("fetch", fetchMock);
    await expect(enrichLeadGeo(lead.id, "8.8.8.8")).resolves.toBeUndefined();
  });
  it("skips when API returns error:true", async () => {
    const lead = await makeLead();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ error: true })
    });
    vi.stubGlobal("fetch", fetchMock);
    await enrichLeadGeo(lead.id, "8.8.8.8");
    const after = await prisma.lead.findUnique({ where: { id: lead.id } });
    expect(after?.country).toBeNull();
  });
});
```

- [ ] **Step 2: Run, verify failure**

```bash
pnpm --filter web exec vitest run src/test/lib/geoip.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `apps/web/src/lib/geoip.ts`**

```ts
import { prisma } from "db";

const PRIVATE_IP_PREFIXES = [
  "127.", "10.", "192.168.",
  "172.16.", "172.17.", "172.18.", "172.19.", "172.20.",
  "172.21.", "172.22.", "172.23.", "172.24.", "172.25.",
  "172.26.", "172.27.", "172.28.", "172.29.", "172.30.", "172.31.",
  "::1", "fe80:"
];

export async function enrichLeadGeo(leadId: string, ip: string): Promise<void> {
  if (!ip || ip === "unknown") return;
  if (PRIVATE_IP_PREFIXES.some((p) => ip.startsWith(p))) return;
  try {
    const res = await fetch(`https://ipapi.co/${ip}/json/`, {
      signal: AbortSignal.timeout(3000),
      headers: { "user-agent": "hotwebinar-clone/1.0" }
    });
    if (!res.ok) return;
    const d = (await res.json()) as {
      country_code?: string;
      region?: string;
      city?: string;
      latitude?: number;
      longitude?: number;
      error?: boolean;
    };
    if (d.error) return;
    await prisma.lead.update({
      where: { id: leadId },
      data: {
        country: d.country_code ?? null,
        region: d.region ?? null,
        city: d.city ?? null,
        lat: typeof d.latitude === "number" ? d.latitude : null,
        lng: typeof d.longitude === "number" ? d.longitude : null
      }
    });
  } catch {
    /* silent — best-effort enrichment */
  }
}
```

- [ ] **Step 4: Run test**

```bash
pnpm --filter web exec vitest run src/test/lib/geoip.test.ts
```

Expected: PASS (5/5).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/geoip.ts apps/web/src/test/lib/geoip.test.ts
git commit -m "feat(web): D4 geoip enrichLeadGeo — ipapi.co best-effort, silent fail"
```

---

### Task 5: shadcn RadioGroup primitive

**Files:**
- Create: `apps/web/src/components/ui/radio-group.tsx`
- Modify: `apps/web/package.json` (auto via pnpm)

- [ ] **Step 1: Install Radix primitive**

```bash
pnpm --filter web add @radix-ui/react-radio-group
```

- [ ] **Step 2: Create `apps/web/src/components/ui/radio-group.tsx`**

```tsx
"use client";
import * as React from "react";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import { Circle } from "lucide-react";
import { cn } from "@/lib/utils";

const RadioGroup = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>
>(({ className, ...props }, ref) => (
  <RadioGroupPrimitive.Root ref={ref} className={cn("grid gap-2", className)} {...props} />
));
RadioGroup.displayName = RadioGroupPrimitive.Root.displayName;

const RadioGroupItem = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item>
>(({ className, ...props }, ref) => (
  <RadioGroupPrimitive.Item
    ref={ref}
    className={cn(
      "aspect-square h-4 w-4 rounded-full border border-primary text-primary ring-offset-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    {...props}
  >
    <RadioGroupPrimitive.Indicator className="flex items-center justify-center">
      <Circle className="h-2.5 w-2.5 fill-current text-current" />
    </RadioGroupPrimitive.Indicator>
  </RadioGroupPrimitive.Item>
));
RadioGroupItem.displayName = RadioGroupPrimitive.Item.displayName;

export { RadioGroup, RadioGroupItem };
```

- [ ] **Step 3: Verify typecheck**

```bash
pnpm --filter web exec tsc --noEmit 2>&1 | grep "radio-group" | head
```

Expected: zero errors specific to this file.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/ui/radio-group.tsx apps/web/package.json pnpm-lock.yaml
git commit -m "feat(web): add shadcn RadioGroup primitive"
```

---

### Task 6: AudienceChart component (Recharts)

**Files:**
- Create: `apps/web/src/components/wizard/audience-chart.tsx`
- Create: `apps/web/src/test/components/audience-chart.test.tsx`
- Modify: `apps/web/package.json` (auto via pnpm)

- [ ] **Step 1: Install Recharts**

```bash
pnpm --filter web add recharts
```

- [ ] **Step 2: Write failing test `apps/web/src/test/components/audience-chart.test.tsx`**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AudienceChart } from "@/components/wizard/audience-chart";

describe("AudienceChart", () => {
  it("renders placeholder text in NONE mode", () => {
    render(<AudienceChart mode="NONE" min={50} max={500} duration={3600} seed="x" />);
    expect(screen.getByText(/desabilitado/i)).toBeInTheDocument();
  });
  it("renders SVG line for DYNAMIC mode", () => {
    const { container } = render(
      <AudienceChart mode="DYNAMIC" min={50} max={500} duration={3600} seed="x" />
    );
    expect(container.querySelectorAll("svg path").length).toBeGreaterThan(0);
  });
  it("renders SVG line for FIXED mode", () => {
    const { container } = render(
      <AudienceChart mode="FIXED" min={50} max={500} duration={3600} seed="x" />
    );
    expect(container.querySelectorAll("svg path").length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 3: Run, verify failure**

```bash
pnpm --filter web exec vitest run src/test/components/audience-chart.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 4: Implement `apps/web/src/components/wizard/audience-chart.tsx`**

```tsx
"use client";
import { useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { simulateAudienceSeries, type AudienceMode } from "@/lib/audience-sim";

interface Props {
  mode: AudienceMode;
  min: number;
  max: number;
  duration: number;
  seed: string;
}

function fmtTime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h}h${String(m).padStart(2, "0")}` : `${m}m`;
}

export function AudienceChart({ mode, min, max, duration, seed }: Props) {
  const data = useMemo(
    () =>
      mode === "NONE"
        ? []
        : simulateAudienceSeries(duration, min, max, seed, mode),
    [mode, min, max, duration, seed]
  );

  if (mode === "NONE") {
    return (
      <div className="flex h-60 items-center justify-center rounded-md border bg-muted/30 text-sm text-muted-foreground">
        Modo desabilitado
      </div>
    );
  }

  return (
    <div className="h-60 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="t" tickFormatter={fmtTime} stroke="hsl(var(--muted-foreground))" fontSize={11} />
          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
          <Tooltip
            labelFormatter={fmtTime}
            contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", fontSize: 12 }}
          />
          <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 5: Run test**

```bash
pnpm --filter web exec vitest run src/test/components/audience-chart.test.tsx
```

Expected: PASS (3/3). If recharts ResponsiveContainer measures 0×0 in jsdom and skips rendering, set explicit `width={400} height={240}` on `<LineChart>` directly inside the test (or add `width: 600` style on the outer div) — but try the spec version first.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/wizard/audience-chart.tsx apps/web/src/test/components/audience-chart.test.tsx apps/web/package.json pnpm-lock.yaml
git commit -m "feat(web): D4 AudienceChart — Recharts preview of simulated audience"
```

---

### Task 7: AudienceBadge player component

**Files:**
- Create: `apps/web/src/app/[slug]/_components/audience-badge.tsx`
- Create: `apps/web/src/test/components/audience-badge.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { useRef } from "react";
import { AudienceBadge } from "@/app/[slug]/_components/audience-badge";

function Harness({
  initialT,
  mode,
  showLiveBadge = true
}: {
  initialT: number;
  mode: "NONE" | "FIXED" | "DYNAMIC";
  showLiveBadge?: boolean;
}) {
  const ref = useRef(initialT);
  return (
    <AudienceBadge
      mode={mode}
      min={100}
      max={200}
      showLiveBadge={showLiveBadge}
      seed="webinar-1:lead-1"
      durationSec={3600}
      currentTimeRef={ref}
    />
  );
}

beforeEach(() => {
  vi.useFakeTimers();
});

describe("AudienceBadge", () => {
  it("renders nothing when mode=NONE", () => {
    const { container } = render(<Harness initialT={0} mode="NONE" />);
    expect(container.firstChild).toBeNull();
  });
  it("renders count + live label for DYNAMIC + showLiveBadge=true", () => {
    render(<Harness initialT={1800} mode="DYNAMIC" showLiveBadge={true} />);
    expect(screen.getByText(/AO VIVO/i)).toBeInTheDocument();
    expect(screen.getByText(/assistindo/i)).toBeInTheDocument();
  });
  it("hides live label when showLiveBadge=false", () => {
    render(<Harness initialT={1800} mode="DYNAMIC" showLiveBadge={false} />);
    expect(screen.queryByText(/AO VIVO/i)).toBeNull();
    expect(screen.getByText(/assistindo/i)).toBeInTheDocument();
  });
  it("FIXED mode renders constant count", () => {
    render(<Harness initialT={0} mode="FIXED" />);
    const initial = screen.getByText(/assistindo/i).textContent;
    act(() => { vi.advanceTimersByTime(6000); });
    expect(screen.getByText(/assistindo/i).textContent).toBe(initial);
  });
});
```

- [ ] **Step 2: Run, verify failure**

```bash
pnpm --filter web exec vitest run src/test/components/audience-badge.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `apps/web/src/app/[slug]/_components/audience-badge.tsx`**

```tsx
"use client";
import { useEffect, useState } from "react";
import { simulateAudienceAt, type AudienceMode } from "@/lib/audience-sim";

interface Props {
  mode: AudienceMode;
  min: number;
  max: number;
  showLiveBadge: boolean;
  seed: string;
  durationSec: number;
  currentTimeRef: React.RefObject<number>;
}

const fmt = new Intl.NumberFormat("pt-BR");

export function AudienceBadge({ mode, min, max, showLiveBadge, seed, durationSec, currentTimeRef }: Props) {
  const [count, setCount] = useState<number>(() =>
    mode === "NONE"
      ? 0
      : simulateAudienceAt(currentTimeRef.current ?? 0, durationSec, min, max, seed, mode)
  );

  useEffect(() => {
    if (mode === "NONE" || mode === "FIXED") return;
    const id = setInterval(() => {
      const t = currentTimeRef.current ?? 0;
      setCount(simulateAudienceAt(t, durationSec, min, max, seed, mode));
    }, 5000);
    return () => clearInterval(id);
  }, [mode, min, max, seed, durationSec, currentTimeRef]);

  if (mode === "NONE") return null;

  return (
    <div className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium">
      {showLiveBadge ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-red-600">
          <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" aria-hidden />
          AO VIVO
        </span>
      ) : null}
      <span className="tabular-nums">{fmt.format(count)} assistindo</span>
    </div>
  );
}
```

- [ ] **Step 4: Run test**

```bash
pnpm --filter web exec vitest run src/test/components/audience-badge.test.tsx
```

Expected: PASS (4/4).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/\[slug\]/_components/audience-badge.tsx apps/web/src/test/components/audience-badge.test.tsx
git commit -m "feat(web): D4 AudienceBadge — header live counter with deterministic simulation"
```

---

### Task 8: updateWebinarStep8 server action

**Files:**
- Modify: `apps/web/src/server/actions/webinar.ts`
- Modify: `apps/web/src/test/server/actions/webinar.test.ts`

- [ ] **Step 1: Add failing test**

In `apps/web/src/test/server/actions/webinar.test.ts`, add this describe block (after the existing `updateWebinarStep7` describe):

```ts
describe("updateWebinarStep8", () => {
  it("persists 4 audience cols", async () => {
    const { createDraftWebinar, updateWebinarStep8 } = await import("@/server/actions/webinar?" + Date.now());
    const { id } = await createDraftWebinar();
    const r = await updateWebinarStep8(id, {
      audienceMode: "DYNAMIC",
      audienceMin: 100,
      audienceMax: 1000,
      audienceLiveBadge: false
    });
    expect(r).toEqual({ ok: true });
    const w = await prisma.webinar.findUnique({ where: { id } });
    expect(w).toMatchObject({
      audienceMode: "DYNAMIC",
      audienceMin: 100,
      audienceMax: 1000,
      audienceLiveBadge: false
    });
  });

  it("rejects when called for another user's webinar", async () => {
    const { updateWebinarStep8 } = await import("@/server/actions/webinar?" + (Date.now() + 1));
    await prisma.user.create({ data: { id: "stranger-8", email: "s8@x.com", name: "S8" } });
    const stranger = await prisma.webinar.create({ data: { ownerId: "stranger-8" } });
    const r = await updateWebinarStep8(stranger.id, {
      audienceMode: "NONE",
      audienceMin: 0,
      audienceMax: 0,
      audienceLiveBadge: false
    });
    expect(r).toMatchObject({ error: { message: expect.stringMatching(/não encontrado/i) } });
  });
});
```

- [ ] **Step 2: Run, verify failure**

```bash
pnpm --filter web exec vitest run src/test/server/actions/webinar.test.ts
```

Expected: FAIL — `updateWebinarStep8` not exported.

- [ ] **Step 3: Update `apps/web/src/server/actions/webinar.ts`**

(a) Add to imports — extend the existing import block from `@/lib/validations/webinar`:

```ts
import {
  // ... existing entries
  step8Schema,
  type Step8Input
} from "@/lib/validations/webinar";
```

(b) Append the new action just before `updateWebinarIntegrations`:

```ts
export async function updateWebinarStep8(id: string, input: Step8Input): Promise<Result> {
  const session = await requireSession();
  const owned = await loadOwned(id, session.user.id);
  if (!owned) return notFound();
  const parsed = step8Schema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: { field: issue.path.join("."), message: issue.message } };
  }
  await prisma.webinar.update({
    where: { id },
    data: {
      audienceMode: parsed.data.audienceMode,
      audienceMin: parsed.data.audienceMin,
      audienceMax: parsed.data.audienceMax,
      audienceLiveBadge: parsed.data.audienceLiveBadge
    }
  });
  revalidatePath(`/dashboard/webinars/${id}`);
  return { ok: true };
}
```

- [ ] **Step 4: Run test**

```bash
pnpm --filter web exec vitest run src/test/server/actions/webinar.test.ts
```

Expected: PASS for the new describe + zero regressions.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/server/actions/webinar.ts apps/web/src/test/server/actions/webinar.test.ts
git commit -m "feat(web): D4 updateWebinarStep8 — persist 4 audience cols"
```

---

### Task 9: PublicWebinar DTO — add audience fields

**Files:**
- Modify: `apps/web/src/lib/public-dto.ts`

- [ ] **Step 1: Edit `apps/web/src/lib/public-dto.ts`**

(a) Add 4 fields to the `PublicWebinar` type. Insert them anywhere in the type (e.g., after `formFieldOrder`):

```ts
  audienceMode: "NONE" | "FIXED" | "DYNAMIC";
  audienceMin: number;
  audienceMax: number;
  audienceLiveBadge: boolean;
```

(b) Add the same 4 fields to the object returned by `publicWebinarDto`:

```ts
    audienceMode: w.audienceMode,
    audienceMin: w.audienceMin,
    audienceMax: w.audienceMax,
    audienceLiveBadge: w.audienceLiveBadge,
```

- [ ] **Step 2: Verify**

```bash
pnpm --filter web exec tsc --noEmit 2>&1 | grep public-dto | head
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/public-dto.ts
git commit -m "feat(web): D4 expose audience fields in PublicWebinar DTO"
```

---

### Task 10: submitOptin — fire-and-forget GeoIP enrichment

**Files:**
- Modify: `apps/web/src/server/actions/public.ts`
- Modify: `apps/web/src/test/server/actions/public-optin.test.ts`

- [ ] **Step 1: Add a failing test**

In `apps/web/src/test/server/actions/public-optin.test.ts`, add a new mock at the top (alongside the existing mocks for `next/headers`, `next/cache`, `jobs`, `next/navigation`):

```ts
const enrichLeadGeoMock = vi.fn(async () => undefined);
vi.mock("@/lib/geoip", () => ({
  enrichLeadGeo: (...args: unknown[]) => enrichLeadGeoMock(...args)
}));
```

In the existing `beforeEach`, add `enrichLeadGeoMock.mockClear();` near the other `.mockClear()` calls.

Inside `describe("submitOptin", ...)`, add this case (after the existing UTM persistence test):

```ts
  it("invokes enrichLeadGeo with lead.id + ip after persisting", async () => {
    await makeWebinar({ slug: "demo-geo" });
    const { submitOptin } = await import("@/server/actions/public?" + (Date.now() + 9));
    const fd = new FormData();
    fd.set("name", "G"); fd.set("email", "g@e.com"); fd.set("phone", "+5511999990000");
    await expect(submitOptin("demo-geo", fd)).rejects.toThrow(/__redirect/);
    const lead = await prisma.lead.findFirst({ where: { email: "g@e.com" } });
    expect(enrichLeadGeoMock).toHaveBeenCalledWith(lead!.id, "1.2.3.4");
  });
```

The existing test mock for `next/headers` already injects `x-forwarded-for: 1.2.3.4`, so that's the IP that `submitOptin` extracts.

- [ ] **Step 2: Run, verify failure**

```bash
pnpm --filter web exec vitest run src/test/server/actions/public-optin.test.ts
```

Expected: FAIL — `enrichLeadGeo` not called yet.

- [ ] **Step 3: Update `apps/web/src/server/actions/public.ts`**

Add to imports (alongside `enqueueWebhook`):

```ts
import { enrichLeadGeo } from "@/lib/geoip";
```

Just BEFORE the existing `await enqueueWebhook(w, "lead_novo", lead);` line, add:

```ts
  void enrichLeadGeo(lead.id, ip);
```

`void` discards the promise — fire and forget. The action then continues to enqueueWebhook + redirect immediately.

- [ ] **Step 4: Run test**

```bash
pnpm --filter web exec vitest run src/test/server/actions/public-optin.test.ts
```

Expected: PASS for the new case + zero regressions.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/server/actions/public.ts apps/web/src/test/server/actions/public-optin.test.ts
git commit -m "feat(web): D4 submitOptin fires enrichLeadGeo (fire-and-forget) after lead persist"
```

---

### Task 11: PlayerShell — render AudienceBadge in header

**Files:**
- Modify: `apps/web/src/app/[slug]/_components/player-shell.tsx`

- [ ] **Step 1: Update player-shell.tsx**

(a) Add import:

```tsx
import { AudienceBadge } from "./audience-badge";
```

(b) In the existing JSX, locate the `<header>` block. It currently looks like:

```tsx
<header className="flex items-center justify-between border-b p-4">
  {webinar.logoUrl ? <img src={webinar.logoUrl} alt="" className="h-8 object-contain" /> : <div />}
  <span className="text-sm text-muted-foreground">Olá, {lead.name}</span>
</header>
```

Insert `<AudienceBadge>` between the logo div and the lead-name span:

```tsx
<header className="flex items-center justify-between border-b p-4">
  {webinar.logoUrl ? <img src={webinar.logoUrl} alt="" className="h-8 object-contain" /> : <div />}
  <AudienceBadge
    mode={webinar.audienceMode}
    min={webinar.audienceMin}
    max={webinar.audienceMax}
    showLiveBadge={webinar.audienceLiveBadge}
    seed={`${webinar.id}:${lead.id}`}
    durationSec={video?.durationSec ?? 3600}
    currentTimeRef={currentTimeRef}
  />
  <span className="text-sm text-muted-foreground">Olá, {lead.name}</span>
</header>
```

- [ ] **Step 2: Verify**

```bash
pnpm --filter web exec tsc --noEmit 2>&1 | grep player-shell | head
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/\[slug\]/_components/player-shell.tsx
git commit -m "feat(web): D4 wire AudienceBadge into PlayerShell header"
```

---

### Task 12: Step 8 page + Step8Form

**Files:**
- Modify (full replace): `apps/web/src/app/dashboard/webinars/[id]/(wizard)/step-8/page.tsx`
- Create: `apps/web/src/components/wizard/step-8-form.tsx`

- [ ] **Step 1: Replace `apps/web/src/app/dashboard/webinars/[id]/(wizard)/step-8/page.tsx`**

```tsx
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "db";
import { Step8Form } from "@/components/wizard/step-8-form";

export default async function Step8Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) notFound();
  const w = await prisma.webinar.findUnique({
    where: { id },
    include: { video: true }
  });
  if (!w || w.ownerId !== session.user.id) notFound();

  const durationSec =
    w.video?.durationSec ??
    (w.startDate && w.endDate
      ? Math.max(60, Math.floor((w.endDate.getTime() - w.startDate.getTime()) / 1000))
      : 3600);

  return (
    <Step8Form
      webinarId={id}
      durationSec={durationSec}
      seed={`${id}:preview`}
      initial={{
        audienceMode: w.audienceMode,
        audienceMin: w.audienceMin,
        audienceMax: w.audienceMax,
        audienceLiveBadge: w.audienceLiveBadge
      }}
    />
  );
}
```

- [ ] **Step 2: Create `apps/web/src/components/wizard/step-8-form.tsx`**

```tsx
"use client";
import { useTransition } from "react";
import { useForm, Controller, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { step8Schema, type Step8Input } from "@/lib/validations/webinar";
import { updateWebinarStep8 } from "@/server/actions/webinar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { AudienceChart } from "@/components/wizard/audience-chart";
import { WizardNav } from "@/components/wizard/wizard-nav";

export interface Step8FormProps {
  webinarId: string;
  durationSec: number;
  seed: string;
  initial: Step8Input;
}

export function Step8Form({ webinarId, durationSec, seed, initial }: Step8FormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const form = useForm<Step8Input>({
    resolver: zodResolver(step8Schema),
    defaultValues: initial
  });
  const { register, handleSubmit, control, formState: { errors } } = form;
  const watched = useWatch({ control });

  function onSubmit(values: Step8Input) {
    startTransition(async () => {
      const r = await updateWebinarStep8(webinarId, values);
      if ("ok" in r) {
        toast.success("Audiência salva");
        router.push(`/dashboard/webinars/${webinarId}/integrations`);
      } else {
        toast.error(r.error.message);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-6 lg:grid-cols-[1fr_minmax(0,420px)]">
      <div className="space-y-6">
        <h2 className="text-2xl font-semibold">Audiência</h2>

        <section className="space-y-3 rounded-lg border bg-card p-4">
          <Label>Modo</Label>
          <Controller
            control={control}
            name="audienceMode"
            render={({ field }) => (
              <RadioGroup
                value={field.value}
                onValueChange={(v) => field.onChange(v)}
                className="grid gap-3"
              >
                {([
                  ["NONE", "Não exibir", "Player não mostra contador de audiência."],
                  ["FIXED", "Audiência fixa", "Mostra um número fixo durante todo o webinar."],
                  ["DYNAMIC", "Audiência dinâmica", "Contador varia ao longo do tempo seguindo curva natural."]
                ] as const).map(([value, label, desc]) => (
                  <label key={value} className="flex cursor-pointer items-start gap-3 rounded-md border p-3 hover:bg-accent/50">
                    <RadioGroupItem value={value} className="mt-1" />
                    <div>
                      <p className="text-sm font-medium">{label}</p>
                      <p className="text-xs text-muted-foreground">{desc}</p>
                    </div>
                  </label>
                ))}
              </RadioGroup>
            )}
          />
        </section>

        <section className="grid gap-4 rounded-lg border bg-card p-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="audienceMin">Mínimo de participantes</Label>
            <Input
              id="audienceMin"
              type="number"
              min={0}
              {...register("audienceMin", { valueAsNumber: true })}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="audienceMax">Máximo de participantes</Label>
            <Input
              id="audienceMax"
              type="number"
              min={0}
              {...register("audienceMax", { valueAsNumber: true })}
            />
            {errors.audienceMax && <p className="text-xs text-destructive">{errors.audienceMax.message}</p>}
          </div>
        </section>

        <section className="rounded-lg border bg-card p-4">
          <Controller
            control={control}
            name="audienceLiveBadge"
            render={({ field }) => (
              <label className="flex items-center gap-3">
                <Switch checked={Boolean(field.value)} onCheckedChange={field.onChange} aria-label="Botão ao vivo" />
                <div>
                  <p className="text-sm font-medium">Exibir botão "AO VIVO"</p>
                  <p className="text-xs text-muted-foreground">Mostra ponto vermelho pulsante + "AO VIVO" ao lado do contador.</p>
                </div>
              </label>
            )}
          />
        </section>

        <WizardNav webinarId={webinarId} step={8} submitting={pending} />
      </div>

      <aside className="space-y-3 lg:sticky lg:top-6 lg:h-fit">
        <h3 className="text-sm font-medium text-muted-foreground">Prévia da curva</h3>
        <AudienceChart
          mode={(watched.audienceMode as "NONE" | "FIXED" | "DYNAMIC") ?? "NONE"}
          min={Number(watched.audienceMin ?? 0)}
          max={Number(watched.audienceMax ?? 0)}
          duration={durationSec}
          seed={seed}
        />
      </aside>
    </form>
  );
}
```

- [ ] **Step 3: Verify**

```bash
pnpm --filter web exec tsc --noEmit 2>&1 | grep -E "step-8" | head
```

Expected: zero errors specific to these files.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/dashboard/webinars/\[id\]/\(wizard\)/step-8/page.tsx apps/web/src/components/wizard/step-8-form.tsx
git commit -m "feat(web): D4 Step8Form — RadioGroup mode + min/max + live switch + chart aside"
```

---

### Task 13: Final cleanup typecheck + tests

**Files:** as needed across project

- [ ] **Step 1: Run full typecheck**

```bash
pnpm -r typecheck 2>&1 | tee typecheck.log | tail -40
```

Expected: clean. Common remaining errors after T1-T12:
- A test fixture passing the old `PublicWebinar` shape without the new audience fields — add `audienceMode: "NONE", audienceMin: 50, audienceMax: 500, audienceLiveBadge: true` to fixtures.
- A reference to `audienceMode` in a test that doesn't yet know about the enum — typically just the public-dto test fixture.

Fix each minimally. Re-run typecheck.

- [ ] **Step 2: Run full test suite**

```bash
pnpm -r --workspace-concurrency=1 test 2>&1 | tail -60
```

Expected: all green.

- [ ] **Step 3: Commit cleanup if needed**

```bash
git status
git add <fixed-files>
git commit -m "chore: D4 typecheck/test cleanup"
```

If tree is clean, no commit needed.

---

### Task 14: README + acceptance

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Append D4 section after the existing "Chat + Vendas (sub-plan D3)" block, before "## Deploy"**

```markdown
## Audiência + GeoIP (sub-plan D4)

- Step 8 (Audiência) — new sub-plan: 3 modos (NONE / FIXED / DYNAMIC), min/max participantes, switch "AO VIVO" badge, prévia da curva (Recharts).
- Player `/[slug]/live` header: `<AudienceBadge>` mostra `🔴 AO VIVO · 1.234 assistindo` quando `audienceMode != NONE`. Counter determinístico via hash(`webinarId:leadId`); DYNAMIC tick 5 s.
- Lead enrichment: opt-in dispara `enrichLeadGeo(leadId, ip)` (fire-and-forget) — busca city/region/lat/lng via ipapi.co. Falha silenciosa em IP privado / rede / rate-limit.
- Schema migration: `20260505230000_d4_audience_and_geo` — enum `AudienceMode`, 4 cols Webinar (`audienceMode/Min/Max/LiveBadge`), 4 cols Lead (`city/region/lat/lng`).
- Mapa de leads = futuro D5.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: document sub-plan D4 audience + geoip in README"
```

- [ ] **Step 3: Final verification**

```bash
git log --oneline -20
git status
```

Expected: clean tree.

---

## Self-Review

**Spec coverage:**

| Spec section | Plan task |
|---|---|
| AudienceMode enum + 4 audience cols on Webinar | T1 |
| 4 geo cols on Lead | T1 |
| `step8Schema` + `Step8Input` | T2 |
| Pure simulation (`hashSeed`, `simulateAudienceAt`, `simulateAudienceSeries`) | T3 |
| `enrichLeadGeo` ipapi.co + private IP skip + silent fail | T4 |
| RadioGroup primitive | T5 |
| AudienceChart (Recharts) | T6 |
| AudienceBadge player component | T7 |
| `updateWebinarStep8` server action | T8 |
| `PublicWebinar` audience fields + dto | T9 |
| `submitOptin` fire-and-forget enrichLeadGeo | T10 |
| PlayerShell renders AudienceBadge in header | T11 |
| Step 8 page + Step8Form | T12 |
| Tests covering: audience-sim, validations, geoip, step8 action, audience-badge, audience-chart, public-optin geo-enrichment | T2/T3/T4/T6/T7/T8/T10 |
| Final cleanup | T13 |
| README | T14 |

**Placeholder check:** scanned — every code change includes complete code blocks. No "TBD" / "implement later" / "similar to Task N".

**Type consistency:**
- `AudienceMode` exported from `lib/audience-sim.ts` (T3) and reused implicitly in T7 (`AudienceBadge` props) + T6 (`AudienceChart` props). Step8Schema enum literals match.
- `simulateAudienceAt(t, duration, min, max, seed, mode)` signature is consistent across T3 (definition), T6 (chart consumer via `simulateAudienceSeries`), T7 (badge consumer).
- `Step8Input` shape (4 fields) matches T2 (defined) → T8 (action input) → T12 (form values).
- `PublicWebinar.audienceMode` literal type `"NONE" | "FIXED" | "DYNAMIC"` matches the enum union from T3.
- `enrichLeadGeo(leadId: string, ip: string): Promise<void>` consistent across T4 (definition) and T10 (call site).
- `currentTimeRef: React.RefObject<number>` matches existing `Tracker`/`SalesNotifier` pattern from earlier sub-plans.

**Done.**
