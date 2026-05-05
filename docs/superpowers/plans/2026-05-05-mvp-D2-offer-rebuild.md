# MVP Sub-plan D2 — Offer Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild Wizard Step 5 (Oferta) per spec `docs/superpowers/specs/2026-05-05-mvp-D2-offer-rebuild-design.md`: replace multi-CTA model with a single embedded Offer per Webinar (15 columns), image upload via S3 presigned PUT, UTM passthrough captured at opt-in, sticky live preview (desktop + mobile cards). Drop legacy `Cta` + `CtaView` tables. Add `RAFFLE_ENTRY` event.

**Architecture:** Offer fields embedded on Webinar. Public player renders one offer card during show/hide window with optional UTM-appended URL. EventKind values `CTA_VIEW`/`CTA_CLICK` renamed in-place to `OFFER_VIEW`/`OFFER_CLICK` (preserves Event rows). New value `RAFFLE_ENTRY`. Image upload reuses existing `HLS_BUCKET` + `presignPut` pattern (no new env). UTMs persisted on `Lead` row (5 columns).

**Tech Stack:** Next.js 15 App Router (Turbopack), Prisma 5 + Postgres, Zod, react-hook-form, shadcn/ui, lucide-react, vitest + @testing-library/react, BullMQ.

---

## File Structure

### Created

| Path | Responsibility |
|---|---|
| `packages/db/prisma/migrations/20260505180000_d2_offer_rebuild/migration.sql` | Drop cta/cta_view, rename EventKind values, add cols |
| `apps/web/src/components/wizard/color-picker-field.tsx` | Controlled `<input type="color">` swatch + hex |
| `apps/web/src/components/wizard/image-upload-field.tsx` | Presigned PUT uploader for offer images |
| `apps/web/src/components/wizard/offer-preview.tsx` | Desktop + mobile preview cards |
| `apps/web/src/app/api/upload/offer-image/route.ts` | POST — presign offer image upload |
| `apps/web/src/app/api/offer-view/route.ts` | POST — emit OFFER_VIEW once per (lead, webinar) |
| `apps/web/src/app/api/offer-click/route.ts` | POST — emit OFFER_CLICK + RAFFLE_ENTRY |
| `apps/web/src/app/[slug]/_components/offer-banner.tsx` | Single offer card on player |
| `apps/web/src/test/lib/validations/step5.test.ts` | step5Schema unit tests |
| `apps/web/src/test/api/upload-offer-image.test.ts` | upload route tests |
| `apps/web/src/test/api/offer-tracking.test.ts` | offer-view/click/raffle tests |
| `apps/web/src/test/components/color-picker-field.test.tsx` | component test |
| `apps/web/src/test/components/image-upload-field.test.tsx` | component test |
| `apps/web/src/test/components/offer-preview.test.tsx` | component test |
| `apps/web/src/test/components/offer-banner.test.tsx` | component test |

### Modified

| Path | Reason |
|---|---|
| `packages/db/prisma/schema.prisma` | Drop Cta/CtaView models, rename EventKind values, add 15 offer cols + 5 utm cols + 3 webhook flag cols |
| `packages/jobs/src/types.ts` | Add `raffle_entry_made` WebhookEvent value |
| `apps/web/src/lib/validations/webinar.ts` | Replace `step5Schema`, rename integrations CTA flags → Offer + raffle |
| `apps/web/src/server/actions/webinar.ts` | Rewrite `updateWebinarStep5`, drop CTA cloning in `duplicateWebinar`, update integrations action |
| `apps/web/src/lib/public-dto.ts` | Add 15 offer fields + UTMs to lead helper |
| `apps/web/src/lib/webhook.ts` | Update FLAG_BY_EVENT mapping |
| `apps/web/src/components/webinar/integrations-form.tsx` | Update toggles + add raffle entry |
| `apps/web/src/app/dashboard/webinars/[id]/(wizard)/step-5/page.tsx` | Read offer cols, pass to form |
| `apps/web/src/components/wizard/step-5-form.tsx` | Full rewrite — no `useFieldArray` |
| `apps/web/src/app/[slug]/live/page.tsx` | Pass offer prop, drop ctas |
| `apps/web/src/app/[slug]/_components/player-shell.tsx` | Replace `<CtaBanner>` with `<OfferBanner>` |
| `apps/web/src/app/[slug]/_lib/public-types.ts` | Drop `PlayerCta`, add `PlayerOffer` |
| `apps/web/src/app/[slug]/_components/capture-form.tsx` | Capture UTMs from URL into hidden inputs |
| `apps/web/src/server/actions/public.ts` | Persist UTMs on Lead |
| `apps/web/src/test/server/actions/webinar.test.ts` | Replace step 5 CTA tests + update duplicateWebinar test |
| `apps/web/src/test/server/actions/public-optin.test.ts` | UTM persistence case |
| `apps/web/src/test/lib/validations/integrations.test.ts` | Rename flags + raffle field |
| `README.md` | Document D2 changes |

### Deleted

| Path | Replaced by |
|---|---|
| `apps/web/src/app/api/cta-view/route.ts` | `offer-view/route.ts` |
| `apps/web/src/app/api/cta-click/route.ts` | `offer-click/route.ts` |
| `apps/web/src/app/[slug]/_components/cta-banner.tsx` | `offer-banner.tsx` |
| `apps/web/src/test/api/cta.test.ts` | `offer-tracking.test.ts` |

---

## Task Plan (19 tasks)

---

### Task 1: Migration + schema + WebhookEvent

**Files:**
- Create: `packages/db/prisma/migrations/20260505180000_d2_offer_rebuild/migration.sql`
- Modify: `packages/db/prisma/schema.prisma`
- Modify: `packages/jobs/src/types.ts`

- [ ] **Step 1: Stop dev server (frees Prisma DLL on Windows)**

```bash
# In a separate shell, kill any process holding port 3000:
# Windows: in PowerShell run `Get-NetTCPConnection -LocalPort 3000` and `Stop-Process -Id <PID>`
```

- [ ] **Step 2: Update `packages/jobs/src/types.ts` WebhookEvent enum**

Replace lines 21-28:

```ts
export type WebhookEvent =
  | "lead_novo"
  | "lead_acessou"
  | "lead_viu_oferta"
  | "lead_clicou_oferta"
  | "lead_viu_pitch"
  | "lead_permaneceu"
  | "lead_saiu"
  | "lead_entrou_sorteio";
```

- [ ] **Step 3: Update `packages/db/prisma/schema.prisma`**

(a) In `enum EventKind`, rename two values:

```prisma
enum EventKind {
  OPTIN
  PAGE_VIEW
  VIDEO_START
  VIDEO_TICK
  VIDEO_END
  OFFER_VIEW
  OFFER_CLICK
  PITCH_REACHED
  RAFFLE_ENTRY
}
```

(b) DELETE `model Cta { ... }` (lines ~243-254) entirely.

(c) DELETE `model CtaView { ... }` (lines ~334-343) entirely.

(d) In `model Webinar`, REMOVE `ctas Cta[]` relation. REMOVE `webhookOnCtaView` and `webhookOnCtaClick` columns. ADD these new columns (group near other webhook flags + after `pitchAtSec`):

```prisma
  // Offer (sub-plan D2)
  offerName            String   @default("")
  offerTitle           String   @default("")
  offerPriceOriginal   String?
  offerPriceFinal      String?
  offerButtonText      String   @default("Quero aproveitar")
  offerButtonColor     String   @default("#dc2626")
  offerImageDesktopUrl String?
  offerImageMobileUrl  String?
  offerShowAtSec       Int?
  offerHideAtSec       Int?
  offerLink            String?
  offerPassUtms        Boolean  @default(false)
  offerDisabled        Boolean  @default(false)
  offerSameWindow      Boolean  @default(false)
  offerRaffleEnabled   Boolean  @default(false)
  webhookOnOfferView   Boolean  @default(false)
  webhookOnOfferClick  Boolean  @default(false)
  webhookOnRaffleEntry Boolean  @default(false)
```

(e) In `model Lead`, REMOVE `ctaViews CtaView[]`. ADD UTM columns:

```prisma
  utmSource    String?
  utmMedium    String?
  utmCampaign  String?
  utmTerm      String?
  utmContent   String?
```

- [ ] **Step 4: Create the migration SQL**

Create folder `packages/db/prisma/migrations/20260505180000_d2_offer_rebuild/` and file `migration.sql`:

```sql
-- 1. Drop legacy CTA tables (cascade drops indexes/relations)
DROP TABLE IF EXISTS "cta_view" CASCADE;
DROP TABLE IF EXISTS "cta" CASCADE;

-- 2. Drop legacy webhook flags
ALTER TABLE "webinar"
  DROP COLUMN IF EXISTS "webhookOnCtaView",
  DROP COLUMN IF EXISTS "webhookOnCtaClick";

-- 3. Rename EventKind values (preserves existing event rows)
ALTER TYPE "EventKind" RENAME VALUE 'CTA_VIEW' TO 'OFFER_VIEW';
ALTER TYPE "EventKind" RENAME VALUE 'CTA_CLICK' TO 'OFFER_CLICK';
ALTER TYPE "EventKind" ADD VALUE 'RAFFLE_ENTRY';

-- 4. Add offer columns to webinar
ALTER TABLE "webinar"
  ADD COLUMN "offerName" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "offerTitle" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "offerPriceOriginal" TEXT,
  ADD COLUMN "offerPriceFinal" TEXT,
  ADD COLUMN "offerButtonText" TEXT NOT NULL DEFAULT 'Quero aproveitar',
  ADD COLUMN "offerButtonColor" TEXT NOT NULL DEFAULT '#dc2626',
  ADD COLUMN "offerImageDesktopUrl" TEXT,
  ADD COLUMN "offerImageMobileUrl" TEXT,
  ADD COLUMN "offerShowAtSec" INTEGER,
  ADD COLUMN "offerHideAtSec" INTEGER,
  ADD COLUMN "offerLink" TEXT,
  ADD COLUMN "offerPassUtms" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "offerDisabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "offerSameWindow" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "offerRaffleEnabled" BOOLEAN NOT NULL DEFAULT false;

-- 5. Add new webhook flag columns
ALTER TABLE "webinar"
  ADD COLUMN "webhookOnOfferView" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "webhookOnOfferClick" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "webhookOnRaffleEntry" BOOLEAN NOT NULL DEFAULT false;

-- 6. Add UTM columns to lead
ALTER TABLE "lead"
  ADD COLUMN "utmSource" TEXT,
  ADD COLUMN "utmMedium" TEXT,
  ADD COLUMN "utmCampaign" TEXT,
  ADD COLUMN "utmTerm" TEXT,
  ADD COLUMN "utmContent" TEXT;
```

- [ ] **Step 5: Apply migration + regenerate client**

```bash
pnpm --filter db prisma migrate dev --name d2_offer_rebuild
pnpm --filter db prisma generate
```

Expected: "Migration applied" + Prisma client regenerated.

- [ ] **Step 6: Verify**

```bash
pnpm --filter db prisma format
pnpm -r typecheck 2>&1 | head -50
```

