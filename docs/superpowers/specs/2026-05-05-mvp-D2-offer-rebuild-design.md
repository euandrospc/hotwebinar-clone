# MVP Sub-plan D2 — Step 5 Oferta Rebuild

**Status:** Approved 2026-05-05
**Predecessor:** D1 (Wizard Redesign Steps 1+2+3) — committed
**Supersedes:** Multi-CTA model (Cta/CtaView tables)

## Goal

Rebuild Wizard Step 5 to match original Hotwebinar single-Offer UI: 15 offer fields persisted on Webinar, image upload via S3, UTM passthrough captured at opt-in, sticky live preview (desktop + mobile cards). Drop legacy multi-CTA model.

## Architecture

**Single Offer per Webinar.** Offer fields embedded as Webinar columns. `Cta` + `CtaView` tables dropped (cascade); their EventKind values renamed in-place to OFFER_VIEW/OFFER_CLICK to preserve existing Event rows. New EventKind value `RAFFLE_ENTRY` added.

**UTM passthrough flow.** Capture form (`/[slug]`) reads `window.location.search` via hidden form inputs `utm_source/medium/campaign/term/content`, persisted on Lead row at opt-in. Player offer-click handler builds final URL appending stored UTMs when `offerPassUtms=true`. Survives refresh and direct re-entry without query string.

**Image upload.** Reuses S3 presigned PUT pattern from `/api/upload/thumb`. Bucket = `HLS_BUCKET` (no new env). Keys `offer/<webinarId>/desktop.<ext>` and `offer/<webinarId>/mobile.<ext>`. MIME allowlist `image/jpeg|png|webp`. Size cap 2 MiB.

**Color picker.** Native `<input type="color">` wrapped in shadcn-styled trigger (swatch dot + hex label). Default `#dc2626`.

**Preview.** Right column sticky aside renders `OfferPreviewDesktop` (full hero card) + `OfferPreviewMobile` (384×110 strip). Live-update via `react-hook-form` `useWatch`. No Chat/Oferta tab toggle (skipped — not functional).

**Raffle.** Toggle persists `offerRaffleEnabled`. Player shows "🎉 Sorteio" badge on offer card. Click button → both `OFFER_CLICK` and `RAFFLE_ENTRY` events emitted. Owner-side raffle drawing UI = future sub-plan, not D2.

## Data Model

### Migration `d2_offer_rebuild`

Order matters: data drops first, enum rename, additive columns last.

```sql
-- 1. Drop legacy CTA model + dependent webhook flag columns
DROP TABLE IF EXISTS cta_view CASCADE;
DROP TABLE IF EXISTS cta CASCADE;

ALTER TABLE webinar
  DROP COLUMN IF EXISTS "webhookOnCtaView",
  DROP COLUMN IF EXISTS "webhookOnCtaClick";

-- 2. EventKind enum: rename values, add new
ALTER TYPE "EventKind" RENAME VALUE 'CTA_VIEW' TO 'OFFER_VIEW';
ALTER TYPE "EventKind" RENAME VALUE 'CTA_CLICK' TO 'OFFER_CLICK';
ALTER TYPE "EventKind" ADD VALUE 'RAFFLE_ENTRY';

-- 3. Webinar offer columns (15)
ALTER TABLE webinar
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

-- 4. Webinar new webhook flags
ALTER TABLE webinar
  ADD COLUMN "webhookOnOfferView" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "webhookOnOfferClick" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "webhookOnRaffleEntry" BOOLEAN NOT NULL DEFAULT false;

-- 5. Lead UTM columns (5)
ALTER TABLE lead
  ADD COLUMN "utmSource" TEXT,
  ADD COLUMN "utmMedium" TEXT,
  ADD COLUMN "utmCampaign" TEXT,
  ADD COLUMN "utmTerm" TEXT,
  ADD COLUMN "utmContent" TEXT;
```

### Prisma schema delta (`packages/db/prisma/schema.prisma`)

Remove `model Cta` and `model CtaView`. Remove `ctas Cta[]` and `ctaViews CtaView[]` relations from Webinar/Lead. Update EventKind enum values. Add 15 offer cols + 3 webhook flag cols to Webinar. Add 5 utm cols to Lead.

## Files Created / Modified

### New components

- `apps/web/src/components/wizard/color-picker-field.tsx` — Controlled color input. Props: `value`, `onChange`, `id`, `aria-label`. Renders 32px circular swatch + hex code label, native color picker hidden `<input type="color">`.
- `apps/web/src/components/wizard/image-upload-field.tsx` — Controlled image uploader. Props: `value: string | null`, `onChange`, `webinarId`, `kind: "desktop" | "mobile"`, `recommendedHint?: string`. Drag/drop or click. Posts to `/api/upload/offer-image` for presigned URL, PUTs to S3, calls `onChange(publicUrl)`. Shows preview thumb + delete button when value set.
- `apps/web/src/components/wizard/offer-preview.tsx` — Two sub-views: `<OfferPreviewDesktop>` and `<OfferPreviewMobile>`. Receive complete offer prop shape. Mobile is 384×110 horizontal strip; desktop is hero card.

