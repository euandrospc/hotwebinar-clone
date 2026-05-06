# MVP Sub-plan D3 — Chat Redesign + Vendas

**Status:** Approved 2026-05-05
**Predecessors:** D1 (Wizard Steps 1-3) committed; D2 (Step 5 Offer) committed.

## Goal

Rebuild Step 6 (Chat scriptado) layout to match the original Hotwebinar UI (2-column with 3 collapsible sections + preview list) and add a brand-new Step 7 (Vendas — sale notifications) following the same pattern. Player surfaces sale notifications as toast popups during playback.

## Architecture

**Shared UI pattern.** Step 6 and Step 7 both use a 2-column grid `[1fr_minmax(0,420px)]`. Left column = 3 accordion sections: AI generation (stub `disabled` button), file import (XLSX upload), individual editor (manual rows with always-editable inputs). Right column = preview aside with search input, scrollable list of always-editable rows + per-row delete + bulk "Excluir todo" + "Testar no player" link.

**Sale notifications model.** New Prisma model `SaleNotification` keyed to `Webinar`. Owner edits via Step 7. Public lead player loads notifications and fires sonner toasts when the video timeline crosses `showAtSec`. Each notification fires exactly once per player session (in-memory `Set` guard); refresh resets.

**XLSX shared infrastructure.** Existing `lib/chat-xlsx.ts` (D2 stage) handles chat. New `lib/sales-xlsx.ts` mirrors it with sales schema. Both use `exceljs` (already installed). Two new API routes per resource (`/api/webinars/[id]/sales/import` and `/sales/export`) parallel the chat ones.

**AI generation stub.** Both steps include an "Automação Inteligente de Chat" / "Vendas" accordion section. Button is `disabled={true}` with tooltip "Em breve". Reserves UI slot for a future sub-plan; no API wiring now.

**Player toast strategy.** Sonner is already wired in `app/layout.tsx`. New `<SalesNotifier>` client component receives `notifications: PublicSaleNotification[]` + `currentTimeRef: RefObject<number>` and runs a 1s interval checking ref-current vs each notif's `showAtSec`. Once fired, notif id is added to a `Set` ref to prevent duplicates within the session. Position bottom-left (or default sonner position).

## Data Model

### Migration `d3_sales_notifications`

```sql
CREATE TABLE "sale_notification" (
  "id"           TEXT NOT NULL PRIMARY KEY,
  "webinarId"    TEXT NOT NULL REFERENCES "webinar"("id") ON DELETE CASCADE,
  "showAtSec"    INTEGER NOT NULL,
  "buyerName"    TEXT NOT NULL,
  "productName"  TEXT NOT NULL,
  "price"        TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "sale_notification_webinarId_showAtSec_idx" ON "sale_notification"("webinarId", "showAtSec");
```

### Prisma schema delta

```prisma
model SaleNotification {
  id           String   @id @default(cuid())
  webinarId    String
  showAtSec    Int
  buyerName    String
  productName  String
  price        String?
  createdAt    DateTime @default(now())
  webinar      Webinar  @relation(fields: [webinarId], references: [id], onDelete: Cascade)
  @@index([webinarId, showAtSec])
  @@map("sale_notification")
}
```

`Webinar` adds: `saleNotifications SaleNotification[]`.

## Validations (`lib/validations/webinar.ts`)

```ts
export const saleItemSchema = z.object({
  id: z.string().optional(),
  showAtSec: z.number().int().min(0),
  buyerName: z.string().min(1, "Nome do comprador obrigatório").max(80),
  productName: z.string().min(1, "Nome do produto obrigatório").max(120),
  price: z.string().max(20).optional().nullable()
});
export const step7Schema = z.object({ notifications: z.array(saleItemSchema) });
export type Step7Input = z.infer<typeof step7Schema>;
export type SaleItem = z.infer<typeof saleItemSchema>;
```

`step6Schema` stays unchanged (already supports the chat shape from prior work).

## Files

### Created — UI primitives