Note: typecheck WILL fail in many places that still reference `Cta`/`CtaView`/`webhookOnCtaView`/etc. That's expected — later tasks fix each call site. Verify only that the schema itself is well-formed (Prisma format succeeds + Prisma client emits TS without errors in `node_modules/.prisma/client/index.d.ts`).

- [ ] **Step 7: Commit**

```bash
git add packages/db/prisma/schema.prisma packages/db/prisma/migrations/20260505180000_d2_offer_rebuild packages/jobs/src/types.ts
git commit -m "feat(db): D2 schema — drop CTA model, embed offer fields, add raffle event"
```

---

### Task 2: Validation schemas

**Files:**
- Modify: `apps/web/src/lib/validations/webinar.ts`
- Create: `apps/web/src/test/lib/validations/step5.test.ts`
- Modify: `apps/web/src/test/lib/validations/integrations.test.ts`

- [ ] **Step 1: Write failing test `step5.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { step5Schema } from "@/lib/validations/webinar";

const VALID = {
  offerName: "Curso A",
  offerTitle: "Domine Y",
  offerPriceOriginal: "R$2.997",
  offerPriceFinal: "12x de R$153.44",
  offerButtonText: "Quero",
  offerButtonColor: "#dc2626",
  offerImageDesktopUrl: "https://cdn.example.com/d.png",
  offerImageMobileUrl: "https://cdn.example.com/m.png",
  pitchAtSec: 600,
  offerShowAtSec: 700,
  offerHideAtSec: 1800,
  offerLink: "https://buy.example.com/x",
  offerPassUtms: false,
  offerDisabled: false,
  offerSameWindow: false,
  offerRaffleEnabled: false
};

describe("step5Schema", () => {
  it("accepts a fully-populated valid offer", () => {
    expect(step5Schema.safeParse(VALID).success).toBe(true);
  });
  it("rejects empty offerName", () => {
    const r = step5Schema.safeParse({ ...VALID, offerName: "" });
    expect(r.success).toBe(false);
  });
  it("rejects empty offerButtonText", () => {
    expect(step5Schema.safeParse({ ...VALID, offerButtonText: "" }).success).toBe(false);
  });
  it("rejects invalid hex color", () => {
    expect(step5Schema.safeParse({ ...VALID, offerButtonColor: "red" }).success).toBe(false);
    expect(step5Schema.safeParse({ ...VALID, offerButtonColor: "#zzzzzz" }).success).toBe(false);
  });
  it("rejects offerHideAtSec < offerShowAtSec", () => {
    const r = step5Schema.safeParse({ ...VALID, offerShowAtSec: 100, offerHideAtSec: 50 });
    expect(r.success).toBe(false);
  });
  it("accepts when both show/hide are null", () => {
    const r = step5Schema.safeParse({ ...VALID, offerShowAtSec: null, offerHideAtSec: null });
    expect(r.success).toBe(true);
  });
  it("rejects invalid offerLink URL", () => {
    expect(step5Schema.safeParse({ ...VALID, offerLink: "not-a-url" }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

```bash
pnpm --filter web vitest run src/test/lib/validations/step5.test.ts
```

Expected: FAIL — `step5Schema` shape mismatch (still old CTA array).

- [ ] **Step 3: Replace step5Schema in `validations/webinar.ts`**

Delete lines 88-97 (`ctaItemSchema`, `step5Schema`, `Step5Input`, `CtaItem` exports). Replace with:

```ts
export const step5Schema = z.object({
  offerName: z.string().min(1, "Nome obrigatório").max(100),
  offerTitle: z.string().min(1, "Título obrigatório").max(120),
  offerPriceOriginal: z.string().max(50).optional().nullable(),
  offerPriceFinal: z.string().max(50).optional().nullable(),
  offerButtonText: z.string().min(1).max(50),
  offerButtonColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Cor hex inválida"),
  offerImageDesktopUrl: z.string().url().optional().nullable(),
  offerImageMobileUrl: z.string().url().optional().nullable(),
  pitchAtSec: z.number().int().min(0).optional().nullable(),
  offerShowAtSec: z.number().int().min(0).optional().nullable(),
  offerHideAtSec: z.number().int().min(0).optional().nullable(),
  offerLink: z.string().url().optional().nullable().or(z.literal("")),
  offerPassUtms: z.boolean(),
  offerDisabled: z.boolean(),
  offerSameWindow: z.boolean(),
  offerRaffleEnabled: z.boolean()
}).refine(
  (d) => d.offerHideAtSec == null || d.offerShowAtSec == null || d.offerHideAtSec >= d.offerShowAtSec,
  { message: "Tempo fim deve ser ≥ tempo início", path: ["offerHideAtSec"] }
);
export type Step5Input = z.infer<typeof step5Schema>;
```

Also update `integrationsSchema` (lines 110-120). Replace `webhookOnCtaView` and `webhookOnCtaClick` with `webhookOnOfferView`, `webhookOnOfferClick`, `webhookOnRaffleEntry`:

```ts
export const integrationsSchema = z.object({
  webhookUrl: z.string().url("URL inválida").or(z.literal("")).optional(),
  webhookOnOptin: z.boolean(),
  webhookOnEnter: z.boolean(),
  webhookOnOfferView: z.boolean(),
  webhookOnOfferClick: z.boolean(),
  webhookOnRaffleEntry: z.boolean(),
  webhookOnPitchReached: z.boolean(),
  webhookOnPermanence: z.boolean(),
  webhookOnLeave: z.boolean(),
  permanenceThresholdSec: z.number().int().min(1).max(86_400)
});
export type IntegrationsInput = z.infer<typeof integrationsSchema>;
```

- [ ] **Step 4: Update `integrations.test.ts`**

Read existing fixtures and replace `webhookOnCtaView`/`webhookOnCtaClick` everywhere with `webhookOnOfferView`/`webhookOnOfferClick`. Add `webhookOnRaffleEntry: false` to every `IntegrationsInput` fixture object.

- [ ] **Step 5: Run both tests**

```bash
pnpm --filter web vitest run src/test/lib/validations/step5.test.ts src/test/lib/validations/integrations.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/validations/webinar.ts apps/web/src/test/lib/validations/step5.test.ts apps/web/src/test/lib/validations/integrations.test.ts
git commit -m "feat(web): D2 step5Schema rewrite + integrations rename CTA->Offer+raffle"
```

---

### Task 3: Webhook flag mapping

**Files:**
- Modify: `apps/web/src/lib/webhook.ts`

- [ ] **Step 1: Update `FLAG_BY_EVENT` and types**

Replace lines 6-14 of `apps/web/src/lib/webhook.ts`:

```ts
const FLAG_BY_EVENT: Record<WebhookEvent, keyof Webinar> = {
  lead_novo: "webhookOnOptin",
  lead_acessou: "webhookOnEnter",
  lead_viu_oferta: "webhookOnOfferView",
  lead_clicou_oferta: "webhookOnOfferClick",
  lead_viu_pitch: "webhookOnPitchReached",
  lead_permaneceu: "webhookOnPermanence",
  lead_saiu: "webhookOnLeave",
  lead_entrou_sorteio: "webhookOnRaffleEntry"
};
```

- [ ] **Step 2: Verify typecheck for this file**

```bash
pnpm --filter web tsc --noEmit src/lib/webhook.ts 2>&1 | head -10
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/webhook.ts
git commit -m "feat(web): map new offer/raffle webhook events to renamed flag columns"
```

---

### Task 4: PublicWebinar DTO + UTM helper

**Files:**
- Modify: `apps/web/src/lib/public-dto.ts`
- Create: `apps/web/src/test/lib/public-dto.test.ts` (extend existing if present, otherwise new entries)

- [ ] **Step 1: Write failing test**

If `apps/web/src/test/lib/public-dto.test.ts` exists, add a new `describe("publicWebinarDto offer fields", ...)`. Otherwise create the file with just this case:

```ts
import { describe, it, expect } from "vitest";
import { publicWebinarDto } from "@/lib/public-dto";

describe("publicWebinarDto offer fields", () => {
  it("returns all 15 offer fields from Webinar", () => {
    const w: any = {
      id: "w1", slug: "x", title: "T", name: "N", mode: "UNICO",
      startDate: null, endDate: null, timezone: "America/Sao_Paulo",
      waitingTitle: "", waitingSubtitle: "", waitingShowThumb: false,
      logoUrl: null, primaryColor: null,
      loginButtonText: "", loginButtonColor: "#000000",
      nameEnabled: true, nameRequired: true, namePlaceholder: "",
      emailEnabled: true, emailRequired: true, emailPlaceholder: "",
      phoneEnabled: false, phoneRequired: false, phonePlaceholder: "",
      pitchAtSec: 600, waitingTemplate: "DEFAULT", loginLogoAlign: "CENTER",
      progressEnabled: false, progressStartPct: 50, progressBarColor: "#000",
      progressTextColor: "#fff", progressText: "", formFieldOrder: ["name","email","phone"],
      offerName: "X", offerTitle: "Y",
      offerPriceOriginal: "R$10", offerPriceFinal: "R$5",
      offerButtonText: "Q", offerButtonColor: "#dc2626",
      offerImageDesktopUrl: "https://cdn.example.com/d.png",
      offerImageMobileUrl: "https://cdn.example.com/m.png",
      offerShowAtSec: 100, offerHideAtSec: 200,
      offerLink: "https://buy.example.com",
      offerPassUtms: true, offerDisabled: false,
      offerSameWindow: true, offerRaffleEnabled: true
    };
    const dto = publicWebinarDto(w);
    expect(dto.offerName).toBe("X");
    expect(dto.offerButtonColor).toBe("#dc2626");
    expect(dto.offerShowAtSec).toBe(100);
    expect(dto.offerPassUtms).toBe(true);
    expect(dto.offerRaffleEnabled).toBe(true);
    expect(dto.offerImageDesktopUrl).toBe("https://cdn.example.com/d.png");
  });
});
```

- [ ] **Step 2: Run test, verify failure**

```bash
pnpm --filter web vitest run src/test/lib/public-dto.test.ts
```

Expected: FAIL — `dto.offerName` is `undefined`.

- [ ] **Step 3: Update `apps/web/src/lib/public-dto.ts`**

Add 15 offer fields to `PublicWebinar` type and `publicWebinarDto`:

```ts
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
  waitingShowThumb: boolean;
  logoUrl: string | null;
  primaryColor: string | null;
  loginButtonText: string;
  loginButtonColor: string;
  nameEnabled: boolean; nameRequired: boolean; namePlaceholder: string;
  emailEnabled: boolean; emailRequired: boolean; emailPlaceholder: string;
  phoneEnabled: boolean; phoneRequired: boolean; phonePlaceholder: string;
  pitchAtSec: number | null;
  waitingTemplate: "DEFAULT" | "WITH_THUMB" | "IMMERSIVE" | "MINIMAL" | "FEATURES";
  loginLogoAlign: "LEFT" | "CENTER" | "RIGHT";
  progressEnabled: boolean;
  progressStartPct: number;
  progressBarColor: string;
  progressTextColor: string;
  progressText: string;
  formFieldOrder: ReadonlyArray<"name" | "email" | "phone">;
  offerName: string;
  offerTitle: string;
  offerPriceOriginal: string | null;
  offerPriceFinal: string | null;
  offerButtonText: string;
  offerButtonColor: string;
  offerImageDesktopUrl: string | null;
  offerImageMobileUrl: string | null;
  offerShowAtSec: number | null;
  offerHideAtSec: number | null;
  offerLink: string | null;
  offerPassUtms: boolean;
  offerDisabled: boolean;
  offerSameWindow: boolean;
  offerRaffleEnabled: boolean;
};