### New API route

- `apps/web/src/app/api/upload/offer-image/route.ts` — POST. Body `{ webinarId, kind: "desktop" | "mobile", mimeType, sizeBytes }`. Auth via `getSession`, check `webinar.ownerId === session.user.id`. MIME allowlist. Size cap 2 MiB. Returns `{ uploadUrl, publicUrl, key }`.

### New tracking routes

- `apps/web/src/app/api/offer-view/route.ts` — POST. Resolves lead from `hw_lead` cookie + slug. Emits `OFFER_VIEW` event idempotently (existing OFFER_VIEW for this lead = no-op). Fires `webhookOnOfferView` if flag set.
- `apps/web/src/app/api/offer-click/route.ts` — POST. Emits `OFFER_CLICK`. If `offerRaffleEnabled` also emits `RAFFLE_ENTRY`. Fires respective webhook flags. Returns `{ ok: true }`.

(Routes `/api/cta-view` and `/api/cta-click` deleted; their handlers replaced.)

### Modified

- `apps/web/src/components/wizard/step-5-form.tsx` — full replace. `lg:grid-cols-[1fr_minmax(0,420px)]`. Sections: dados / preços / botão+cor / imagens / timing (pitchAtSec + offerShowAtSec + offerHideAtSec) / link+toggles. Right column sticky `<OfferPreview>`.
- `apps/web/src/server/actions/webinar.ts` — `updateWebinarStep5` rewrites entire signature: persists 15 offer cols + `pitchAtSec`. Removes `useFieldArray` Cta upsert/delete logic.
- `apps/web/src/lib/validations/webinar.ts` — replace `step5Schema` with new shape (see below).
- `apps/web/src/app/dashboard/webinars/[id]/(wizard)/step-5/page.tsx` — query offer fields from Webinar, pass to `<Step5Form>`.
- `apps/web/src/app/[slug]/_components/cta-banner.tsx` → rename `offer-banner.tsx`. Re-implement: read `webinar.offer*`, single offer (no array), responsive desktop/mobile image, color from `offerButtonColor`, raffle badge if enabled, click handler builds URL with UTMs from lead row, opens `_self`/`_blank` per `offerSameWindow`.
- `apps/web/src/app/[slug]/_components/capture-form.tsx` — read `URLSearchParams` on mount, set 5 hidden inputs (utm_source/medium/campaign/term/content) on the form.
- `apps/web/src/server/actions/public.ts` (or wherever `submitOptin` lives) — extract UTMs from FormData, persist on Lead create/update path.
- `apps/web/src/lib/public-dto.ts` — `PublicWebinar` adds 15 offer fields. `publicWebinarDto` selects them. Add lead utm fields to lead-resolution helper if used by player.
- `apps/web/src/lib/webhook.ts` — replace `cta_view`/`cta_click` event-name constants with `offer_view`/`offer_click`/`raffle_entry`. Update flag-name references on Webinar.
- `apps/web/src/components/webinar/integrations-form.tsx` — rename CTA toggles to Offer toggles + add raffle entry toggle.
- `apps/web/src/lib/validations/integrations.ts` — same rename + add field.
- `apps/web/src/app/[slug]/live/page.tsx` — replace `<CtaBanner>` with `<OfferBanner>`. Pass single offer object not array.
- `apps/web/src/app/[slug]/_lib/public-types.ts` — drop `PlayerCta` type, add `PlayerOffer` type.

### Tests (new + updates)

- `apps/web/src/test/lib/validations/step5.test.ts` (new) — happy path, missing required (`offerName`/`offerTitle`/`offerButtonText`/`offerButtonColor`), invalid hex (`#zzzzzz`, `red`), `offerHideAtSec < offerShowAtSec`, invalid `offerLink` URL.
- `apps/web/src/test/server/actions/webinar.test.ts` (update) — replace existing Step 5 CTA tests with offer field persistence tests. Owner check, ownership rejection.
- `apps/web/src/test/api/upload-offer-image.test.ts` (new) — auth, ownership, mime allowlist (reject `image/svg+xml`, `application/pdf`), size cap, returns presigned URL with expected key shape.
- `apps/web/src/test/api/offer-click.test.ts` (new) — emits OFFER_CLICK, emits RAFFLE_ENTRY when raffle enabled, fires webhook flags.
- `apps/web/src/test/api/offer-view.test.ts` (new) — idempotent (second call no-op), fires webhook once.
- `apps/web/src/test/server/actions/public-optin.test.ts` (update) — add case: FormData with `utm_*` fields → Lead row stores UTMs.
- `apps/web/src/test/lib/public-dto.test.ts` (update) — DTO returns 15 offer fields.
- `apps/web/src/test/components/offer-preview.test.tsx` (new) — renders desktop + mobile, applies button color, hides image when null.
- `apps/web/src/test/components/offer-banner.test.tsx` (new) — show window gating, UTM URL append, sameWindow toggle (`target="_self"` vs `_blank`), raffle badge presence.
- Delete: `apps/web/src/test/api/cta.test.ts` (replaced by offer-click + offer-view).