- `apps/web/src/components/ui/accordion.tsx` — shadcn Accordion wrapper around `@radix-ui/react-accordion` (will need `pnpm add @radix-ui/react-accordion`).
- `apps/web/src/components/ui/tooltip.tsx` — shadcn Tooltip (only if not already present; used for AI stub "Em breve").

### Created — Wizard

- `apps/web/src/components/wizard/wizard-section-accordion.tsx` — 3-trigger accordion. Props: `aiTitle`, `aiDescription`, `aiCta` (string, disabled), `fileSection: ReactNode`, `individualSection: ReactNode`. Single shared component (not Step-specific) so Step 6 and Step 7 stay DRY.
- `apps/web/src/components/wizard/ai-stub-section.tsx` — Card markup with red "Novidade" badge, title, description, large green "Gerar Chat com IA" / "Gerar Vendas com IA" button. `<Button disabled>` + Tooltip "Em breve".
- `apps/web/src/components/wizard/chat-preview-aside.tsx` — Right-column preview for Step 6. Props: `messages: ChatItem[]` + `onUpdate(idx, patch)` + `onDelete(idx)` + `onDeleteAll()` + `slug`. Renders Export XLSX button (link `/api/webinars/<id>/messages/export`), search input, scrollable list of rows with HH:MM:SS / authorName / text inputs (always-editable, inline) + trash icon per row, footer with "Excluir todo o chat" + "Testar no player" (link `/<slug>/live` opens new tab).
- `apps/web/src/components/wizard/sales-preview-aside.tsx` — Same pattern for vendas. Inputs: HH:MM:SS / buyerName / productName / price + trash. Export link `/api/webinars/<id>/sales/export`.

### Created — Player

- `apps/web/src/app/[slug]/_components/sales-notifier.tsx` — client component. `setInterval` 1000ms, fires `toast(...)` once per id when `currentTimeRef.current >= notif.showAtSec`.

### Created — Lib

- `apps/web/src/lib/sales-xlsx.ts` — `parseSalesXlsx(buffer)` returns `Array<{showAtSec, buyerName, productName, price?}>`. `buildSalesXlsx(items)` returns Buffer with header `Hora | Minuto | Segundo | Nome do comprador | Produto | Preço`.

### Created — API

- `apps/web/src/app/api/webinars/[id]/sales/import/route.ts` — POST FormData `file` field; auth + ownership; size cap 5 MiB; parse + return `{ notifications: SaleItem[] }`.
- `apps/web/src/app/api/webinars/[id]/sales/export/route.ts` — GET; auth + ownership; reads from DB; returns xlsx Buffer with `Content-Disposition: attachment; filename="vendas-<id>.xlsx"`.

### Created — Wizard pages/forms

- `apps/web/src/app/dashboard/webinars/[id]/(wizard)/step-7/page.tsx` — replaces stub. Query `prisma.saleNotification.findMany(... orderBy showAtSec)` + render `<Step7Form>`.
- `apps/web/src/components/wizard/step-7-form.tsx` — RHF `useFieldArray` over `notifications`. Left = `<WizardSectionAccordion>`. Right = `<SalesPreviewAside>` reading `useWatch({ control, name: "notifications" })`.

### Modified

- `apps/web/src/components/wizard/step-6-form.tsx` — full rewrite. Replace flat-list layout with 2-column. Migrate existing XLSX import logic into `<WizardSectionAccordion fileSection={...}>`. Existing manual editor moves into `individualSection`. New `<ChatPreviewAside>` on the right.
- `apps/web/src/server/actions/webinar.ts` — add `updateWebinarStep7(id, input: Step7Input)`. Mirrors `updateWebinarStep6` pattern: ownership check, parse, transactional `deleteMany + createMany` based on incoming ids (or simpler: full replace — delete all, re-create).
- `apps/web/src/app/[slug]/live/page.tsx` — query `saleNotifications` + pass through `<PlayerShell>`.
- `apps/web/src/app/[slug]/_components/player-shell.tsx` — accept `salesNotifications` prop; render `<SalesNotifier>`.
- `apps/web/src/app/[slug]/_lib/public-types.ts` — add `PlayerShellProps.salesNotifications: PublicSaleNotification[]`.
- `apps/web/src/lib/public-dto.ts` — add `PublicSaleNotification` type + `publicSaleNotificationDto`.
- `packages/db/prisma/schema.prisma` — `SaleNotification` model + relation.