export function publicWebinarDto(w: Webinar): PublicWebinar {
  return {
    id: w.id, slug: w.slug, title: w.title, name: w.name, mode: w.mode,
    startDate: w.startDate, endDate: w.endDate, timezone: w.timezone,
    waitingTitle: w.waitingTitle, waitingSubtitle: w.waitingSubtitle,
    waitingShowThumb: w.waitingShowThumb,
    logoUrl: w.logoUrl, primaryColor: w.primaryColor,
    loginButtonText: w.loginButtonText, loginButtonColor: w.loginButtonColor,
    nameEnabled: w.nameEnabled, nameRequired: w.nameRequired, namePlaceholder: w.namePlaceholder,
    emailEnabled: w.emailEnabled, emailRequired: w.emailRequired, emailPlaceholder: w.emailPlaceholder,
    phoneEnabled: w.phoneEnabled, phoneRequired: w.phoneRequired, phonePlaceholder: w.phonePlaceholder,
    pitchAtSec: w.pitchAtSec,
    waitingTemplate: w.waitingTemplate,
    loginLogoAlign: w.loginLogoAlign,
    progressEnabled: w.progressEnabled,
    progressStartPct: w.progressStartPct,
    progressBarColor: w.progressBarColor,
    progressTextColor: w.progressTextColor,
    progressText: w.progressText,
    formFieldOrder: w.formFieldOrder as ReadonlyArray<"name" | "email" | "phone">,
    offerName: w.offerName,
    offerTitle: w.offerTitle,
    offerPriceOriginal: w.offerPriceOriginal,
    offerPriceFinal: w.offerPriceFinal,
    offerButtonText: w.offerButtonText,
    offerButtonColor: w.offerButtonColor,
    offerImageDesktopUrl: w.offerImageDesktopUrl,
    offerImageMobileUrl: w.offerImageMobileUrl,
    offerShowAtSec: w.offerShowAtSec,
    offerHideAtSec: w.offerHideAtSec,
    offerLink: w.offerLink,
    offerPassUtms: w.offerPassUtms,
    offerDisabled: w.offerDisabled,
    offerSameWindow: w.offerSameWindow,
    offerRaffleEnabled: w.offerRaffleEnabled
  };
}
```

Also add a UTM-bearing lead helper at the bottom of the file:

```ts
export type PublicLeadWithUtms = {
  id: string;
  name: string;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmTerm: string | null;
  utmContent: string | null;
};

export function publicLeadWithUtmsDto(l: Lead): PublicLeadWithUtms {
  return {
    id: l.id,
    name: l.name,
    utmSource: l.utmSource,
    utmMedium: l.utmMedium,
    utmCampaign: l.utmCampaign,
    utmTerm: l.utmTerm,
    utmContent: l.utmContent
  };
}
```

- [ ] **Step 4: Run test**

```bash
pnpm --filter web vitest run src/test/lib/public-dto.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/public-dto.ts apps/web/src/test/lib/public-dto.test.ts
git commit -m "feat(web): expose offer fields + UTM-aware lead DTO in public-dto"
```

---

### Task 5: ColorPickerField component

**Files:**
- Create: `apps/web/src/components/wizard/color-picker-field.tsx`
- Create: `apps/web/src/test/components/color-picker-field.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ColorPickerField } from "@/components/wizard/color-picker-field";

describe("ColorPickerField", () => {
  it("renders the swatch with the given color and the hex label", () => {
    render(<ColorPickerField id="c1" value="#dc2626" onChange={() => {}} aria-label="Cor" />);
    const swatch = screen.getByLabelText("Cor") as HTMLInputElement;
    expect(swatch.value).toBe("#dc2626");
    expect(screen.getByText("#dc2626")).toBeInTheDocument();
  });
  it("calls onChange when the input changes", () => {
    const onChange = vi.fn();
    render(<ColorPickerField id="c2" value="#000000" onChange={onChange} aria-label="Cor" />);
    fireEvent.change(screen.getByLabelText("Cor"), { target: { value: "#16a34a" } });
    expect(onChange).toHaveBeenCalledWith("#16a34a");
  });
});
```

- [ ] **Step 2: Run, verify failure**

```bash
pnpm --filter web vitest run src/test/components/color-picker-field.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `color-picker-field.tsx`**

```tsx
"use client";

interface ColorPickerFieldProps {
  id?: string;
  value: string;
  onChange: (next: string) => void;
  "aria-label"?: string;
}

export function ColorPickerField({ id, value, onChange, "aria-label": ariaLabel }: ColorPickerFieldProps) {
  return (
    <label className="inline-flex items-center gap-2">
      <span
        className="inline-block h-6 w-6 rounded-full border shadow"
        style={{ backgroundColor: value }}
        aria-hidden
      />
      <input
        id={id}
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={ariaLabel}
        className="sr-only"
      />
      <span className="font-mono text-xs text-muted-foreground">{value}</span>
    </label>
  );
}
```

- [ ] **Step 4: Run test**

```bash
pnpm --filter web vitest run src/test/components/color-picker-field.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/wizard/color-picker-field.tsx apps/web/src/test/components/color-picker-field.test.tsx
git commit -m "feat(web): ColorPickerField component (native picker + swatch + hex label)"
```

---

### Task 6: ImageUploadField component

**Files:**
- Create: `apps/web/src/components/wizard/image-upload-field.tsx`
- Create: `apps/web/src/test/components/image-upload-field.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ImageUploadField } from "@/components/wizard/image-upload-field";

describe("ImageUploadField", () => {
  it("shows the recommended hint when no value is set", () => {
    render(
      <ImageUploadField
        webinarId="w1"
        kind="mobile"
        value={null}
        onChange={() => {}}
        recommendedHint="384×110 px"
      />
    );
    expect(screen.getByText(/384×110 px/)).toBeInTheDocument();
  });
  it("renders preview thumb + delete button when value is set", () => {
    const onChange = vi.fn();
    render(
      <ImageUploadField
        webinarId="w1"
        kind="desktop"
        value="https://cdn.example.com/x.png"
        onChange={onChange}
      />
    );
    expect(screen.getByRole("img")).toHaveAttribute("src", "https://cdn.example.com/x.png");
    fireEvent.click(screen.getByRole("button", { name: /excluir/i }));
    expect(onChange).toHaveBeenCalledWith(null);
  });
  it("uploads via presign endpoint and calls onChange with publicUrl", async () => {
    const onChange = vi.fn();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ uploadUrl: "https://put.example/up", publicUrl: "https://cdn.example.com/desktop.png", key: "offer/w1/desktop.png" })
      })
      .mockResolvedValueOnce({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    render(
      <ImageUploadField webinarId="w1" kind="desktop" value={null} onChange={onChange} />
    );
    const file = new File(["x"], "test.png", { type: "image/png" });
    const input = screen.getByLabelText(/imagem/i) as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(onChange).toHaveBeenCalledWith("https://cdn.example.com/desktop.png"));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    vi.unstubAllGlobals();
  });
});
```

- [ ] **Step 2: Run, verify failure**

```bash
pnpm --filter web vitest run src/test/components/image-upload-field.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `image-upload-field.tsx`**

```tsx
"use client";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Trash2, Upload } from "lucide-react";

interface Props {
  webinarId: string;
  kind: "desktop" | "mobile";
  value: string | null;
  onChange: (next: string | null) => void;
  recommendedHint?: string;
}

export function ImageUploadField({ webinarId, kind, value, onChange, recommendedHint }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File) {
    setUploading(true);
    try {
      const presignRes = await fetch("/api/upload/offer-image", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ webinarId, kind, mimeType: file.type, sizeBytes: file.size })
      });
      if (!presignRes.ok) {
        const err = await presignRes.json().catch(() => ({}));
        toast.error(err.message ?? "Falha ao iniciar upload");
        return;
      }
      const { uploadUrl, publicUrl } = await presignRes.json();
      const putRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "content-type": file.type },
        body: file
      });
      if (!putRes.ok) {
        toast.error("Falha ao enviar imagem");
        return;
      }
      onChange(publicUrl);
      toast.success("Imagem enviada");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  if (value) {
    return (
      <div className="space-y-2">
        <img src={value} alt="" className="aspect-video w-full max-w-md rounded-lg border object-cover" />
        <Button type="button" variant="destructive" size="sm" onClick={() => onChange(null)}>
          <Trash2 className="mr-2 h-4 w-4" /> Excluir imagem
        </Button>
      </div>
    );
  }

  return (
    <label className="flex w-full cursor-pointer flex-col items-center gap-2 rounded-md border border-dashed bg-muted/30 px-6 py-8 text-center text-sm hover:bg-muted/50">
      <Upload className="h-6 w-6 opacity-60" />
      <span className="font-medium">Clique para selecionar.</span>
      {recommendedHint ? (
        <span className="text-xs text-muted-foreground">As dimensões recomendadas são {recommendedHint}</span>
      ) : null}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        aria-label={`Imagem ${kind === "desktop" ? "desktop" : "mobile"}`}
        className="sr-only"
        disabled={uploading}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
        }}
      />
    </label>
  );
}
```

- [ ] **Step 4: Run test**

```bash
pnpm --filter web vitest run src/test/components/image-upload-field.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/wizard/image-upload-field.tsx apps/web/src/test/components/image-upload-field.test.tsx
git commit -m "feat(web): ImageUploadField component for offer image presigned upload"
```

---

### Task 7: /api/upload/offer-image route

**Files:**
- Create: `apps/web/src/app/api/upload/offer-image/route.ts`
- Create: `apps/web/src/test/api/upload-offer-image.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { prisma } from "db";

const TEST_USER = { id: "uo-user", email: "uo@example.com", name: "UO" };

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: async () => ({ user: { id: TEST_USER.id } }) } }
}));
vi.mock("@/lib/storage/presign", () => ({
  presignPut: vi.fn(async () => "https://put.example/upload-url")
}));
vi.mock("@/lib/storage/buckets", () => ({ HLS_BUCKET: "hls-public" }));

beforeEach(async () => {
  process.env.S3_PUBLIC_BASE_URL = "http://localhost:9000";
  await prisma.webinar.deleteMany({});
  await prisma.session.deleteMany({});
  await prisma.account.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.user.create({ data: TEST_USER });
});

afterAll(async () => prisma.$disconnect());

async function makeWebinar(ownerId = TEST_USER.id) {
  return prisma.webinar.create({
    data: { ownerId, name: "T", title: "T", slug: "uo-" + Math.random().toString(36).slice(2, 6) }
  });
}