## Validations

```ts
// apps/web/src/lib/validations/webinar.ts
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
  offerLink: z.string().url().optional().nullable(),
  offerPassUtms: z.boolean(),
  offerDisabled: z.boolean(),
  offerSameWindow: z.boolean(),
  offerRaffleEnabled: z.boolean()
}).refine(
  (d) => d.offerHideAtSec == null || d.offerShowAtSec == null || d.offerHideAtSec >= d.offerShowAtSec,
  { message: "Tempo fim deve ser ≥ tempo início", path: ["offerHideAtSec"] }
);
```

## UTM Capture Contract

`capture-form.tsx` on mount:
```ts
const sp = new URLSearchParams(window.location.search);
const utms = ["source", "medium", "campaign", "term", "content"]
  .map(k => [`utm_${k}`, sp.get(`utm_${k}`)] as const)
  .filter(([, v]) => v != null);
// render hidden inputs for each
```

`submitOptin` reads `formData.get("utm_source")` etc., persists on Lead update/create. Empty/missing → `null`.

`offer-banner.tsx` click handler when `offerPassUtms=true`:
```ts
const url = new URL(offerLink);
if (lead.utmSource) url.searchParams.set("utm_source", lead.utmSource);
// repeat for medium/campaign/term/content (only set if non-null)
window.open(url.toString(), offerSameWindow ? "_self" : "_blank", "noopener,noreferrer");
```

## Image Upload Contract

`POST /api/upload/offer-image`:
```ts
// Request
{ webinarId: string, kind: "desktop" | "mobile", mimeType: string, sizeBytes: number }

// Response (200)
{ uploadUrl: string, publicUrl: string, key: string }

// Errors
401 { error: "Unauthorized" }
404 { error: "not_found" }              // webinar not owned
400 { error: "invalid_mime" }           // outside allowlist
413 { error: "too_large", maxBytes }    // > 2 MiB
```

Allowlist: `image/jpeg`, `image/png`, `image/webp`. Max 2 MiB. Public URL = `${process.env.S3_PUBLIC_BASE_URL}/${HLS_BUCKET}/${key}` (matches existing thumb pattern in `lib/public-dto.ts`).

## Tracking + Webhook Mapping

| Event             | EventKind     | Webhook flag             |
|-------------------|---------------|--------------------------|
| Offer becomes visible (per lead, once) | OFFER_VIEW    | webhookOnOfferView       |
| Offer button clicked | OFFER_CLICK   | webhookOnOfferClick      |
| Click on raffle-enabled offer        | RAFFLE_ENTRY  | webhookOnRaffleEntry     |

`OFFER_VIEW` idempotent per `(webinarId, leadId)` — guard via existing `Event.findFirst` lookup before insert. `OFFER_CLICK` and `RAFFLE_ENTRY` not idempotent (counted per click).

## Public DTO

`PublicWebinar` (in `lib/public-dto.ts`) adds 15 offer fields plus `pitchAtSec`. `offerLink` and image URLs sent down. `offerDisabled` → if true, banner never renders. UTMs not exposed in webinar DTO; resolved separately from lead session.

## Open Questions

None remaining. All clarifications captured in clarifying-Q phase:
- Q1: Single Offer model — replaces Cta[] (option a)
- Q2: Raffle MVP — toggle + badge + RAFFLE_ENTRY event only (option a)
- Q3: Image upload — reuse HLS_BUCKET presign pattern (option a)
- Q4: Color picker — native `<input type="color">` (option a)
- Q5: UTM capture — Lead-stored, captured at opt-in (option c)
- Q6: Preview — desktop + mobile cards, no Chat/Oferta tabs (option b)

## Out of Scope (D2)

- Owner-side raffle drawing/winner UI (future)
- A/B testing of offer variants (future)
- Multi-offer / inline secondary CTAs (deliberate: schema dropped)
- Analytics dashboard for offer conversion rates (future, hooks via OFFER_VIEW/CLICK events ready)
- Animations on offer reveal (YAGNI for MVP)

## Acceptance Criteria

- All Step 5 fields persist round-trip through `updateWebinarStep5` + page reload.
- Owner uploads desktop + mobile images, sees them in preview, both URLs saved.
- Color picker change reflects in preview button color and persists.
- Public `/[slug]/live` shows offer card during configured window, hides outside.
- Lead arriving at `/[slug]?utm_source=fb&utm_campaign=launch` has UTMs persisted on Lead row after opt-in.
- Click on offer button when `offerPassUtms=true` opens URL with UTM query string.
- `offerSameWindow=true` opens in same tab; default opens new tab.
- Raffle toggle on → badge visible, click emits RAFFLE_ENTRY event in DB.
- All validations enforce required fields, hex color shape, hide ≥ show ordering.
- Migration drops cta + cta_view tables, renames EventKind values, all existing tests pass.
- Typecheck + tests green; pages render in browser without errors.