### Deleted

- `apps/web/src/app/dashboard/webinars/[id]/(wizard)/step-7/page.tsx` (existing stub) — replaced.

## XLSX Vendas — schema

Header row exact text:

| A (Hora) | B (Minuto) | C (Segundo) | D (Nome do comprador) | E (Produto) | F (Preço) |

Row 2+: data. Empty rows or rows missing buyerName/productName are skipped. Price column optional (empty → null).

`showAtSec` computed from `H*3600 + M*60 + S` (each parsed as int, default 0).

## Search Filter (preview asides)

```ts
const filtered = q
  ? items.filter(
      (m) =>
        m.authorName.toLowerCase().includes(q.toLowerCase()) ||
        m.text.toLowerCase().includes(q.toLowerCase())
    )
  : items;
```

For sales, filter on `buyerName` and `productName` instead.

Filter is index-aware: rendered list uses `filtered.map((item, filterIdx) => ...)` but row callbacks reference original index (`onUpdate(originalIdx, ...)`) by tracking `originalIdx` on the filtered tuple.

## Toast Output (player)

Format: `🛒 {buyerName} comprou {productName}` if no price, or `🛒 {buyerName} comprou {productName} por {price}` if price set.

`duration: 6000` ms. Position: default (top-right per existing layout config).

## Tests

| File | Coverage |
|---|---|
| `test/lib/validations/step7.test.ts` | happy path, empty buyerName, productName empty, price optional, negative showAtSec |
| `test/lib/sales-xlsx.test.ts` | parseSalesXlsx with header + 3 rows; missing-field rows skipped; round-trip parse/build |
| `test/server/actions/webinar.test.ts` | extend with `updateWebinarStep7` describe — persist 2 notifs, ownership rejection, delete-and-recreate (clears prior, inserts new) |
| `test/api/sales-import.test.ts` | auth (401), ownership (404), happy parse, oversized 413, malformed file 400 |
| `test/api/sales-export.test.ts` | auth + ownership; returns xlsx buffer; correct Content-Disposition filename |
| `test/components/sales-notifier.test.tsx` | given currentTimeRef advancing, fires `toast` once per id; doesn't fire before showAtSec; multiple notifs in time order |
| `test/components/chat-preview-aside.test.tsx` | search filters by authorName + text; row delete; bulk delete; "Testar no player" link target=`_blank` |
| `test/components/sales-preview-aside.test.tsx` | mirror chat-preview tests for sales fields |
| `test/components/wizard-section-accordion.test.tsx` | 3 sections render closed by default; clicking trigger expands; AI button is disabled |

## Webhook Mapping (no changes)

D3 does not introduce new webhook events. Sale notifications are owner-side scripted content, not lead events. Future analytics integration is out of scope.

## Out of Scope

- Real AI generation (button stays `disabled` with "Em breve" tooltip).
- Sales dashboard / analytics on the dashboard.
- Sale notification randomization or per-lead targeting.
- Click-through tracking on sale toasts.
- Step 6 redesign of underlying message data model (still `ChatMessage`; only UI rearranged).
- WhatsApp / SMS integration for sale alerts.
- Multi-language toast templates.

## Acceptance Criteria

- Wizard nav still has 9 steps. Step 7 (Vendas) is no longer a stub — opens functional form.
- Step 6: 2-column layout. Accordion expands per click. AI button disabled with "Em breve" tooltip. XLSX upload still works (no regression). Manual editor + preview list both reflect the same `messages` array via RHF state.
- Step 7: same layout. XLSX import parses 6-col schema. Preview right shows sales rows with HH:MM:SS / buyerName / productName / price inputs + delete. Export XLSX downloads correctly.
- DB: `SaleNotification` table created. `updateWebinarStep7` persists 0..N rows. `duplicateWebinar` is NOT updated to clone sales (out of scope; can be added later if requested).
- Player: visiting `/<slug>/live` after configuring sales fires sonner toasts at the right times. Each toast appears once per session.
- All tests + typecheck green.