describe("POST /api/upload/offer-image", () => {
  it("returns presigned URL + public URL with the expected key", async () => {
    const w = await makeWebinar();
    const { POST } = await import("@/app/api/upload/offer-image/route");
    const res = await POST(new Request("http://localhost/api/upload/offer-image", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ webinarId: w.id, kind: "desktop", mimeType: "image/png", sizeBytes: 1024 })
    }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.uploadUrl).toBe("https://put.example/upload-url");
    expect(json.key).toBe(`offer/${w.id}/desktop.png`);
    expect(json.publicUrl).toBe(`http://localhost:9000/hls-public/offer/${w.id}/desktop.png`);
  });
  it("rejects non-allowlisted MIME types", async () => {
    const w = await makeWebinar();
    const { POST } = await import("@/app/api/upload/offer-image/route?" + Date.now());
    const res = await POST(new Request("http://localhost/api/upload/offer-image", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ webinarId: w.id, kind: "desktop", mimeType: "image/svg+xml", sizeBytes: 1024 })
    }));
    expect(res.status).toBe(400);
  });
  it("rejects sizes above 2 MiB", async () => {
    const w = await makeWebinar();
    const { POST } = await import("@/app/api/upload/offer-image/route?" + (Date.now() + 1));
    const res = await POST(new Request("http://localhost/api/upload/offer-image", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ webinarId: w.id, kind: "mobile", mimeType: "image/jpeg", sizeBytes: 3 * 1024 * 1024 })
    }));
    expect(res.status).toBe(413);
  });
  it("rejects when webinar belongs to another user", async () => {
    await prisma.user.create({ data: { id: "other", email: "o@e.com", name: "O" } });
    const w = await makeWebinar("other");
    const { POST } = await import("@/app/api/upload/offer-image/route?" + (Date.now() + 2));
    const res = await POST(new Request("http://localhost/api/upload/offer-image", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ webinarId: w.id, kind: "desktop", mimeType: "image/png", sizeBytes: 1024 })
    }));
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run, verify failure**

```bash
pnpm --filter web vitest run src/test/api/upload-offer-image.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `route.ts`**

```ts
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "db";
import { presignPut } from "@/lib/storage/presign";
import { HLS_BUCKET } from "@/lib/storage/buckets";

const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"] as const;
const MAX_BYTES = 2 * 1024 * 1024;

const inputSchema = z.object({
  webinarId: z.string().min(1),
  kind: z.enum(["desktop", "mobile"]),
  mimeType: z.string(),
  sizeBytes: z.number().int().positive()
});

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
};

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as unknown;
  const parsed = inputSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  const { webinarId, kind, mimeType, sizeBytes } = parsed.data;

  if (!(ALLOWED_MIME as readonly string[]).includes(mimeType)) {
    return NextResponse.json(
      { error: "invalid_mime", message: `MIME inválido. Use ${ALLOWED_MIME.join(", ")}` },
      { status: 400 }
    );
  }
  if (sizeBytes > MAX_BYTES) {
    return NextResponse.json(
      { error: "too_large", maxBytes: MAX_BYTES, message: "Imagem deve ter até 2 MiB" },
      { status: 413 }
    );
  }

  const webinar = await prisma.webinar.findUnique({ where: { id: webinarId } });
  if (!webinar || webinar.ownerId !== session.user.id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const ext = EXT_BY_MIME[mimeType];
  const key = `offer/${webinarId}/${kind}.${ext}`;
  const uploadUrl = await presignPut(HLS_BUCKET, key, mimeType, 15 * 60);
  const publicBase = process.env.S3_PUBLIC_BASE_URL ?? "";
  const publicUrl = `${publicBase}/${HLS_BUCKET}/${key}`;
  return NextResponse.json({ uploadUrl, publicUrl, key });
}
```

- [ ] **Step 4: Run test**

```bash
pnpm --filter web vitest run src/test/api/upload-offer-image.test.ts
```

Expected: PASS (4/4).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/upload/offer-image/route.ts apps/web/src/test/api/upload-offer-image.test.ts
git commit -m "feat(web): /api/upload/offer-image presigned PUT for offer images"
```

---

### Task 8: OfferPreview components

**Files:**
- Create: `apps/web/src/components/wizard/offer-preview.tsx`
- Create: `apps/web/src/test/components/offer-preview.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { OfferPreviewDesktop, OfferPreviewMobile } from "@/components/wizard/offer-preview";

const baseOffer = {
  offerName: "X", offerTitle: "Domine Y",
  offerPriceOriginal: "R$2.997", offerPriceFinal: "12x de R$153.44",
  offerButtonText: "QUERO APROVEITAR!",
  offerButtonColor: "#dc2626",
  offerImageDesktopUrl: "https://cdn.example.com/d.png",
  offerImageMobileUrl: "https://cdn.example.com/m.png",
  offerRaffleEnabled: false
};

describe("OfferPreviewDesktop", () => {
  it("renders prices, button text, and applies the button color", () => {
    render(<OfferPreviewDesktop {...baseOffer} />);
    expect(screen.getByText(/De R\$2\.997/)).toBeInTheDocument();
    expect(screen.getByText(/Por 12x de R\$153\.44/)).toBeInTheDocument();
    const btn = screen.getByRole("button", { name: /QUERO APROVEITAR/ });
    expect(btn).toHaveStyle({ backgroundColor: "#dc2626" });
  });
  it("shows raffle badge when raffle enabled", () => {
    render(<OfferPreviewDesktop {...baseOffer} offerRaffleEnabled />);
    expect(screen.getByText(/Sorteio/i)).toBeInTheDocument();
  });
  it("renders a placeholder when desktop image URL is missing", () => {
    render(<OfferPreviewDesktop {...baseOffer} offerImageDesktopUrl={null} />);
    expect(screen.queryByRole("img")).toBeNull();
  });
});

describe("OfferPreviewMobile", () => {
  it("renders compact mobile strip", () => {
    render(<OfferPreviewMobile {...baseOffer} />);
    expect(screen.getByRole("img")).toHaveAttribute("src", "https://cdn.example.com/m.png");
  });
  it("renders a placeholder when mobile image URL is missing", () => {
    render(<OfferPreviewMobile {...baseOffer} offerImageMobileUrl={null} />);
    expect(screen.getByText(/Prévia da oferta para mobile/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run, verify failure**

```bash
pnpm --filter web vitest run src/test/components/offer-preview.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `offer-preview.tsx`**

```tsx
"use client";

export interface OfferPreviewProps {
  offerName?: string;
  offerTitle: string;
  offerPriceOriginal: string | null;
  offerPriceFinal: string | null;
  offerButtonText: string;
  offerButtonColor: string;
  offerImageDesktopUrl: string | null;
  offerImageMobileUrl: string | null;
  offerRaffleEnabled: boolean;
}

export function OfferPreviewDesktop(p: OfferPreviewProps) {
  return (
    <div className="space-y-3 rounded-lg border bg-card p-4 shadow-sm">
      {p.offerImageDesktopUrl ? (
        <img src={p.offerImageDesktopUrl} alt="" className="w-full rounded-md object-cover" />
      ) : null}
      <div className="flex items-end justify-between gap-2 text-sm">
        <div>
          {p.offerPriceOriginal ? (
            <p className="text-muted-foreground line-through">De {p.offerPriceOriginal}</p>
          ) : null}
          {p.offerPriceFinal ? (
            <p className="text-lg font-semibold">Por {p.offerPriceFinal}</p>
          ) : null}
        </div>
        {p.offerRaffleEnabled ? (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
            🎉 Sorteio
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">Por tempo limitado</span>
        )}
      </div>
      <button
        type="button"
        className="w-full rounded-md py-3 text-center text-sm font-semibold text-white shadow"
        style={{ backgroundColor: p.offerButtonColor }}
      >
        {p.offerButtonText}
      </button>
    </div>
  );
}

export function OfferPreviewMobile(p: OfferPreviewProps) {
  return (
    <div className="overflow-hidden rounded-lg border bg-muted/30">
      <p className="border-b px-3 py-2 text-xs text-muted-foreground">Prévia da oferta para mobile</p>
      {p.offerImageMobileUrl ? (
        <img
          src={p.offerImageMobileUrl}
          alt=""
          className="block h-[110px] w-[384px] max-w-full object-cover"
        />
      ) : (
        <div className="flex h-[110px] items-center justify-center text-xs text-muted-foreground">
          384×110 px
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test**

```bash
pnpm --filter web vitest run src/test/components/offer-preview.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/wizard/offer-preview.tsx apps/web/src/test/components/offer-preview.test.tsx
git commit -m "feat(web): OfferPreview desktop+mobile cards with live-update fields"
```

---

### Task 9: Step 5 form rewrite

**Files:**
- Modify: `apps/web/src/components/wizard/step-5-form.tsx` (full replace)

- [ ] **Step 1: Replace the entire file**

```tsx
"use client";
import { useTransition } from "react";
import { useForm, Controller, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { step5Schema, type Step5Input } from "@/lib/validations/webinar";
import { updateWebinarStep5 } from "@/server/actions/webinar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { SecondsInput } from "@/components/ui/seconds-input";
import { ColorPickerField } from "@/components/wizard/color-picker-field";
import { ImageUploadField } from "@/components/wizard/image-upload-field";
import { OfferPreviewDesktop, OfferPreviewMobile } from "@/components/wizard/offer-preview";
import { WizardNav } from "@/components/wizard/wizard-nav";

export interface Step5FormProps {
  webinarId: string;
  initial: Step5Input;
}

export function Step5Form({ webinarId, initial }: Step5FormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const form = useForm<Step5Input>({
    resolver: zodResolver(step5Schema),
    defaultValues: initial
  });
  const { register, handleSubmit, control, formState: { errors } } = form;
  const watched = useWatch({ control });

  function onSubmit(values: Step5Input) {
    startTransition(async () => {
      const res = await updateWebinarStep5(webinarId, values);
      if ("ok" in res) {
        toast.success("Oferta salva");
        router.push(`/dashboard/webinars/${webinarId}/step-6`);
      } else {
        toast.error(res.error.message);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-8 lg:grid-cols-[1fr_minmax(0,420px)]">
      <div className="space-y-6">
        <h2 className="text-2xl font-semibold">Oferta</h2>

        <section className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="offerName">Nome da oferta *</Label>
            <Input id="offerName" {...register("offerName")} />
            {errors.offerName && <p className="text-xs text-destructive">{errors.offerName.message}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="offerTitle">Título da oferta *</Label>
            <Input id="offerTitle" {...register("offerTitle")} />
            {errors.offerTitle && <p className="text-xs text-destructive">{errors.offerTitle.message}</p>}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="offerPriceOriginal">Preço original</Label>
              <Input id="offerPriceOriginal" placeholder="R$2.997" {...register("offerPriceOriginal")} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="offerPriceFinal">Preço da oferta</Label>
              <Input id="offerPriceFinal" placeholder="12x de R$153.44" {...register("offerPriceFinal")} />
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="offerButtonText">Texto do botão *</Label>
            <Input id="offerButtonText" {...register("offerButtonText")} />
            {errors.offerButtonText && <p className="text-xs text-destructive">{errors.offerButtonText.message}</p>}
          </div>
          <div className="space-y-1">
            <Label>Cor do botão</Label>
            <Controller
              control={control}
              name="offerButtonColor"
              render={({ field }) => (
                <ColorPickerField
                  id="offerButtonColor"
                  aria-label="Cor do botão"
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
            {errors.offerButtonColor && <p className="text-xs text-destructive">{errors.offerButtonColor.message}</p>}
          </div>
        </section>

        <section className="space-y-4">
          <div className="space-y-1">
            <Label>Imagem da oferta para desktop *</Label>
            <Controller
              control={control}
              name="offerImageDesktopUrl"
              render={({ field }) => (
                <ImageUploadField
                  webinarId={webinarId}
                  kind="desktop"
                  value={field.value ?? null}
                  onChange={field.onChange}
                />
              )}
            />
          </div>
          <div className="space-y-1">
            <Label>Imagem da oferta para mobile</Label>
            <Controller
              control={control}
              name="offerImageMobileUrl"
              render={({ field }) => (
                <ImageUploadField
                  webinarId={webinarId}
                  kind="mobile"
                  value={field.value ?? null}
                  onChange={field.onChange}
                  recommendedHint="384 pixels de largura e 110 pixels de altura"
                />
              )}
            />
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1">
            <Label>Início da pitch</Label>
            <Controller
              control={control}
              name="pitchAtSec"
              render={({ field }) => (
                <SecondsInput
                  value={field.value ?? 0}
                  onChange={(v) => field.onChange(v === 0 ? null : v)}
                  aria-label="Início da pitch"
                />
              )}
            />
          </div>
          <div className="space-y-1">
            <Label>Tempo início da oferta *</Label>
            <Controller
              control={control}
              name="offerShowAtSec"
              render={({ field }) => (
                <SecondsInput
                  value={field.value ?? 0}
                  onChange={(v) => field.onChange(v)}
                  aria-label="Tempo início da oferta"
                />
              )}
            />
          </div>
          <div className="space-y-1">
            <Label>Tempo do fim da oferta</Label>
            <Controller
              control={control}
              name="offerHideAtSec"
              render={({ field }) => (
                <SecondsInput
                  value={field.value ?? 0}
                  onChange={(v) => field.onChange(v === 0 ? null : v)}
                  aria-label="Tempo do fim da oferta"
                />
              )}
            />
            {errors.offerHideAtSec && <p className="text-xs text-destructive">{errors.offerHideAtSec.message}</p>}
          </div>
        </section>

        <section className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="offerLink">Link da oferta *</Label>
            <Input id="offerLink" {...register("offerLink")} placeholder="https://" />
            {errors.offerLink && <p className="text-xs text-destructive">{errors.offerLink.message}</p>}
          </div>

          {(["offerPassUtms","offerDisabled","offerSameWindow","offerRaffleEnabled"] as const).map((key) => {
            const labels: Record<typeof key, string> = {
              offerPassUtms: "Repassar UTM's pro link da oferta",
              offerDisabled: "Desabilitar oferta",
              offerSameWindow: "Abrir o link na mesma janela do webinar",
              offerRaffleEnabled: "Habilitar sorteio"
            };
            return (
              <Controller
                key={key}
                control={control}
                name={key}
                render={({ field }) => (
                  <label className="flex items-center gap-3">
                    <Switch checked={Boolean(field.value)} onCheckedChange={field.onChange} aria-label={labels[key]} />
                    <span className="text-sm">{labels[key]}</span>
                  </label>
                )}
              />
            );
          })}
        </section>

        <WizardNav webinarId={webinarId} step={5} submitting={pending} />
      </div>

      <aside className="space-y-4 lg:sticky lg:top-6 lg:h-fit">
        <h3 className="text-sm font-medium text-muted-foreground">Prévia da oferta</h3>
        <OfferPreviewDesktop
          offerTitle={watched.offerTitle ?? ""}
          offerPriceOriginal={watched.offerPriceOriginal ?? null}
          offerPriceFinal={watched.offerPriceFinal ?? null}
          offerButtonText={watched.offerButtonText ?? ""}
          offerButtonColor={watched.offerButtonColor ?? "#dc2626"}
          offerImageDesktopUrl={watched.offerImageDesktopUrl ?? null}
          offerImageMobileUrl={watched.offerImageMobileUrl ?? null}
          offerRaffleEnabled={Boolean(watched.offerRaffleEnabled)}
        />
        <OfferPreviewMobile
          offerTitle={watched.offerTitle ?? ""}
          offerPriceOriginal={watched.offerPriceOriginal ?? null}
          offerPriceFinal={watched.offerPriceFinal ?? null}
          offerButtonText={watched.offerButtonText ?? ""}
          offerButtonColor={watched.offerButtonColor ?? "#dc2626"}
          offerImageDesktopUrl={watched.offerImageDesktopUrl ?? null}
          offerImageMobileUrl={watched.offerImageMobileUrl ?? null}
          offerRaffleEnabled={Boolean(watched.offerRaffleEnabled)}
        />
      </aside>
    </form>
  );
}
```

- [ ] **Step 2: Verify file compiles**

```bash
pnpm --filter web tsc --noEmit 2>&1 | grep -E "step-5-form" | head -10
```

Expected: no errors specific to this file (errors elsewhere remain — they're addressed in later tasks).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/wizard/step-5-form.tsx
git commit -m "feat(web): Step5Form rewrite — single offer with live preview"
```

---

### Task 10: updateWebinarStep5 + duplicateWebinar + integrations action

**Files:**
- Modify: `apps/web/src/server/actions/webinar.ts`
- Modify: `apps/web/src/test/server/actions/webinar.test.ts`

- [ ] **Step 1: Update existing test fixtures**

In `apps/web/src/test/server/actions/webinar.test.ts`:

(a) DELETE the entire `describe("updateWebinarStep5 (CTA upsert)", ...)` block (lines ~86-118 in the previous file). It tested the array-based CTA model.

(b) ADD `await prisma.event.deleteMany({});` at top of `beforeEach` (already there) and ensure no longer references `prisma.cta.deleteMany`. If `cta.deleteMany` calls remain in `beforeEach`, remove them — `Cta` model no longer exists.

(c) ADD a new `describe` for the rewritten Step 5 action:

```ts
describe("updateWebinarStep5 (offer)", () => {
  it("persists all 15 offer fields + pitchAtSec", async () => {
    const { createDraftWebinar, updateWebinarStep5 } = await import(
      "@/server/actions/webinar?" + Date.now()
    );
    const { id } = await createDraftWebinar();
    const r = await updateWebinarStep5(id, {
      offerName: "Curso A", offerTitle: "Domine Y",
      offerPriceOriginal: "R$2.997", offerPriceFinal: "12x R$153.44",
      offerButtonText: "QUERO!", offerButtonColor: "#dc2626",
      offerImageDesktopUrl: "https://cdn.example.com/d.png",
      offerImageMobileUrl: null,
      pitchAtSec: 600,
      offerShowAtSec: 700, offerHideAtSec: 1800,
      offerLink: "https://buy.example.com/x",
      offerPassUtms: true, offerDisabled: false,
      offerSameWindow: true, offerRaffleEnabled: false
    });
    expect(r).toEqual({ ok: true });
    const w = await prisma.webinar.findUnique({ where: { id } });
    expect(w).toMatchObject({
      offerName: "Curso A", offerTitle: "Domine Y",
      offerButtonColor: "#dc2626",
      pitchAtSec: 600, offerShowAtSec: 700, offerHideAtSec: 1800,
      offerPassUtms: true, offerSameWindow: true, offerRaffleEnabled: false,
      offerLink: "https://buy.example.com/x"
    });
  });
});
```

(d) UPDATE `describe("duplicateWebinar", ...)` test — drop `expect(dup?.ctas).toHaveLength(1);` line and the `updateWebinarStep5` setup call (its old shape no longer parses). Replace with:

```ts
describe("duplicateWebinar", () => {
  it("creates a DRAFT copy with cloned offer + chat (no CTAs)", async () => {
    const {
      createDraftWebinar,
      updateWebinarStep1,
      updateWebinarStep5,
      updateWebinarStep6,
      duplicateWebinar
    } = await import("@/server/actions/webinar");
    const { id } = await createDraftWebinar();
    await updateWebinarStep1(id, { name: "Orig", title: "Orig", slug: "orig", language: "pt-BR", accessFacilitated: false, videoSyncWithStart: true });
    await updateWebinarStep5(id, {
      offerName: "OF", offerTitle: "OT",
      offerPriceOriginal: null, offerPriceFinal: null,
      offerButtonText: "QUERO!", offerButtonColor: "#dc2626",
      offerImageDesktopUrl: null, offerImageMobileUrl: null,
      pitchAtSec: null, offerShowAtSec: null, offerHideAtSec: null,
      offerLink: "https://x.example.com",
      offerPassUtms: false, offerDisabled: false,
      offerSameWindow: false, offerRaffleEnabled: false
    });
    await updateWebinarStep6(id, {
      messages: [{ authorName: "A", text: "Olá", showAtSec: 0, isOwner: false }]
    });
    const r = await duplicateWebinar(id);
    expect("newId" in r).toBe(true);
    if (!("newId" in r)) return;
    const dup = await prisma.webinar.findUnique({
      where: { id: r.newId },
      include: { chatMessages: true }
    });
    expect(dup?.status).toBe("DRAFT");
    expect(dup?.slug).toBeNull();
    expect(dup?.title).toBe("Orig (cópia)");
    expect(dup?.offerName).toBe("OF");
    expect(dup?.offerLink).toBe("https://x.example.com");
    expect(dup?.chatMessages).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run tests, verify failure**

```bash
pnpm --filter web vitest run src/test/server/actions/webinar.test.ts
```

Expected: FAIL — `updateWebinarStep5` still uses old array shape.

- [ ] **Step 3: Rewrite `updateWebinarStep5` in `server/actions/webinar.ts`**

Replace the existing function (lines 217-252):

```ts
export async function updateWebinarStep5(id: string, input: Step5Input): Promise<Result> {
  const session = await requireSession();
  const owned = await loadOwned(id, session.user.id);
  if (!owned) return notFound();
  const parsed = step5Schema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: { field: issue.path.join("."), message: issue.message } };
  }
  const d = parsed.data;
  await prisma.webinar.update({
    where: { id },
    data: {
      offerName: d.offerName,
      offerTitle: d.offerTitle,
      offerPriceOriginal: d.offerPriceOriginal ?? null,
      offerPriceFinal: d.offerPriceFinal ?? null,
      offerButtonText: d.offerButtonText,
      offerButtonColor: d.offerButtonColor,
      offerImageDesktopUrl: d.offerImageDesktopUrl ?? null,
      offerImageMobileUrl: d.offerImageMobileUrl ?? null,
      pitchAtSec: d.pitchAtSec ?? null,
      offerShowAtSec: d.offerShowAtSec ?? null,
      offerHideAtSec: d.offerHideAtSec ?? null,
      offerLink: d.offerLink || null,
      offerPassUtms: d.offerPassUtms,
      offerDisabled: d.offerDisabled,
      offerSameWindow: d.offerSameWindow,
      offerRaffleEnabled: d.offerRaffleEnabled
    }
  });
  revalidatePath(`/dashboard/webinars/${id}`);
  return { ok: true };
}
```

- [ ] **Step 4: Update `duplicateWebinar`**

In the same file, replace the `prisma.cta.findMany`/`prisma.cta.createMany` block (lines ~329, 362-372). The new function:

```ts
export async function duplicateWebinar(id: string): Promise<{ newId: string } | { error: { message: string } }> {
  const session = await requireSession();
  const src = await loadOwned(id, session.user.id);
  if (!src) return { error: { message: "Webinar não encontrado" } };

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
      offerName: src.offerName,
      offerTitle: src.offerTitle,
      offerPriceOriginal: src.offerPriceOriginal,
      offerPriceFinal: src.offerPriceFinal,
      offerButtonText: src.offerButtonText,
      offerButtonColor: src.offerButtonColor,
      offerImageDesktopUrl: src.offerImageDesktopUrl,
      offerImageMobileUrl: src.offerImageMobileUrl,
      offerShowAtSec: src.offerShowAtSec,
      offerHideAtSec: src.offerHideAtSec,
      offerLink: src.offerLink,
      offerPassUtms: src.offerPassUtms,
      offerDisabled: src.offerDisabled,
      offerSameWindow: src.offerSameWindow,
      offerRaffleEnabled: src.offerRaffleEnabled,
      status: "DRAFT"
    }
  });

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

- [ ] **Step 5: Update `updateWebinarIntegrations`**

In the same file, replace the integration `data:` block (lines ~398-410):

```ts
  await prisma.webinar.update({
    where: { id },
    data: {
      webhookUrl: parsed.data.webhookUrl || null,
      webhookOnOptin: parsed.data.webhookOnOptin,
      webhookOnEnter: parsed.data.webhookOnEnter,
      webhookOnOfferView: parsed.data.webhookOnOfferView,
      webhookOnOfferClick: parsed.data.webhookOnOfferClick,
      webhookOnRaffleEntry: parsed.data.webhookOnRaffleEntry,
      webhookOnPitchReached: parsed.data.webhookOnPitchReached,
      webhookOnPermanence: parsed.data.webhookOnPermanence,
      webhookOnLeave: parsed.data.webhookOnLeave,
      permanenceThresholdSec: parsed.data.permanenceThresholdSec
    }
  });
```

- [ ] **Step 6: Run tests**

```bash
pnpm --filter web vitest run src/test/server/actions/webinar.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/server/actions/webinar.ts apps/web/src/test/server/actions/webinar.test.ts
git commit -m "feat(web): D2 server actions — updateWebinarStep5 single offer + duplicate + integrations rename"
```

---

### Task 11: Step 5 page query

**Files:**
- Modify: `apps/web/src/app/dashboard/webinars/[id]/(wizard)/step-5/page.tsx`

- [ ] **Step 1: Replace the page**

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
  const w = await prisma.webinar.findUnique({ where: { id } });
  if (!w || w.ownerId !== session.user.id) notFound();

  return (
    <Step5Form
      webinarId={id}
      initial={{
        offerName: w.offerName,
        offerTitle: w.offerTitle,
        offerPriceOriginal: w.offerPriceOriginal,
        offerPriceFinal: w.offerPriceFinal,
        offerButtonText: w.offerButtonText,
        offerButtonColor: w.offerButtonColor,
        offerImageDesktopUrl: w.offerImageDesktopUrl,
        offerImageMobileUrl: w.offerImageMobileUrl,
        pitchAtSec: w.pitchAtSec,
        offerShowAtSec: w.offerShowAtSec,
        offerHideAtSec: w.offerHideAtSec,
        offerLink: w.offerLink,
        offerPassUtms: w.offerPassUtms,
        offerDisabled: w.offerDisabled,
        offerSameWindow: w.offerSameWindow,
        offerRaffleEnabled: w.offerRaffleEnabled
      }}
    />
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/dashboard/webinars/\[id\]/\(wizard\)/step-5/page.tsx
git commit -m "feat(web): step-5 page reads offer cols from Webinar"
```

---

### Task 12: PlayerOffer types + offer-banner

**Files:**
- Modify: `apps/web/src/app/[slug]/_lib/public-types.ts`
- Create: `apps/web/src/app/[slug]/_components/offer-banner.tsx`
- Delete: `apps/web/src/app/[slug]/_components/cta-banner.tsx`
- Create: `apps/web/src/test/components/offer-banner.test.tsx`

- [ ] **Step 1: Replace `public-types.ts`**

```ts
import type { PublicLead, PublicVideo, PublicWebinar, PublicLeadWithUtms } from "@/lib/public-dto";

export interface PlayerOffer {
  name: string;
  title: string;
  priceOriginal: string | null;
  priceFinal: string | null;
  buttonText: string;
  buttonColor: string;
  imageDesktopUrl: string | null;
  imageMobileUrl: string | null;
  showAtSec: number | null;
  hideAtSec: number | null;
  link: string | null;
  passUtms: boolean;
  disabled: boolean;
  sameWindow: boolean;
  raffleEnabled: boolean;
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
  offer: PlayerOffer;
  ownerChat: PlayerOwnerMsg[];
  leadChat: PlayerLeadMsg[];
  lead: PublicLeadWithUtms;
  initialOffsetSec: number;
}
```

- [ ] **Step 2: Write failing test for `offer-banner.tsx`**

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { OfferBanner } from "@/app/[slug]/_components/offer-banner";
import type { PlayerOffer } from "@/app/[slug]/_lib/public-types";

const baseOffer: PlayerOffer = {
  name: "X", title: "Y",
  priceOriginal: "R$2.997", priceFinal: "12x R$153.44",
  buttonText: "QUERO!", buttonColor: "#dc2626",
  imageDesktopUrl: "https://cdn.example.com/d.png",
  imageMobileUrl: "https://cdn.example.com/m.png",
  showAtSec: 100, hideAtSec: 200,
  link: "https://buy.example.com/x",
  passUtms: false, disabled: false, sameWindow: false, raffleEnabled: false
};

const baseLead = {
  id: "l1", name: "L",
  utmSource: "fb", utmMedium: "cpc", utmCampaign: "launch",
  utmTerm: null, utmContent: null
};

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
  vi.stubGlobal("open", vi.fn());
});

describe("OfferBanner", () => {
  it("does not render before showAtSec", () => {
    render(<OfferBanner offer={baseOffer} lead={baseLead} currentTimeSec={50} />);
    expect(screen.queryByRole("button", { name: /QUERO/ })).toBeNull();
  });
  it("does not render after hideAtSec", () => {
    render(<OfferBanner offer={baseOffer} lead={baseLead} currentTimeSec={300} />);
    expect(screen.queryByRole("button", { name: /QUERO/ })).toBeNull();
  });
  it("renders inside window with correct color", () => {
    render(<OfferBanner offer={baseOffer} lead={baseLead} currentTimeSec={150} />);
    const btn = screen.getByRole("button", { name: /QUERO/ });
    expect(btn).toHaveStyle({ backgroundColor: "#dc2626" });
  });
  it("never renders when offer.disabled", () => {
    render(<OfferBanner offer={{ ...baseOffer, disabled: true }} lead={baseLead} currentTimeSec={150} />);
    expect(screen.queryByRole("button", { name: /QUERO/ })).toBeNull();
  });
  it("opens link with UTMs appended when passUtms=true", () => {
    const open = vi.fn();
    vi.stubGlobal("open", open);
    render(<OfferBanner offer={{ ...baseOffer, passUtms: true }} lead={baseLead} currentTimeSec={150} />);
    fireEvent.click(screen.getByRole("button", { name: /QUERO/ }));
    expect(open).toHaveBeenCalledWith(
      expect.stringContaining("utm_source=fb"),
      "_blank",
      "noopener,noreferrer"
    );
  });
  it("opens with target=_self when sameWindow=true", () => {
    const open = vi.fn();
    vi.stubGlobal("open", open);
    render(<OfferBanner offer={{ ...baseOffer, sameWindow: true }} lead={baseLead} currentTimeSec={150} />);
    fireEvent.click(screen.getByRole("button", { name: /QUERO/ }));
    expect(open).toHaveBeenCalledWith(expect.any(String), "_self", "noopener,noreferrer");
  });
  it("shows raffle badge when raffle enabled", () => {
    render(<OfferBanner offer={{ ...baseOffer, raffleEnabled: true }} lead={baseLead} currentTimeSec={150} />);
    expect(screen.getByText(/Sorteio/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Implement `offer-banner.tsx`**

```tsx
"use client";
import { useEffect, useRef } from "react";
import type { PlayerOffer } from "../_lib/public-types";
import type { PublicLeadWithUtms } from "@/lib/public-dto";

interface Props {
  offer: PlayerOffer;
  lead: PublicLeadWithUtms;
  currentTimeSec: number;
}

function isActive(o: PlayerOffer, t: number): boolean {
  if (o.disabled) return false;
  if (o.showAtSec != null && t < o.showAtSec) return false;
  if (o.hideAtSec != null && t >= o.hideAtSec) return false;
  return true;
}

function buildUrl(link: string, lead: PublicLeadWithUtms, passUtms: boolean): string {
  if (!passUtms) return link;
  const url = new URL(link);
  const map: Array<[string, string | null]> = [
    ["utm_source", lead.utmSource],
    ["utm_medium", lead.utmMedium],
    ["utm_campaign", lead.utmCampaign],
    ["utm_term", lead.utmTerm],
    ["utm_content", lead.utmContent]
  ];
  for (const [k, v] of map) {
    if (v != null) url.searchParams.set(k, v);
  }
  return url.toString();
}

export function OfferBanner({ offer, lead, currentTimeSec }: Props) {
  const seenRef = useRef(false);
  const active = isActive(offer, currentTimeSec);

  useEffect(() => {
    if (!active || seenRef.current) return;
    seenRef.current = true;
    void fetch("/api/offer-view", { method: "POST" }).catch(() => {});
  }, [active]);

  if (!active) return null;

  function onClick() {
    void fetch("/api/offer-click", { method: "POST" }).catch(() => {});
    if (!offer.link) return;
    const url = buildUrl(offer.link, lead, offer.passUtms);
    window.open(url, offer.sameWindow ? "_self" : "_blank", "noopener,noreferrer");
  }

  return (
    <div className="space-y-3 rounded-lg border bg-card p-4 shadow">
      {offer.imageDesktopUrl ? (
        <img src={offer.imageDesktopUrl} alt="" className="hidden w-full rounded-md object-cover md:block" />
      ) : null}
      {offer.imageMobileUrl ? (
        <img src={offer.imageMobileUrl} alt="" className="block w-full rounded-md object-cover md:hidden" />
      ) : null}
      <div className="flex items-end justify-between gap-2 text-sm">
        <div>
          {offer.priceOriginal ? (
            <p className="text-muted-foreground line-through">De {offer.priceOriginal}</p>
          ) : null}
          {offer.priceFinal ? <p className="text-lg font-semibold">Por {offer.priceFinal}</p> : null}
        </div>
        {offer.raffleEnabled ? (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
            🎉 Sorteio
          </span>
        ) : null}
      </div>
      <button
        type="button"
        onClick={onClick}
        className="block w-full rounded-md py-3 text-center text-sm font-semibold text-white shadow"
        style={{ backgroundColor: offer.buttonColor }}
      >
        {offer.buttonText}
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Delete old cta-banner**

```bash
rm apps/web/src/app/\[slug\]/_components/cta-banner.tsx
```

- [ ] **Step 5: Run tests**

```bash
pnpm --filter web vitest run src/test/components/offer-banner.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/\[slug\]/_lib/public-types.ts apps/web/src/app/\[slug\]/_components/offer-banner.tsx apps/web/src/test/components/offer-banner.test.tsx apps/web/src/app/\[slug\]/_components/cta-banner.tsx
git commit -m "feat(web): OfferBanner replaces CtaBanner — single offer with UTM passthrough + raffle badge"
```

---

### Task 13: live page + player-shell wiring

**Files:**
- Modify: `apps/web/src/app/[slug]/live/page.tsx`
- Modify: `apps/web/src/app/[slug]/_components/player-shell.tsx`

- [ ] **Step 1: Update `live/page.tsx`**

Replace lines 18-21 (the `findUnique` include) and lines 51-67 (the `<PlayerShell>` invocation):

```ts
  const w = await prisma.webinar.findUnique({
    where: { slug },
    include: { video: true, chatMessages: { orderBy: { showAtSec: "asc" } } }
  });
```

```tsx
  return (
    <PlayerShell
      webinar={wDto}
      video={videoDto}
      offer={{
        name: w.offerName,
        title: w.offerTitle,
        priceOriginal: w.offerPriceOriginal,
        priceFinal: w.offerPriceFinal,
        buttonText: w.offerButtonText,
        buttonColor: w.offerButtonColor,
        imageDesktopUrl: w.offerImageDesktopUrl,
        imageMobileUrl: w.offerImageMobileUrl,
        showAtSec: w.offerShowAtSec,
        hideAtSec: w.offerHideAtSec,
        link: w.offerLink,
        passUtms: w.offerPassUtms,
        disabled: w.offerDisabled,
        sameWindow: w.offerSameWindow,
        raffleEnabled: w.offerRaffleEnabled
      }}
      ownerChat={w.chatMessages.map((m) => ({
        id: m.id, authorName: m.authorName, text: m.text, showAtSec: m.showAtSec, isOwner: m.isOwner
      }))}
      leadChat={leadChat.map((m) => ({
        id: m.id, text: m.text, videoSec: m.videoSec, createdAt: m.createdAt.toISOString()
      }))}
      lead={publicLeadWithUtmsDto(lead)}
      initialOffsetSec={offset}
    />
  );
```

Add `publicLeadWithUtmsDto` to the import line:

```ts
import { publicWebinarDto, publicVideoDto, publicLeadWithUtmsDto } from "@/lib/public-dto";
```

Remove the `publicLeadDto` import if unused.

- [ ] **Step 2: Update `player-shell.tsx`**

Replace `import { CtaBanner } from "./cta-banner";` with `import { OfferBanner } from "./offer-banner";`. Replace `ctas` prop usage with `offer` + `lead`:

```tsx
"use client";
import { useRef, useState } from "react";
import type { PlayerShellProps } from "../_lib/public-types";
import { HlsPlayer } from "./hls-player";
import { ChatPanel } from "./chat-panel";
import { OfferBanner } from "./offer-banner";
import { Tracker } from "./tracker";

export function PlayerShell({
  webinar, video, offer, ownerChat, leadChat, lead, initialOffsetSec
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
        {webinar.logoUrl ? <img src={webinar.logoUrl} alt="" className="h-8 object-contain" /> : <div />}
        <span className="text-sm text-muted-foreground">Olá, {lead.name}</span>
      </header>
      <div className="grid gap-4 p-4 md:grid-cols-[2fr_1fr]">
        <div className="space-y-3">
          <HlsPlayer
            src={video.hlsUrl}
            startOffsetSec={initialOffsetSec}
            onTimeUpdate={onTimeUpdate}
          />
          <OfferBanner offer={offer} lead={lead} currentTimeSec={currentTimeSec} />
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

- [ ] **Step 3: Verify**

```bash
pnpm --filter web tsc --noEmit 2>&1 | grep -E "(live/page|player-shell)" | head -20
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/\[slug\]/live/page.tsx apps/web/src/app/\[slug\]/_components/player-shell.tsx
git commit -m "feat(web): wire offer prop through live page + player-shell"
```

---

### Task 14: Tracking endpoints — offer-view + offer-click

**Files:**
- Create: `apps/web/src/app/api/offer-view/route.ts`
- Create: `apps/web/src/app/api/offer-click/route.ts`
- Create: `apps/web/src/test/api/offer-tracking.test.ts`
- Delete: `apps/web/src/app/api/cta-view/route.ts`
- Delete: `apps/web/src/app/api/cta-click/route.ts`
- Delete: `apps/web/src/test/api/cta.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { prisma } from "db";
import { signLeadCookie } from "@/lib/lead-session";

const cookieGetMock = vi.fn();
vi.mock("next/headers", () => ({ cookies: async () => ({ get: cookieGetMock }) }));
const queueAddMock = vi.fn(async () => ({ id: "j" }));
vi.mock("jobs", async () => ({
  getWebhookQueue: () => ({ add: queueAddMock }),
  JOB_DISPATCH_WEBHOOK: "dispatch-webhook"
}));

const TEST_USER = { id: "ot-user", email: "ot@example.com", name: "OT" };

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

async function setup(extras: any = {}) {
  const w = await prisma.webinar.create({
    data: {
      ownerId: TEST_USER.id, name: "T", title: "T",
      slug: "ot-" + Math.random().toString(36).slice(2, 8),
      status: "ACTIVE", webhookUrl: "https://x",
      webhookOnOfferView: true, webhookOnOfferClick: true, webhookOnRaffleEntry: true,
      ...extras
    }
  });
  const lead = await prisma.lead.create({
    data: { webinarId: w.id, name: "L", email: "l@e.com" }
  });
  cookieGetMock.mockReturnValue({ value: signLeadCookie(lead.id) });
  return { w, lead };
}

describe("POST /api/offer-view", () => {
  it("creates OFFER_VIEW once per (webinar, lead), idempotent on second call", async () => {
    await setup();
    const { POST } = await import("@/app/api/offer-view/route");
    const req = () => new Request("http://localhost/api/offer-view", { method: "POST" });
    const r1 = await POST(req()); expect(r1.status).toBe(200);
    const r2 = await POST(req()); expect(r2.status).toBe(200);
    const events = await prisma.event.findMany({ where: { kind: "OFFER_VIEW" } });
    expect(events).toHaveLength(1);
    expect(queueAddMock).toHaveBeenCalledTimes(1);
  });
});

describe("POST /api/offer-click", () => {
  it("creates OFFER_CLICK + increments ctaClicks + fires webhook", async () => {
    const { lead } = await setup();
    const { POST } = await import("@/app/api/offer-click/route");
    const res = await POST(new Request("http://localhost/api/offer-click", { method: "POST" }));
    expect(res.status).toBe(200);
    const after = await prisma.lead.findUnique({ where: { id: lead.id } });
    expect(after?.ctaClicks).toBe(1);
    const events = await prisma.event.findMany({ where: { kind: "OFFER_CLICK" } });
    expect(events).toHaveLength(1);
    expect(queueAddMock).toHaveBeenCalled();
  });
  it("also emits RAFFLE_ENTRY when offerRaffleEnabled", async () => {
    await setup({ offerRaffleEnabled: true });
    const { POST } = await import("@/app/api/offer-click/route?" + Date.now());
    await POST(new Request("http://localhost/api/offer-click", { method: "POST" }));
    const raffle = await prisma.event.findMany({ where: { kind: "RAFFLE_ENTRY" } });
    expect(raffle).toHaveLength(1);
    expect(queueAddMock).toHaveBeenCalledTimes(2); // offer_click + raffle_entry
  });
});
```

- [ ] **Step 2: Run, verify failure**

```bash
pnpm --filter web vitest run src/test/api/offer-tracking.test.ts
```

Expected: FAIL — modules not found.

- [ ] **Step 3: Create `app/api/offer-view/route.ts`**

```ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "db";
import { verifyLeadCookie } from "@/lib/lead-session";
import { enqueueWebhook } from "@/lib/webhook";

export async function POST() {
  const cookieStore = await cookies();
  const leadId = verifyLeadCookie(cookieStore.get("hw_lead")?.value);
  if (!leadId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const lead = await prisma.lead.findUnique({ where: { id: leadId }, include: { webinar: true } });
  if (!lead) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const existing = await prisma.event.findFirst({
    where: { webinarId: lead.webinarId, leadId: lead.id, kind: "OFFER_VIEW" }
  });
  if (existing) return NextResponse.json({ ok: true });

  await prisma.event.create({
    data: { webinarId: lead.webinarId, leadId: lead.id, kind: "OFFER_VIEW" }
  });
  await enqueueWebhook(lead.webinar, "lead_viu_oferta", lead);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Create `app/api/offer-click/route.ts`**

```ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "db";
import { verifyLeadCookie } from "@/lib/lead-session";
import { enqueueWebhook } from "@/lib/webhook";

export async function POST() {
  const cookieStore = await cookies();
  const leadId = verifyLeadCookie(cookieStore.get("hw_lead")?.value);
  if (!leadId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const lead = await prisma.lead.findUnique({ where: { id: leadId }, include: { webinar: true } });
  if (!lead) return NextResponse.json({ error: "not_found" }, { status: 404 });

  await prisma.event.create({
    data: { webinarId: lead.webinarId, leadId: lead.id, kind: "OFFER_CLICK" }
  });
  const updated = await prisma.lead.update({
    where: { id: lead.id },
    data: { ctaClicks: { increment: 1 }, lastSeenAt: new Date() }
  });
  await enqueueWebhook(lead.webinar, "lead_clicou_oferta", updated);

  if (lead.webinar.offerRaffleEnabled) {
    await prisma.event.create({
      data: { webinarId: lead.webinarId, leadId: lead.id, kind: "RAFFLE_ENTRY" }
    });
    await enqueueWebhook(lead.webinar, "lead_entrou_sorteio", updated);
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 5: Delete old routes + test**

```bash
rm apps/web/src/app/api/cta-view/route.ts
rm apps/web/src/app/api/cta-click/route.ts
rm apps/web/src/test/api/cta.test.ts
```

- [ ] **Step 6: Run tests**

```bash
pnpm --filter web vitest run src/test/api/offer-tracking.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/api/offer-view apps/web/src/app/api/offer-click apps/web/src/test/api/offer-tracking.test.ts apps/web/src/app/api/cta-view apps/web/src/app/api/cta-click apps/web/src/test/api/cta.test.ts
git commit -m "feat(web): replace cta-view/cta-click with offer-view/offer-click + raffle entry"
```

---

### Task 15: Capture form UTM hidden inputs

**Files:**
- Modify: `apps/web/src/app/[slug]/_components/capture-form.tsx`

- [ ] **Step 1: Add UTM hidden-input state**

At the top of the function body (after `const [error, ...]`), add:

```tsx
  const [utms, setUtms] = useState<{ source?: string; medium?: string; campaign?: string; term?: string; content?: string }>({});

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const next: typeof utms = {};
    for (const k of ["source", "medium", "campaign", "term", "content"] as const) {
      const v = sp.get(`utm_${k}`);
      if (v) next[k] = v;
    }
    setUtms(next);
  }, []);
```

(`useState` and `useEffect` already imported at line 2.)

Inside the `<form action={onSubmit}>` block, just before the field map, add hidden inputs:

```tsx
        <input type="hidden" name="utm_source" value={utms.source ?? ""} />
        <input type="hidden" name="utm_medium" value={utms.medium ?? ""} />
        <input type="hidden" name="utm_campaign" value={utms.campaign ?? ""} />
        <input type="hidden" name="utm_term" value={utms.term ?? ""} />
        <input type="hidden" name="utm_content" value={utms.content ?? ""} />
```

- [ ] **Step 2: Verify typecheck**

```bash
pnpm --filter web tsc --noEmit 2>&1 | grep capture-form | head -5
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/\[slug\]/_components/capture-form.tsx
git commit -m "feat(web): capture form reads UTM params into hidden inputs"
```

---

### Task 16: submitOptin persists UTMs

**Files:**
- Modify: `apps/web/src/server/actions/public.ts`
- Modify: `apps/web/src/test/server/actions/public-optin.test.ts`

- [ ] **Step 1: Add failing test case**

In `public-optin.test.ts`, add a new `it` block inside `describe("submitOptin", ...)`:

```ts
  it("persists UTM fields from FormData on the Lead row", async () => {
    await makeWebinar({ slug: "demo-utm" });
    const { submitOptin } = await import("@/server/actions/public?" + (Date.now() + 5));
    const fd = new FormData();
    fd.set("name", "U"); fd.set("email", "u@e.com"); fd.set("phone", "+5511999990000");
    fd.set("utm_source", "fb");
    fd.set("utm_medium", "cpc");
    fd.set("utm_campaign", "launch");
    await expect(submitOptin("demo-utm", fd)).rejects.toThrow(/__redirect/);
    const lead = await prisma.lead.findFirst({ where: { email: "u@e.com" } });
    expect(lead?.utmSource).toBe("fb");
    expect(lead?.utmMedium).toBe("cpc");
    expect(lead?.utmCampaign).toBe("launch");
    expect(lead?.utmTerm).toBeNull();
    expect(lead?.utmContent).toBeNull();
  });
```

- [ ] **Step 2: Run, verify failure**

```bash
pnpm --filter web vitest run src/test/server/actions/public-optin.test.ts
```

Expected: FAIL — `lead.utmSource` is `undefined` (action does not persist).

- [ ] **Step 3: Update `submitOptin`**

In `apps/web/src/server/actions/public.ts`, after the `const data = parsed.data ...` line, add:

```ts
  const utm = {
    utmSource: (formData.get("utm_source") as string) || null,
    utmMedium: (formData.get("utm_medium") as string) || null,
    utmCampaign: (formData.get("utm_campaign") as string) || null,
    utmTerm: (formData.get("utm_term") as string) || null,
    utmContent: (formData.get("utm_content") as string) || null
  };
```

Then in the `existing` branch, change the update `data` to merge `utm`:

```ts
    lead = await prisma.lead.update({
      where: { id: existing.id },
      data: { name: name || existing.name, phone: phone ?? existing.phone, ip, userAgent: ua, lastSeenAt: new Date(), ...utm }
    });
```

In the `else` branch (create), spread `utm` as well:

```ts
      lead = await prisma.lead.create({
        data: { webinarId: w.id, name, email, phone, ip, userAgent: ua, ...utm }
      });
```

And in the P2002 race-resolution branch:

```ts
          lead = await prisma.lead.update({
            where: { id: racedExisting.id },
            data: { name: name || racedExisting.name, phone: phone ?? racedExisting.phone, ip, userAgent: ua, lastSeenAt: new Date(), ...utm }
          });
```

- [ ] **Step 4: Run test**

```bash
pnpm --filter web vitest run src/test/server/actions/public-optin.test.ts
```

Expected: PASS (all cases including the new one).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/server/actions/public.ts apps/web/src/test/server/actions/public-optin.test.ts
git commit -m "feat(web): persist UTMs from opt-in FormData on Lead row"
```

---

### Task 17: Integrations form — rename + raffle toggle

**Files:**
- Modify: `apps/web/src/components/webinar/integrations-form.tsx`
- Modify: `apps/web/src/app/dashboard/webinars/[id]/integrations/page.tsx` (initial-prop shape)

- [ ] **Step 1: Update `integrations-form.tsx` triggers list**

Replace the `TRIGGERS` constant (lines 19-27):

```tsx
const TRIGGERS: ReadonlyArray<{ key: keyof IntegrationsInput; label: string }> = [
  { key: "webhookOnOptin", label: "Ao captar lead novo" },
  { key: "webhookOnEnter", label: "Quando lead acessar o webinar" },
  { key: "webhookOnOfferView", label: "Quando lead vir a oferta" },
  { key: "webhookOnOfferClick", label: "Quando lead clicar na oferta" },
  { key: "webhookOnRaffleEntry", label: "Quando lead entrar no sorteio" },
  { key: "webhookOnPitchReached", label: "Quando lead vir o pitch" },
  { key: "webhookOnPermanence", label: "Quando lead permanecer (threshold abaixo)" },
  { key: "webhookOnLeave", label: "Quando lead sair do webinar" }
];
```

- [ ] **Step 2: Update `integrations/page.tsx` initial prop**

Open `apps/web/src/app/dashboard/webinars/[id]/integrations/page.tsx`. In the `initial={{...}}` literal passed to `<IntegrationsForm>`, replace `webhookOnCtaView`/`webhookOnCtaClick` with `webhookOnOfferView`, `webhookOnOfferClick`, and add `webhookOnRaffleEntry: w.webhookOnRaffleEntry`. Use the existing pattern of pulling from `w` (the webinar row).

- [ ] **Step 3: Verify typecheck**

```bash
pnpm --filter web tsc --noEmit 2>&1 | grep -E "(integrations-form|integrations/page)" | head -10
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/webinar/integrations-form.tsx apps/web/src/app/dashboard/webinars/\[id\]/integrations/page.tsx
git commit -m "feat(web): integrations form renames CTA flags + adds raffle entry toggle"
```

---

### Task 18: Final cleanup — typecheck + worker tests

**Files:**
- Touch: as needed across project

- [ ] **Step 1: Run full typecheck**

```bash
pnpm -r typecheck 2>&1 | tee typecheck.log | tail -40
```

Expected: clean. If any errors remain, they are most likely:

(a) A test fixture passing the old `Step5Input` shape — fix by replacing the fixture with the new offer fields.

(b) A reference to `prisma.cta` or `prisma.ctaView` — replace with offer column reads or delete the dead code.

(c) A reference to `webhookOnCtaView` / `webhookOnCtaClick` — replace with offer/raffle flags.

Fix each error with the smallest change that resolves it. Re-run `pnpm -r typecheck` after each batch.

- [ ] **Step 2: Run full test suite**

```bash
pnpm -r --workspace-concurrency=1 test 2>&1 | tail -60
```

Expected: all suites pass. If a worker test references CTA tables, update it — the worker workspace shares the Prisma client and may need stale references removed.

- [ ] **Step 3: Smoke browser test**

Start dev server in a separate shell:

```bash
pnpm --filter web dev
```

Manually verify in the browser:
1. Navigate to `/dashboard/webinars/<id>/step-5`. Form renders with offer fields. Live preview reflects edits.
2. Upload a desktop image. Preview shows it. Save. Reload — image persists.
3. Toggle Habilitar sorteio. Preview shows the raffle badge.
4. Save the form. Navigate to `/<slug>?utm_source=fb&utm_campaign=launch` → fill capture form → submit → verify `Lead.utmSource = "fb"` in DB.
5. On `/<slug>/live`, advance the player past `offerShowAtSec`. Offer banner appears. Click it → URL opens with UTMs appended (network tab).

- [ ] **Step 4: Commit any cleanup fixes**

```bash
git status
git add <fixed-files>
git commit -m "chore: D2 typecheck/test cleanup after offer migration"
```

---

### Task 19: README + acceptance commit

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Append D2 section after the existing "Wizard redesign (sub-plan D1)" block**

Insert before the `## Deploy (Coolify)` heading:

```markdown
## Offer (sub-plan D2)

- Step 5 redesigned to match original Hotwebinar single-Offer UI. Multi-CTA model dropped.
- Webinar adds 15 offer columns + 5 lead UTM columns + 3 webhook flag columns (`webhookOnOfferView`, `webhookOnOfferClick`, `webhookOnRaffleEntry`).
- EventKind values `CTA_VIEW`/`CTA_CLICK` renamed in-place to `OFFER_VIEW`/`OFFER_CLICK`. New value `RAFFLE_ENTRY`.
- WebhookEvent gains `lead_entrou_sorteio`.
- Image upload via `/api/upload/offer-image` (presigned PUT, MIME `image/jpeg|png|webp`, 2 MiB cap, key `offer/<webinarId>/<kind>.<ext>`).
- UTMs captured at opt-in (`utm_source/medium/campaign/term/content`) and re-appended at offer click when `offerPassUtms=true`.
- Schema migration: `20260505180000_d2_offer_rebuild`.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: document sub-plan D2 offer rebuild in README"
```

- [ ] **Step 3: Final verification**

```bash
git log --oneline -25
git status
```

Expected: clean tree, ~20 commits ahead of pre-D2 baseline.

---

## Self-Review

**Spec coverage check:**

| Spec section | Plan task |
|---|---|
| Architecture: single Offer per Webinar | T1 (schema), T9 (form), T12 (banner) |
| UTM passthrough flow | T15 (capture), T16 (persist), T12 (replay), T13 (lead UTM dto) |
| Image upload presigned PUT | T6 (component), T7 (route) |
| Color picker | T5 |
| Preview desktop + mobile | T8 |
| Raffle toggle + RAFFLE_ENTRY | T1 (schema), T9 (toggle), T14 (event) |
| Migration `d2_offer_rebuild` | T1 |
| 15 Webinar offer cols, 5 Lead utm cols, 3 webhook flag cols | T1 |
| Validation `step5Schema` rewrite | T2 |
| Public DTO + 15 offer fields | T4 |
| Tracking endpoints offer-view/offer-click | T14 |
| Integrations form rename + raffle | T17 |
| All test files in spec | T2, T4-T8, T10, T12, T14, T16 |
| Acceptance criteria browser smoke | T18 |

**No placeholder check:** No "TBD", no "implement later", every code change includes the actual code block.

**Type consistency check:** `Step5Input` shape consistent across T2 (defined), T9 (form values), T10 (action), T11 (page initial), T12 (banner via PlayerOffer derived). `WebhookEvent` extended in T1, used in T3 (mapping) and T14 (raffle entry). `PublicLeadWithUtms` defined in T4 and consumed in T12, T13.

**Done.**
