# MVP Sub-plan D3 — Chat Redesign + Vendas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild Step 6 (Chat) layout to match the original Hotwebinar UI (2-column with accordion sections + preview aside) and add a brand-new Step 7 (Vendas) with the same pattern. Player surfaces sale notifications as sonner toast popups during playback.

**Architecture:** Step 6 + Step 7 share a 2-column grid (`[1fr_minmax(0,420px)]`) and a `<WizardSectionAccordion>` primitive (3 collapsible sections: AI stub / file XLSX / individual editor). Right column is a preview aside with search + always-editable rows + per-row delete + bulk actions. Sale notifications persist in a new `SaleNotification` Prisma table. Player loads them and fires sonner toasts when timeline crosses each `showAtSec` (one shot per id per session).

**Tech Stack:** Next.js 15 App Router (Turbopack), Prisma 5 + Postgres, Zod, react-hook-form, shadcn/ui, lucide-react, vitest + @testing-library/react, sonner, exceljs, Radix Accordion + Tooltip.

---

## File Structure

### Created

| Path | Responsibility |
|---|---|
| `packages/db/prisma/migrations/20260505220000_d3_sales_notifications/migration.sql` | New SaleNotification table |
| `apps/web/src/lib/sales-xlsx.ts` | Parse + build sales XLSX (`Hora|Min|Seg|Comprador|Produto|Preço`) |
| `apps/web/src/components/ui/accordion.tsx` | shadcn Accordion primitive |
| `apps/web/src/components/ui/tooltip.tsx` | shadcn Tooltip primitive |
| `apps/web/src/components/wizard/ai-stub-section.tsx` | "Novidade" badge + disabled "Gerar com IA" button + tooltip "Em breve" |
| `apps/web/src/components/wizard/wizard-section-accordion.tsx` | Shared 3-section accordion (AI / file / individual) |
| `apps/web/src/components/wizard/chat-preview-aside.tsx` | Right-column preview for Step 6 (search + editable rows + delete + Export XLSX + Testar player) |
| `apps/web/src/components/wizard/sales-preview-aside.tsx` | Right-column preview for Step 7 (same pattern, sales fields) |
| `apps/web/src/components/wizard/step-7-form.tsx` | NEW — vendas form (replaces stub) |
| `apps/web/src/app/api/webinars/[id]/sales/import/route.ts` | POST — parse FormData xlsx, return notifications |
| `apps/web/src/app/api/webinars/[id]/sales/export/route.ts` | GET — return xlsx download |
| `apps/web/src/app/[slug]/_components/sales-notifier.tsx` | Client — fires sonner toast per notif when timeline crosses showAtSec |
| `apps/web/src/test/lib/validations/step7.test.ts` | step7Schema unit tests |
| `apps/web/src/test/lib/sales-xlsx.test.ts` | parse + build round-trip |
| `apps/web/src/test/api/sales-import.test.ts` | upload route tests |
| `apps/web/src/test/api/sales-export.test.ts` | download route tests |
| `apps/web/src/test/components/sales-notifier.test.tsx` | toast firing logic |
| `apps/web/src/test/components/wizard-section-accordion.test.tsx` | section render + AI button disabled |
| `apps/web/src/test/components/chat-preview-aside.test.tsx` | search + delete + bulk delete |
| `apps/web/src/test/components/sales-preview-aside.test.tsx` | mirror for sales |

### Modified

| Path | Reason |
|---|---|
| `packages/db/prisma/schema.prisma` | Add `SaleNotification` model + Webinar relation |
| `apps/web/src/lib/validations/webinar.ts` | Add `saleItemSchema` + `step7Schema` + `Step7Input` + `SaleItem` |
| `apps/web/src/server/actions/webinar.ts` | Add `updateWebinarStep7`. Mirrors step6 transactional delete-and-create pattern. |
| `apps/web/src/app/dashboard/webinars/[id]/(wizard)/step-7/page.tsx` | Replace stub with real form |
| `apps/web/src/components/wizard/step-6-form.tsx` | Full rewrite — 2-column + accordion sections + preview aside |
| `apps/web/src/lib/public-dto.ts` | Add `PublicSaleNotification` type + `publicSaleNotificationDto` |
| `apps/web/src/app/[slug]/_lib/public-types.ts` | Add `salesNotifications: PublicSaleNotification[]` to PlayerShellProps |
| `apps/web/src/app/[slug]/live/page.tsx` | Query `saleNotifications` + pass to PlayerShell |
| `apps/web/src/app/[slug]/_components/player-shell.tsx` | Render `<SalesNotifier>` |
| `apps/web/src/test/server/actions/webinar.test.ts` | Add `updateWebinarStep7` describe |
| `README.md` | Document D3 changes |

---

## Task Plan (18 tasks)

---

### Task 1: Migration + schema + Prisma generate

**Files:**
- Create: `packages/db/prisma/migrations/20260505220000_d3_sales_notifications/migration.sql`
- Modify: `packages/db/prisma/schema.prisma`

- [ ] **Step 1: Add `SaleNotification` model + Webinar relation in `packages/db/prisma/schema.prisma`**

Add at the end of file (after other models):

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

In `model Webinar { ... }`, add this line in the relations group (near `chatMessages`, `events`, etc.):

```prisma
  saleNotifications       SaleNotification[]
```

- [ ] **Step 2: Create `migration.sql`**

```sql
CREATE TABLE "sale_notification" (
  "id"          TEXT NOT NULL,
  "webinarId"   TEXT NOT NULL,
  "showAtSec"   INTEGER NOT NULL,
  "buyerName"   TEXT NOT NULL,
  "productName" TEXT NOT NULL,
  "price"       TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sale_notification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "sale_notification_webinarId_showAtSec_idx"
  ON "sale_notification"("webinarId", "showAtSec");

ALTER TABLE "sale_notification"
  ADD CONSTRAINT "sale_notification_webinarId_fkey"
  FOREIGN KEY ("webinarId") REFERENCES "webinar"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
```

- [ ] **Step 3: Apply + regenerate**

```bash
pnpm --filter db prisma migrate dev --name d3_sales_notifications
pnpm --filter db prisma generate
pnpm --filter db prisma format
```

Expected: "Migration applied" + Prisma client emits `SaleNotification` model.

- [ ] **Step 4: Commit**

```bash
git add packages/db/prisma/schema.prisma packages/db/prisma/migrations/20260505220000_d3_sales_notifications
git commit -m "feat(db): D3 schema — add SaleNotification model"
```

---

### Task 2: Validations — step7Schema + saleItemSchema

**Files:**
- Modify: `apps/web/src/lib/validations/webinar.ts`
- Create: `apps/web/src/test/lib/validations/step7.test.ts`

- [ ] **Step 1: Write failing test `apps/web/src/test/lib/validations/step7.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { step7Schema } from "@/lib/validations/webinar";

const VALID = {
  notifications: [
    { showAtSec: 60, buyerName: "João", productName: "Curso A", price: "R$ 297" },
    { showAtSec: 120, buyerName: "Maria", productName: "Mentoria", price: null }
  ]
};

describe("step7Schema", () => {
  it("accepts valid notifications", () => {
    expect(step7Schema.safeParse(VALID).success).toBe(true);
  });
  it("accepts empty notifications array", () => {
    expect(step7Schema.safeParse({ notifications: [] }).success).toBe(true);
  });
  it("rejects empty buyerName", () => {
    expect(step7Schema.safeParse({ notifications: [{ ...VALID.notifications[0], buyerName: "" }] }).success).toBe(false);
  });
  it("rejects empty productName", () => {
    expect(step7Schema.safeParse({ notifications: [{ ...VALID.notifications[0], productName: "" }] }).success).toBe(false);
  });
  it("rejects negative showAtSec", () => {
    expect(step7Schema.safeParse({ notifications: [{ ...VALID.notifications[0], showAtSec: -1 }] }).success).toBe(false);
  });
  it("treats price as optional + nullable", () => {
    const r = step7Schema.safeParse({ notifications: [{ showAtSec: 0, buyerName: "X", productName: "Y" }] });
    expect(r.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run, verify failure**

```bash
pnpm --filter web exec vitest run src/test/lib/validations/step7.test.ts
```

Expected: FAIL — `step7Schema` not exported.

- [ ] **Step 3: Add exports to `apps/web/src/lib/validations/webinar.ts`**

After `step6Schema` exports, append:

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

- [ ] **Step 4: Run test**

```bash
pnpm --filter web exec vitest run src/test/lib/validations/step7.test.ts
```

Expected: PASS (6/6).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/validations/webinar.ts apps/web/src/test/lib/validations/step7.test.ts
git commit -m "feat(web): D3 step7Schema + saleItemSchema validations"
```

---

### Task 3: lib/sales-xlsx — parse + build

**Files:**
- Create: `apps/web/src/lib/sales-xlsx.ts`
- Create: `apps/web/src/test/lib/sales-xlsx.test.ts`

- [ ] **Step 1: Write failing test `apps/web/src/test/lib/sales-xlsx.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { parseSalesXlsx, buildSalesXlsx, type ParsedSale } from "@/lib/sales-xlsx";

const SAMPLE: ParsedSale[] = [
  { showAtSec: 0, buyerName: "Ana", productName: "Curso A", price: "R$ 297" },
  { showAtSec: 65, buyerName: "Bruno", productName: "Mentoria", price: null },
  { showAtSec: 3725, buyerName: "Carla", productName: "Combo", price: "12x R$ 47" }
];

describe("sales-xlsx", () => {
  it("buildSalesXlsx round-trips through parseSalesXlsx", async () => {
    const buf = await buildSalesXlsx(SAMPLE);
    const parsed = await parseSalesXlsx(buf);
    expect(parsed).toHaveLength(3);
    expect(parsed[0]).toEqual({ ...SAMPLE[0], price: "R$ 297" });
    expect(parsed[1].price).toBeNull();
    expect(parsed[2].showAtSec).toBe(3725);
  });
  it("skips rows missing buyerName or productName", async () => {
    const buf = await buildSalesXlsx([
      { showAtSec: 0, buyerName: "", productName: "X", price: null },
      { showAtSec: 10, buyerName: "Y", productName: "", price: null },
      { showAtSec: 20, buyerName: "OK", productName: "Z", price: null }
    ]);
    const parsed = await parseSalesXlsx(buf);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].buyerName).toBe("OK");
  });
});
```

- [ ] **Step 2: Run, verify failure**

```bash
pnpm --filter web exec vitest run src/test/lib/sales-xlsx.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `apps/web/src/lib/sales-xlsx.ts`**

```ts
import ExcelJS from "exceljs";

export interface ParsedSale {
  showAtSec: number;
  buyerName: string;
  productName: string;
  price: string | null;
}

export async function parseSalesXlsx(buffer: ArrayBuffer | Buffer): Promise<ParsedSale[]> {
  const wb = new ExcelJS.Workbook();
  const buf = buffer instanceof ArrayBuffer ? Buffer.from(buffer) : buffer;
  await wb.xlsx.load(buf);
  const sheet = wb.worksheets[0];
  if (!sheet) return [];

  const rows: ParsedSale[] = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNum) => {
    if (rowNum === 1) return;
    const h = String(row.getCell(1).value ?? "").trim();
    const m = String(row.getCell(2).value ?? "").trim();
    const s = String(row.getCell(3).value ?? "").trim();
    const buyer = String(row.getCell(4).value ?? "").trim();
    const product = String(row.getCell(5).value ?? "").trim();
    const price = String(row.getCell(6).value ?? "").trim();
    if (!buyer || !product) return;
    const sec =
      (Number.parseInt(h || "0", 10) || 0) * 3600 +
      (Number.parseInt(m || "0", 10) || 0) * 60 +
      (Number.parseInt(s || "0", 10) || 0);
    rows.push({
      showAtSec: sec,
      buyerName: buyer.slice(0, 80),
      productName: product.slice(0, 120),
      price: price ? price.slice(0, 20) : null
    });
  });
  return rows;
}

export async function buildSalesXlsx(notifications: ParsedSale[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet("Vendas");
  sheet.columns = [
    { header: "Hora", key: "h", width: 8 },
    { header: "Minuto", key: "m", width: 10 },
    { header: "Segundo", key: "s", width: 10 },
    { header: "Nome do comprador", key: "buyer", width: 24 },
    { header: "Produto", key: "product", width: 36 },
    { header: "Preço", key: "price", width: 18 }
  ];
  for (const n of notifications) {
    const h = Math.floor(n.showAtSec / 3600);
    const m = Math.floor((n.showAtSec % 3600) / 60);
    const s = n.showAtSec % 60;
    sheet.addRow({
      h: String(h).padStart(2, "0"),
      m: String(m).padStart(2, "0"),
      s: String(s).padStart(2, "0"),
      buyer: n.buyerName,
      product: n.productName,
      price: n.price ?? ""
    });
  }
  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out);
}
```

- [ ] **Step 4: Run test**

```bash
pnpm --filter web exec vitest run src/test/lib/sales-xlsx.test.ts
```

Expected: PASS (2/2).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/sales-xlsx.ts apps/web/src/test/lib/sales-xlsx.test.ts
git commit -m "feat(web): D3 sales-xlsx parse + build helpers"
```

---

### Task 4: shadcn Accordion + Tooltip primitives

**Files:**
- Create: `apps/web/src/components/ui/accordion.tsx`
- Create: `apps/web/src/components/ui/tooltip.tsx`
- Modify: `apps/web/package.json` (auto via pnpm)

- [ ] **Step 1: Install Radix primitives**

```bash
pnpm --filter web add @radix-ui/react-accordion @radix-ui/react-tooltip
```

Note: pnpm will warn about react peer dep (we're on 19 RC). Warning is fine; continue.

- [ ] **Step 2: Create `apps/web/src/components/ui/accordion.tsx`** (standard shadcn Accordion source)

```tsx
"use client";
import * as React from "react";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const Accordion = AccordionPrimitive.Root;

const AccordionItem = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>
>(({ className, ...props }, ref) => (
  <AccordionPrimitive.Item ref={ref} className={cn("border-b", className)} {...props} />
));
AccordionItem.displayName = "AccordionItem";

const AccordionTrigger = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Header className="flex">
    <AccordionPrimitive.Trigger
      ref={ref}
      className={cn(
        "flex flex-1 items-center justify-between py-4 text-sm font-medium transition-all hover:underline [&[data-state=open]>svg]:rotate-180",
        className
      )}
      {...props}
    >
      {children}
      <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200" />
    </AccordionPrimitive.Trigger>
  </AccordionPrimitive.Header>
));
AccordionTrigger.displayName = AccordionPrimitive.Trigger.displayName;

const AccordionContent = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Content
    ref={ref}
    className="overflow-hidden text-sm data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down"
    {...props}
  >
    <div className={cn("pb-4 pt-0", className)}>{children}</div>
  </AccordionPrimitive.Content>
));
AccordionContent.displayName = AccordionPrimitive.Content.displayName;

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };
```

- [ ] **Step 3: Create `apps/web/src/components/ui/tooltip.tsx`**

```tsx
"use client";
import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cn } from "@/lib/utils";

const TooltipProvider = TooltipPrimitive.Provider;
const Tooltip = TooltipPrimitive.Root;
const TooltipTrigger = TooltipPrimitive.Trigger;

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Content
    ref={ref}
    sideOffset={sideOffset}
    className={cn(
      "z-50 overflow-hidden rounded-md border bg-popover px-3 py-1.5 text-xs text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95",
      className
    )}
    {...props}
  />
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
```

- [ ] **Step 4: Verify typecheck**

```bash
pnpm --filter web exec tsc --noEmit 2>&1 | grep -E "ui/(accordion|tooltip)" | head
```

Expected: zero errors specific to these files.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/ui/accordion.tsx apps/web/src/components/ui/tooltip.tsx apps/web/package.json pnpm-lock.yaml
git commit -m "feat(web): add shadcn Accordion + Tooltip primitives"
```

---

### Task 5: AI stub section component

**Files:**
- Create: `apps/web/src/components/wizard/ai-stub-section.tsx`

- [ ] **Step 1: Implement `apps/web/src/components/wizard/ai-stub-section.tsx`**

```tsx
"use client";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export interface AiStubSectionProps {
  badge: string;
  title: string;
  description: string;
  cta: string;
}

export function AiStubSection({ badge, title, description, cta }: AiStubSectionProps) {
  return (
    <div className="rounded-lg bg-muted/40 p-4">
      <span className="inline-block rounded-full bg-destructive px-3 py-0.5 text-xs font-semibold uppercase text-destructive-foreground">
        {badge}
      </span>
      <h3 className="mt-3 text-lg font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span tabIndex={0} className="mt-4 block">
              <Button type="button" disabled className="w-full bg-emerald-700 text-white hover:bg-emerald-700">
                <Sparkles className="mr-2 h-4 w-4" />
                {cta}
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>Em breve</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
```

- [ ] **Step 2: Verify**

```bash
pnpm --filter web exec tsc --noEmit 2>&1 | grep ai-stub | head
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/wizard/ai-stub-section.tsx
git commit -m "feat(web): D3 AiStubSection — disabled CTA + 'Em breve' tooltip"
```

---

### Task 6: WizardSectionAccordion shared component

**Files:**
- Create: `apps/web/src/components/wizard/wizard-section-accordion.tsx`
- Create: `apps/web/src/test/components/wizard-section-accordion.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { WizardSectionAccordion } from "@/components/wizard/wizard-section-accordion";

describe("WizardSectionAccordion", () => {
  it("renders 3 triggers (AI / arquivo / individual)", () => {
    render(
      <WizardSectionAccordion
        ai={<div>AI content</div>}
        fileTitle="Crie via arquivo"
        fileSection={<div>FILE</div>}
        individualTitle="Crie individual"
        individualSection={<div>INDIVIDUAL</div>}
      />
    );
    expect(screen.getByText(/Automação/i)).toBeInTheDocument();
    expect(screen.getByText("Crie via arquivo")).toBeInTheDocument();
    expect(screen.getByText("Crie individual")).toBeInTheDocument();
  });
  it("expands a section when its trigger is clicked", () => {
    render(
      <WizardSectionAccordion
        ai={<div>AI content</div>}
        fileTitle="Crie via arquivo"
        fileSection={<div>FILE_SECTION</div>}
        individualTitle="Crie individual"
        individualSection={<div>INDIVIDUAL_SECTION</div>}
      />
    );
    fireEvent.click(screen.getByText("Crie via arquivo"));
    expect(screen.getByText("FILE_SECTION")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run, verify failure**

```bash
pnpm --filter web exec vitest run src/test/components/wizard-section-accordion.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `apps/web/src/components/wizard/wizard-section-accordion.tsx`**

```tsx
"use client";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export interface WizardSectionAccordionProps {
  ai: React.ReactNode;
  fileTitle: string;
  fileSection: React.ReactNode;
  individualTitle: string;
  individualSection: React.ReactNode;
}

export function WizardSectionAccordion({ ai, fileTitle, fileSection, individualTitle, individualSection }: WizardSectionAccordionProps) {
  return (
    <div className="space-y-3">
      {ai}
      <Accordion type="single" collapsible className="rounded-lg border bg-card">
        <AccordionItem value="file">
          <AccordionTrigger className="px-4">{fileTitle}</AccordionTrigger>
          <AccordionContent className="px-4">{fileSection}</AccordionContent>
        </AccordionItem>
        <AccordionItem value="individual" className="border-b-0">
          <AccordionTrigger className="px-4">{individualTitle}</AccordionTrigger>
          <AccordionContent className="px-4">{individualSection}</AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
```

(Note: AI section renders OUTSIDE the accordion as a permanent featured card per Hotwebinar layout. The two real accordion items are file + individual.)

- [ ] **Step 4: Run test**

```bash
pnpm --filter web exec vitest run src/test/components/wizard-section-accordion.test.tsx
```

Expected: PASS (2/2).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/wizard/wizard-section-accordion.tsx apps/web/src/test/components/wizard-section-accordion.test.tsx
git commit -m "feat(web): D3 WizardSectionAccordion — AI card + file/individual collapsibles"
```

---

### Task 7: Chat preview aside

**Files:**
- Create: `apps/web/src/components/wizard/chat-preview-aside.tsx`
- Create: `apps/web/src/test/components/chat-preview-aside.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChatPreviewAside } from "@/components/wizard/chat-preview-aside";

const ITEMS = [
  { id: "1", authorName: "Ana", text: "Hello world", showAtSec: 5, isOwner: false },
  { id: "2", authorName: "Bob", text: "Spam spam", showAtSec: 10, isOwner: false },
  { id: "3", authorName: "Carol", text: "Hi Ana!", showAtSec: 15, isOwner: false }
];

describe("ChatPreviewAside", () => {
  it("renders all rows when search is empty", () => {
    render(
      <ChatPreviewAside webinarId="w1" slug="demo" messages={ITEMS} onUpdate={() => {}} onDelete={() => {}} onDeleteAll={() => {}} />
    );
    expect(screen.getAllByDisplayValue(/Ana|Bob|Carol/)).toHaveLength(3);
  });
  it("filters rows by authorName when typing in search", () => {
    render(
      <ChatPreviewAside webinarId="w1" slug="demo" messages={ITEMS} onUpdate={() => {}} onDelete={() => {}} onDeleteAll={() => {}} />
    );
    fireEvent.change(screen.getByPlaceholderText(/buscar/i), { target: { value: "ana" } });
    expect(screen.getByDisplayValue("Ana")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("Bob")).toBeNull();
  });
  it("calls onDelete with original index when trash is clicked on a filtered row", () => {
    const onDelete = vi.fn();
    render(
      <ChatPreviewAside webinarId="w1" slug="demo" messages={ITEMS} onUpdate={() => {}} onDelete={onDelete} onDeleteAll={() => {}} />
    );
    fireEvent.change(screen.getByPlaceholderText(/buscar/i), { target: { value: "carol" } });
    fireEvent.click(screen.getAllByLabelText(/Remover/i)[0]);
    expect(onDelete).toHaveBeenCalledWith(2);
  });
  it("calls onDeleteAll when 'Excluir todo' clicked", () => {
    const onDeleteAll = vi.fn();
    render(
      <ChatPreviewAside webinarId="w1" slug="demo" messages={ITEMS} onUpdate={() => {}} onDelete={() => {}} onDeleteAll={onDeleteAll} />
    );
    fireEvent.click(screen.getByRole("button", { name: /excluir todo/i }));
    expect(onDeleteAll).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run, verify failure**

```bash
pnpm --filter web exec vitest run src/test/components/chat-preview-aside.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `apps/web/src/components/wizard/chat-preview-aside.tsx`**

```tsx
"use client";
import { useState } from "react";
import { Download, Search, Trash2, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SecondsInput } from "@/components/ui/seconds-input";

export interface ChatRowValue {
  id?: string;
  authorName: string;
  text: string;
  showAtSec: number;
  isOwner: boolean;
}

export interface ChatPreviewAsideProps {
  webinarId: string;
  slug: string | null;
  messages: ChatRowValue[];
  onUpdate: (originalIdx: number, patch: Partial<ChatRowValue>) => void;
  onDelete: (originalIdx: number) => void;
  onDeleteAll: () => void;
}

export function ChatPreviewAside({ webinarId, slug, messages, onUpdate, onDelete, onDeleteAll }: ChatPreviewAsideProps) {
  const [q, setQ] = useState("");
  const filtered = q
    ? messages
        .map((m, i) => [m, i] as const)
        .filter(([m]) => m.authorName.toLowerCase().includes(q.toLowerCase()) || m.text.toLowerCase().includes(q.toLowerCase()))
    : messages.map((m, i) => [m, i] as const);

  return (
    <aside className="flex h-fit flex-col gap-3 rounded-lg border bg-card p-4">
      <h3 className="text-sm font-semibold">Prévia do chat</h3>
      <Button asChild type="button" className="w-full bg-emerald-800 text-white hover:bg-emerald-900">
        <a href={`/api/webinars/${webinarId}/messages/export`} download>
          <Download className="mr-2 h-4 w-4" /> Exportar mensagens em XLSX
        </a>
      </Button>
      <div className="relative">
        <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          placeholder="Buscar mensagens"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="pl-8"
        />
      </div>
      <div className="max-h-[480px] space-y-2 overflow-y-auto pr-1">
        {filtered.map(([m, originalIdx]) => (
          <div key={m.id ?? `idx-${originalIdx}`} className="grid grid-cols-[80px_1fr_auto] items-center gap-2 rounded-md border p-2">
            <SecondsInput
              value={m.showAtSec}
              onChange={(v) => onUpdate(originalIdx, { showAtSec: v })}
              aria-label="Tempo"
            />
            <div className="space-y-1">
              <Input
                value={m.authorName}
                onChange={(e) => onUpdate(originalIdx, { authorName: e.target.value })}
                placeholder="Nome"
                className="h-8 text-sm"
              />
              <Input
                value={m.text}
                onChange={(e) => onUpdate(originalIdx, { text: e.target.value })}
                placeholder="Mensagem"
                className="h-8 text-sm"
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onDelete(originalIdx)}
              aria-label="Remover"
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ))}
        {filtered.length === 0 && <p className="text-center text-xs text-muted-foreground">Nenhuma mensagem.</p>}
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="outline" className="flex-1 text-destructive" onClick={onDeleteAll}>
          <Trash2 className="mr-2 h-4 w-4" /> Excluir todo o chat
        </Button>
        {slug ? (
          <Button asChild type="button" className="flex-1 bg-emerald-800 text-white hover:bg-emerald-900">
            <a href={`/${slug}/live`} target="_blank" rel="noopener noreferrer">
              <Rocket className="mr-2 h-4 w-4" /> Testar no player
            </a>
          </Button>
        ) : null}
      </div>
    </aside>
  );
}
```

- [ ] **Step 4: Run test**

```bash
pnpm --filter web exec vitest run src/test/components/chat-preview-aside.test.tsx
```

Expected: PASS (4/4).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/wizard/chat-preview-aside.tsx apps/web/src/test/components/chat-preview-aside.test.tsx
git commit -m "feat(web): D3 ChatPreviewAside — search + editable rows + delete + export + testar player"
```

---

### Task 8: Sales preview aside

**Files:**
- Create: `apps/web/src/components/wizard/sales-preview-aside.tsx`
- Create: `apps/web/src/test/components/sales-preview-aside.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SalesPreviewAside } from "@/components/wizard/sales-preview-aside";

const ITEMS = [
  { id: "1", buyerName: "Ana", productName: "Curso A", showAtSec: 5, price: "R$ 297" },
  { id: "2", buyerName: "Bob", productName: "Mentoria", showAtSec: 10, price: null },
  { id: "3", buyerName: "Carol", productName: "Combo Ana", showAtSec: 15, price: "12x" }
];

describe("SalesPreviewAside", () => {
  it("filters by buyerName + productName", () => {
    render(
      <SalesPreviewAside webinarId="w1" slug="demo" notifications={ITEMS} onUpdate={() => {}} onDelete={() => {}} onDeleteAll={() => {}} />
    );
    fireEvent.change(screen.getByPlaceholderText(/buscar/i), { target: { value: "ana" } });
    expect(screen.getByDisplayValue("Ana")).toBeInTheDocument();
    // "Combo Ana" matches productName
    expect(screen.getByDisplayValue("Combo Ana")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("Bob")).toBeNull();
  });
  it("calls onDelete with original index", () => {
    const onDelete = vi.fn();
    render(
      <SalesPreviewAside webinarId="w1" slug="demo" notifications={ITEMS} onUpdate={() => {}} onDelete={onDelete} onDeleteAll={() => {}} />
    );
    fireEvent.click(screen.getAllByLabelText(/Remover/i)[1]);
    expect(onDelete).toHaveBeenCalledWith(1);
  });
});
```

- [ ] **Step 2: Run, verify failure**

```bash
pnpm --filter web exec vitest run src/test/components/sales-preview-aside.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `apps/web/src/components/wizard/sales-preview-aside.tsx`**

```tsx
"use client";
import { useState } from "react";
import { Download, Search, Trash2, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SecondsInput } from "@/components/ui/seconds-input";

export interface SaleRowValue {
  id?: string;
  buyerName: string;
  productName: string;
  showAtSec: number;
  price: string | null;
}

export interface SalesPreviewAsideProps {
  webinarId: string;
  slug: string | null;
  notifications: SaleRowValue[];
  onUpdate: (originalIdx: number, patch: Partial<SaleRowValue>) => void;
  onDelete: (originalIdx: number) => void;
  onDeleteAll: () => void;
}

export function SalesPreviewAside({ webinarId, slug, notifications, onUpdate, onDelete, onDeleteAll }: SalesPreviewAsideProps) {
  const [q, setQ] = useState("");
  const filtered = q
    ? notifications
        .map((m, i) => [m, i] as const)
        .filter(([m]) => m.buyerName.toLowerCase().includes(q.toLowerCase()) || m.productName.toLowerCase().includes(q.toLowerCase()))
    : notifications.map((m, i) => [m, i] as const);

  return (
    <aside className="flex h-fit flex-col gap-3 rounded-lg border bg-card p-4">
      <h3 className="text-sm font-semibold">Prévia das vendas</h3>
      <Button asChild type="button" className="w-full bg-emerald-800 text-white hover:bg-emerald-900">
        <a href={`/api/webinars/${webinarId}/sales/export`} download>
          <Download className="mr-2 h-4 w-4" /> Exportar vendas em XLSX
        </a>
      </Button>
      <div className="relative">
        <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          placeholder="Buscar vendas"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="pl-8"
        />
      </div>
      <div className="max-h-[480px] space-y-2 overflow-y-auto pr-1">
        {filtered.map(([n, originalIdx]) => (
          <div key={n.id ?? `idx-${originalIdx}`} className="grid grid-cols-[80px_1fr_auto] items-center gap-2 rounded-md border p-2">
            <SecondsInput
              value={n.showAtSec}
              onChange={(v) => onUpdate(originalIdx, { showAtSec: v })}
              aria-label="Tempo"
            />
            <div className="space-y-1">
              <Input
                value={n.buyerName}
                onChange={(e) => onUpdate(originalIdx, { buyerName: e.target.value })}
                placeholder="Comprador"
                className="h-8 text-sm"
              />
              <Input
                value={n.productName}
                onChange={(e) => onUpdate(originalIdx, { productName: e.target.value })}
                placeholder="Produto"
                className="h-8 text-sm"
              />
              <Input
                value={n.price ?? ""}
                onChange={(e) => onUpdate(originalIdx, { price: e.target.value || null })}
                placeholder="Preço (opcional)"
                className="h-8 text-sm"
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onDelete(originalIdx)}
              aria-label="Remover"
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ))}
        {filtered.length === 0 && <p className="text-center text-xs text-muted-foreground">Nenhuma venda.</p>}
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="outline" className="flex-1 text-destructive" onClick={onDeleteAll}>
          <Trash2 className="mr-2 h-4 w-4" /> Excluir todas as vendas
        </Button>
        {slug ? (
          <Button asChild type="button" className="flex-1 bg-emerald-800 text-white hover:bg-emerald-900">
            <a href={`/${slug}/live`} target="_blank" rel="noopener noreferrer">
              <Rocket className="mr-2 h-4 w-4" /> Testar no player
            </a>
          </Button>
        ) : null}
      </div>
    </aside>
  );
}
```

- [ ] **Step 4: Run test**

```bash
pnpm --filter web exec vitest run src/test/components/sales-preview-aside.test.tsx
```

Expected: PASS (2/2).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/wizard/sales-preview-aside.tsx apps/web/src/test/components/sales-preview-aside.test.tsx
git commit -m "feat(web): D3 SalesPreviewAside — same pattern, sales fields"
```

---

### Task 9: API /sales/import route

**Files:**
- Create: `apps/web/src/app/api/webinars/[id]/sales/import/route.ts`
- Create: `apps/web/src/test/api/sales-import.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { prisma } from "db";
import { buildSalesXlsx } from "@/lib/sales-xlsx";

const TEST_USER = { id: "si-user", email: "si@example.com", name: "SI" };

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: async () => ({ user: { id: TEST_USER.id } }) } }
}));

beforeEach(async () => {
  await prisma.saleNotification.deleteMany({});
  await prisma.webinar.deleteMany({});
  await prisma.session.deleteMany({});
  await prisma.account.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.user.create({ data: TEST_USER });
});

afterAll(async () => prisma.$disconnect());

async function makeWebinar(ownerId = TEST_USER.id) {
  return prisma.webinar.create({
    data: { ownerId, name: "T", title: "T", slug: "si-" + Math.random().toString(36).slice(2, 6) }
  });
}

describe("POST /api/webinars/[id]/sales/import", () => {
  it("parses xlsx and returns notifications", async () => {
    const w = await makeWebinar();
    const buf = await buildSalesXlsx([
      { showAtSec: 60, buyerName: "Ana", productName: "Curso A", price: "R$ 297" },
      { showAtSec: 120, buyerName: "Bob", productName: "Mentoria", price: null }
    ]);
    const fd = new FormData();
    fd.set("file", new File([buf], "vendas.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    const { POST } = await import("@/app/api/webinars/[id]/sales/import/route");
    const res = await POST(new Request("http://localhost/x", { method: "POST", body: fd }), { params: Promise.resolve({ id: w.id }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.notifications).toHaveLength(2);
    expect(json.notifications[0].buyerName).toBe("Ana");
  });
  it("rejects when webinar belongs to another user", async () => {
    await prisma.user.create({ data: { id: "other", email: "o@e.com", name: "O" } });
    const w = await makeWebinar("other");
    const fd = new FormData();
    fd.set("file", new File([new Uint8Array([1])], "x.xlsx"));
    const { POST } = await import("@/app/api/webinars/[id]/sales/import/route?" + Date.now());
    const res = await POST(new Request("http://localhost/x", { method: "POST", body: fd }), { params: Promise.resolve({ id: w.id }) });
    expect(res.status).toBe(404);
  });
  it("rejects missing file with 400", async () => {
    const w = await makeWebinar();
    const fd = new FormData();
    const { POST } = await import("@/app/api/webinars/[id]/sales/import/route?" + (Date.now() + 1));
    const res = await POST(new Request("http://localhost/x", { method: "POST", body: fd }), { params: Promise.resolve({ id: w.id }) });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run, verify failure**

```bash
pnpm --filter web exec vitest run src/test/api/sales-import.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `apps/web/src/app/api/webinars/[id]/sales/import/route.ts`**

```ts
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "db";
import { parseSalesXlsx } from "@/lib/sales-xlsx";

const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const webinar = await prisma.webinar.findUnique({ where: { id } });
  if (!webinar || webinar.ownerId !== session.user.id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const fd = await request.formData().catch(() => null);
  const file = fd?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "missing_file" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "too_large", maxBytes: MAX_BYTES }, { status: 413 });
  }

  let notifications;
  try {
    const buf = await file.arrayBuffer();
    notifications = await parseSalesXlsx(buf);
  } catch {
    return NextResponse.json({ error: "parse_failed", message: "Não foi possível ler o XLSX" }, { status: 400 });
  }

  return NextResponse.json({ notifications });
}
```

- [ ] **Step 4: Run test**

```bash
pnpm --filter web exec vitest run src/test/api/sales-import.test.ts
```

Expected: PASS (3/3).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/webinars/[id]/sales/import/route.ts apps/web/src/test/api/sales-import.test.ts
git commit -m "feat(web): D3 sales import route — auth + ownership + parse"
```

---

### Task 10: API /sales/export route

**Files:**
- Create: `apps/web/src/app/api/webinars/[id]/sales/export/route.ts`
- Create: `apps/web/src/test/api/sales-export.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { prisma } from "db";

const TEST_USER = { id: "se-user", email: "se@example.com", name: "SE" };

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: async () => ({ user: { id: TEST_USER.id } }) } }
}));

beforeEach(async () => {
  await prisma.saleNotification.deleteMany({});
  await prisma.webinar.deleteMany({});
  await prisma.session.deleteMany({});
  await prisma.account.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.user.create({ data: TEST_USER });
});

afterAll(async () => prisma.$disconnect());

describe("GET /api/webinars/[id]/sales/export", () => {
  it("returns xlsx with attachment disposition + at least 1 row", async () => {
    const w = await prisma.webinar.create({
      data: { ownerId: TEST_USER.id, name: "T", title: "T", slug: "se-1" }
    });
    await prisma.saleNotification.create({
      data: { webinarId: w.id, showAtSec: 60, buyerName: "Ana", productName: "Curso", price: "R$ 99" }
    });
    const { GET } = await import("@/app/api/webinars/[id]/sales/export/route");
    const res = await GET(new Request("http://localhost/x"), { params: Promise.resolve({ id: w.id }) });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("spreadsheetml");
    expect(res.headers.get("content-disposition")).toContain(`vendas-${w.id}.xlsx`);
    const ab = await res.arrayBuffer();
    expect(ab.byteLength).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run, verify failure**

```bash
pnpm --filter web exec vitest run src/test/api/sales-export.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `apps/web/src/app/api/webinars/[id]/sales/export/route.ts`**

```ts
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "db";
import { buildSalesXlsx } from "@/lib/sales-xlsx";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const webinar = await prisma.webinar.findUnique({ where: { id } });
  if (!webinar || webinar.ownerId !== session.user.id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const notifications = await prisma.saleNotification.findMany({
    where: { webinarId: id },
    orderBy: { showAtSec: "asc" }
  });

  const buf = await buildSalesXlsx(
    notifications.map((n) => ({
      showAtSec: n.showAtSec,
      buyerName: n.buyerName,
      productName: n.productName,
      price: n.price
    }))
  );

  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="vendas-${id}.xlsx"`
    }
  });
}
```

- [ ] **Step 4: Run test**

```bash
pnpm --filter web exec vitest run src/test/api/sales-export.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/webinars/[id]/sales/export/route.ts apps/web/src/test/api/sales-export.test.ts
git commit -m "feat(web): D3 sales export route — xlsx download"
```

---

### Task 11: updateWebinarStep7 server action

**Files:**
- Modify: `apps/web/src/server/actions/webinar.ts`
- Modify: `apps/web/src/test/server/actions/webinar.test.ts`

- [ ] **Step 1: Add failing test**

In `apps/web/src/test/server/actions/webinar.test.ts`, add this describe block (place after the existing `updateWebinarStep5 (offer)` describe):

```ts
describe("updateWebinarStep7", () => {
  it("persists notifications + replaces on subsequent calls", async () => {
    const { createDraftWebinar, updateWebinarStep7 } = await import("@/server/actions/webinar?" + Date.now());
    const { id } = await createDraftWebinar();
    const r1 = await updateWebinarStep7(id, {
      notifications: [
        { showAtSec: 60, buyerName: "Ana", productName: "Curso", price: "R$ 99" },
        { showAtSec: 120, buyerName: "Bob", productName: "Mentor", price: null }
      ]
    });
    expect(r1).toEqual({ ok: true });
    const after1 = await prisma.saleNotification.findMany({ where: { webinarId: id }, orderBy: { showAtSec: "asc" } });
    expect(after1).toHaveLength(2);
    expect(after1[0].buyerName).toBe("Ana");

    // Second call with different rows replaces
    const r2 = await updateWebinarStep7(id, {
      notifications: [{ showAtSec: 30, buyerName: "Z", productName: "X", price: null }]
    });
    expect(r2).toEqual({ ok: true });
    const after2 = await prisma.saleNotification.findMany({ where: { webinarId: id } });
    expect(after2).toHaveLength(1);
    expect(after2[0].buyerName).toBe("Z");
  });

  it("rejects when called for another user's webinar", async () => {
    const { updateWebinarStep7 } = await import("@/server/actions/webinar?" + (Date.now() + 1));
    await prisma.user.create({ data: { id: "stranger-7", email: "s7@x.com", name: "S" } });
    const stranger = await prisma.webinar.create({ data: { ownerId: "stranger-7" } });
    const r = await updateWebinarStep7(stranger.id, { notifications: [] });
    expect(r).toMatchObject({ error: { message: expect.stringMatching(/não encontrado/i) } });
  });
});
```

Also ensure `beforeEach` in this file calls `await prisma.saleNotification.deleteMany({});` to keep tests isolated (add it near the top of the existing cleanup block, before `webinar.deleteMany`).

- [ ] **Step 2: Run, verify failure**

```bash
pnpm --filter web exec vitest run src/test/server/actions/webinar.test.ts
```

Expected: FAIL — `updateWebinarStep7` not exported.

- [ ] **Step 3: Add `updateWebinarStep7` to `apps/web/src/server/actions/webinar.ts`**

Add to imports near the existing schema imports:

```ts
import {
  // ... existing
  step7Schema,
  // ...
  type Step7Input
} from "@/lib/validations/webinar";
```

Append the new action at the bottom of the file (before the existing `updateWebinarIntegrations`):

```ts
export async function updateWebinarStep7(id: string, input: Step7Input): Promise<Result> {
  const session = await requireSession();
  const owned = await loadOwned(id, session.user.id);
  if (!owned) return notFound();
  const parsed = step7Schema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: { field: issue.path.join("."), message: issue.message } };
  }
  await prisma.$transaction([
    prisma.saleNotification.deleteMany({ where: { webinarId: id } }),
    prisma.saleNotification.createMany({
      data: parsed.data.notifications.map((n) => ({
        webinarId: id,
        showAtSec: n.showAtSec,
        buyerName: n.buyerName,
        productName: n.productName,
        price: n.price ?? null
      }))
    })
  ]);
  revalidatePath(`/dashboard/webinars/${id}`);
  return { ok: true };
}
```

- [ ] **Step 4: Run test**

```bash
pnpm --filter web exec vitest run src/test/server/actions/webinar.test.ts
```

Expected: PASS for the new describe + no regressions in existing.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/server/actions/webinar.ts apps/web/src/test/server/actions/webinar.test.ts
git commit -m "feat(web): D3 updateWebinarStep7 — persist sales with delete-and-create"
```

---

### Task 12: PublicSaleNotification DTO

**Files:**
- Modify: `apps/web/src/lib/public-dto.ts`

- [ ] **Step 1: Append to `apps/web/src/lib/public-dto.ts`**

Add at the bottom of the file, AFTER `publicLeadWithUtmsDto`:

```ts
export type PublicSaleNotification = {
  id: string;
  showAtSec: number;
  buyerName: string;
  productName: string;
  price: string | null;
};

export function publicSaleNotificationDto(n: {
  id: string;
  showAtSec: number;
  buyerName: string;
  productName: string;
  price: string | null;
}): PublicSaleNotification {
  return {
    id: n.id,
    showAtSec: n.showAtSec,
    buyerName: n.buyerName,
    productName: n.productName,
    price: n.price
  };
}
```

- [ ] **Step 2: Verify**

```bash
pnpm --filter web exec tsc --noEmit 2>&1 | grep public-dto | head
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/public-dto.ts
git commit -m "feat(web): D3 PublicSaleNotification DTO"
```

---

### Task 13: SalesNotifier client component

**Files:**
- Create: `apps/web/src/app/[slug]/_components/sales-notifier.tsx`
- Create: `apps/web/src/test/components/sales-notifier.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, act } from "@testing-library/react";
import { useRef } from "react";
import { SalesNotifier } from "@/app/[slug]/_components/sales-notifier";

const toastMock = vi.fn();
vi.mock("sonner", () => ({ toast: { success: (...args: unknown[]) => toastMock(...args) } }));

const NOTIFS = [
  { id: "1", showAtSec: 5, buyerName: "Ana", productName: "Curso A", price: "R$ 99" },
  { id: "2", showAtSec: 10, buyerName: "Bob", productName: "Mentor", price: null }
];

function Harness({ initialT, notifs }: { initialT: number; notifs: typeof NOTIFS }) {
  const ref = useRef(initialT);
  return <SalesNotifier notifications={notifs} currentTimeRef={ref} />;
}

beforeEach(() => {
  toastMock.mockClear();
  vi.useFakeTimers();
});

describe("SalesNotifier", () => {
  it("does not fire before any showAtSec", () => {
    render(<Harness initialT={0} notifs={NOTIFS} />);
    act(() => { vi.advanceTimersByTime(1100); });
    expect(toastMock).not.toHaveBeenCalled();
  });
  it("fires once when timeline crosses showAtSec", () => {
    render(<Harness initialT={6} notifs={NOTIFS} />);
    act(() => { vi.advanceTimersByTime(1100); });
    expect(toastMock).toHaveBeenCalledTimes(1);
    act(() => { vi.advanceTimersByTime(2200); });
    expect(toastMock).toHaveBeenCalledTimes(1); // still 1 — same notif, not re-fired
  });
  it("fires both notifs when ref is past both showAtSecs", () => {
    render(<Harness initialT={20} notifs={NOTIFS} />);
    act(() => { vi.advanceTimersByTime(1100); });
    expect(toastMock).toHaveBeenCalledTimes(2);
  });
  it("formats toast text with price when set", () => {
    render(<Harness initialT={6} notifs={[NOTIFS[0]]} />);
    act(() => { vi.advanceTimersByTime(1100); });
    expect(toastMock.mock.calls[0][0]).toContain("Ana");
    expect(toastMock.mock.calls[0][0]).toContain("Curso A");
    expect(toastMock.mock.calls[0][0]).toContain("R$ 99");
  });
});
```

- [ ] **Step 2: Run, verify failure**

```bash
pnpm --filter web exec vitest run src/test/components/sales-notifier.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `apps/web/src/app/[slug]/_components/sales-notifier.tsx`**

```tsx
"use client";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import type { PublicSaleNotification } from "@/lib/public-dto";

interface Props {
  notifications: PublicSaleNotification[];
  currentTimeRef: React.RefObject<number>;
}

export function SalesNotifier({ notifications, currentTimeRef }: Props) {
  const firedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const id = setInterval(() => {
      const t = currentTimeRef.current ?? 0;
      for (const n of notifications) {
        if (firedRef.current.has(n.id)) continue;
        if (t >= n.showAtSec) {
          firedRef.current.add(n.id);
          const msg = n.price
            ? `🛒 ${n.buyerName} comprou ${n.productName} por ${n.price}`
            : `🛒 ${n.buyerName} comprou ${n.productName}`;
          toast.success(msg, { duration: 6000 });
        }
      }
    }, 1000);
    return () => clearInterval(id);
  }, [notifications, currentTimeRef]);

  return null;
}
```

- [ ] **Step 4: Run test**

```bash
pnpm --filter web exec vitest run src/test/components/sales-notifier.test.tsx
```

Expected: PASS (4/4).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/\[slug\]/_components/sales-notifier.tsx apps/web/src/test/components/sales-notifier.test.tsx
git commit -m "feat(web): D3 SalesNotifier — fires sonner toast per notif when timeline crosses showAtSec"
```

---

### Task 14: PlayerShellProps + live page + player-shell wiring

**Files:**
- Modify: `apps/web/src/app/[slug]/_lib/public-types.ts`
- Modify: `apps/web/src/app/[slug]/live/page.tsx`
- Modify: `apps/web/src/app/[slug]/_components/player-shell.tsx`

- [ ] **Step 1: Add salesNotifications to PlayerShellProps**

In `apps/web/src/app/[slug]/_lib/public-types.ts`, modify imports + interface:

```ts
import type { PublicLead, PublicVideo, PublicWebinar, PublicLeadWithUtms, PublicSaleNotification } from "@/lib/public-dto";
```

In `interface PlayerShellProps`, add a new field:

```ts
  salesNotifications: PublicSaleNotification[];
```

- [ ] **Step 2: Update `live/page.tsx` query + PlayerShell invocation**

In `apps/web/src/app/[slug]/live/page.tsx`:

(a) Modify the `prisma.webinar.findUnique` `include` to add `saleNotifications`:

```ts
    include: {
      video: true,
      chatMessages: { orderBy: { showAtSec: "asc" } },
      saleNotifications: { orderBy: { showAtSec: "asc" } }
    }
```

(b) Add the `salesNotifications` prop to `<PlayerShell>`:

```tsx
      salesNotifications={w.saleNotifications.map((n) => ({
        id: n.id,
        showAtSec: n.showAtSec,
        buyerName: n.buyerName,
        productName: n.productName,
        price: n.price
      }))}
```

- [ ] **Step 3: Update player-shell.tsx**

In `apps/web/src/app/[slug]/_components/player-shell.tsx`:

(a) Add import:

```tsx
import { SalesNotifier } from "./sales-notifier";
```

(b) Destructure `salesNotifications` from props:

```tsx
export function PlayerShell({
  webinar, video, offer, ownerChat, leadChat, lead, initialOffsetSec, salesNotifications
}: PlayerShellProps) {
```

(c) Render `<SalesNotifier>` next to `<Tracker>` (anywhere in the returned JSX, near the bottom of the main element):

```tsx
      <Tracker currentTimeRef={currentTimeRef} />
      <SalesNotifier notifications={salesNotifications} currentTimeRef={currentTimeRef} />
```

- [ ] **Step 4: Verify**

```bash
pnpm --filter web exec tsc --noEmit 2>&1 | grep -E "(public-types|live/page|player-shell)" | head -10
```

Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/\[slug\]/_lib/public-types.ts apps/web/src/app/\[slug\]/live/page.tsx apps/web/src/app/\[slug\]/_components/player-shell.tsx
git commit -m "feat(web): D3 wire salesNotifications through live page + player-shell"
```

---

### Task 15: Step 7 page + Step7Form

**Files:**
- Modify (replace): `apps/web/src/app/dashboard/webinars/[id]/(wizard)/step-7/page.tsx`
- Create: `apps/web/src/components/wizard/step-7-form.tsx`

- [ ] **Step 1: Replace `apps/web/src/app/dashboard/webinars/[id]/(wizard)/step-7/page.tsx`**

```tsx
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "db";
import { Step7Form } from "@/components/wizard/step-7-form";

export default async function Step7Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) notFound();
  const w = await prisma.webinar.findUnique({
    where: { id },
    include: { saleNotifications: { orderBy: { showAtSec: "asc" } } }
  });
  if (!w || w.ownerId !== session.user.id) notFound();

  return (
    <Step7Form
      webinarId={id}
      slug={w.slug}
      initial={{
        notifications: w.saleNotifications.map((n) => ({
          id: n.id,
          showAtSec: n.showAtSec,
          buyerName: n.buyerName,
          productName: n.productName,
          price: n.price
        }))
      }}
    />
  );
}
```

- [ ] **Step 2: Create `apps/web/src/components/wizard/step-7-form.tsx`**

```tsx
"use client";
import { useRef, useState, useTransition } from "react";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Upload } from "lucide-react";
import { step7Schema, type Step7Input } from "@/lib/validations/webinar";
import { updateWebinarStep7 } from "@/server/actions/webinar";
import { Button } from "@/components/ui/button";
import { AiStubSection } from "@/components/wizard/ai-stub-section";
import { WizardSectionAccordion } from "@/components/wizard/wizard-section-accordion";
import { SalesPreviewAside } from "@/components/wizard/sales-preview-aside";
import { WizardNav } from "@/components/wizard/wizard-nav";

export interface Step7FormProps {
  webinarId: string;
  slug: string | null;
  initial: Step7Input;
}

export function Step7Form({ webinarId, slug, initial }: Step7FormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [xlsxUploading, setXlsxUploading] = useState(false);
  const xlsxInputRef = useRef<HTMLInputElement>(null);
  const { handleSubmit, control, setValue } = useForm<Step7Input>({
    resolver: zodResolver(step7Schema),
    defaultValues: initial
  });
  const { fields, append, remove } = useFieldArray({ control, name: "notifications" });
  const watched = useWatch({ control, name: "notifications" }) ?? [];

  function onSubmit(values: Step7Input) {
    startTransition(async () => {
      const r = await updateWebinarStep7(webinarId, values);
      if ("ok" in r) {
        toast.success("Vendas salvas");
        router.push(`/dashboard/webinars/${webinarId}/step-8`);
      } else {
        toast.error(r.error.message);
      }
    });
  }

  async function onXlsxFile(file: File) {
    setXlsxUploading(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch(`/api/webinars/${webinarId}/sales/import`, { method: "POST", body: fd });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.message ?? "Falha ao importar XLSX");
        return;
      }
      const { notifications } = (await res.json()) as { notifications: Array<{ showAtSec: number; buyerName: string; productName: string; price: string | null }> };
      for (const n of notifications) append(n);
      toast.success(`${notifications.length} vendas importadas`);
    } finally {
      setXlsxUploading(false);
      if (xlsxInputRef.current) xlsxInputRef.current.value = "";
    }
  }

  function updateRow(idx: number, patch: Partial<{ buyerName: string; productName: string; showAtSec: number; price: string | null }>) {
    if (patch.buyerName !== undefined) setValue(`notifications.${idx}.buyerName`, patch.buyerName, { shouldDirty: true });
    if (patch.productName !== undefined) setValue(`notifications.${idx}.productName`, patch.productName, { shouldDirty: true });
    if (patch.showAtSec !== undefined) setValue(`notifications.${idx}.showAtSec`, patch.showAtSec, { shouldDirty: true });
    if (patch.price !== undefined) setValue(`notifications.${idx}.price`, patch.price, { shouldDirty: true });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-6 lg:grid-cols-[1fr_minmax(0,420px)]">
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Vendas</h2>

        <WizardSectionAccordion
          ai={
            <AiStubSection
              badge="Novidade"
              title="Automação Inteligente de Vendas"
              description="Use IA para gerar notificações de venda realistas automaticamente."
              cta="Gerar Vendas com IA"
            />
          }
          fileTitle="Crie as vendas via arquivo"
          fileSection={
            <div className="flex flex-col items-center gap-2 py-2 text-sm">
              <input
                ref={xlsxInputRef}
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onXlsxFile(f);
                }}
              />
              <Button
                type="button"
                variant="outline"
                disabled={xlsxUploading}
                onClick={() => xlsxInputRef.current?.click()}
              >
                <Upload className="mr-2 h-4 w-4" />
                {xlsxUploading ? "Importando..." : "Importar planilha XLSX"}
              </Button>
              <p className="text-xs text-muted-foreground">
                Colunas: Hora | Minuto | Segundo | Nome do comprador | Produto | Preço
              </p>
            </div>
          }
          individualTitle="Crie as vendas individualmente"
          individualSection={
            <div className="space-y-2 py-2">
              <p className="text-xs text-muted-foreground">{fields.length} vendas. Edite na prévia ao lado.</p>
              <Button
                type="button"
                variant="outline"
                onClick={() => append({ showAtSec: 0, buyerName: "", productName: "", price: null })}
              >
                <Plus className="mr-2 h-4 w-4" /> Adicionar venda
              </Button>
            </div>
          }
        />

        <WizardNav webinarId={webinarId} step={7} submitting={pending} />
      </div>

      <SalesPreviewAside
        webinarId={webinarId}
        slug={slug}
        notifications={watched.map((n) => ({
          id: n?.id,
          buyerName: n?.buyerName ?? "",
          productName: n?.productName ?? "",
          showAtSec: n?.showAtSec ?? 0,
          price: n?.price ?? null
        }))}
        onUpdate={updateRow}
        onDelete={remove}
        onDeleteAll={() => {
          for (let i = fields.length - 1; i >= 0; i--) remove(i);
        }}
      />
    </form>
  );
}
```

- [ ] **Step 3: Verify**

```bash
pnpm --filter web exec tsc --noEmit 2>&1 | grep -E "step-7" | head -10
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/dashboard/webinars/\[id\]/\(wizard\)/step-7/page.tsx apps/web/src/components/wizard/step-7-form.tsx
git commit -m "feat(web): D3 Step7Form — vendas form with accordion sections + preview aside"
```

---

### Task 16: Step 6 form rewrite (2-column + accordion)

**Files:**
- Modify (full replace): `apps/web/src/components/wizard/step-6-form.tsx`

- [ ] **Step 1: Replace the entire file**

```tsx
"use client";
import { useRef, useState, useTransition } from "react";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Upload } from "lucide-react";
import { step6Schema, type Step6Input } from "@/lib/validations/webinar";
import { updateWebinarStep6, publishWebinar } from "@/server/actions/webinar";
import { Button } from "@/components/ui/button";
import { AiStubSection } from "@/components/wizard/ai-stub-section";
import { WizardSectionAccordion } from "@/components/wizard/wizard-section-accordion";
import { ChatPreviewAside } from "@/components/wizard/chat-preview-aside";
import { WizardNav } from "@/components/wizard/wizard-nav";

export interface Step6FormProps {
  webinarId: string;
  slug: string | null;
  initial: Step6Input;
}

export function Step6Form({ webinarId, slug, initial }: Step6FormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [xlsxUploading, setXlsxUploading] = useState(false);
  const xlsxInputRef = useRef<HTMLInputElement>(null);
  const { handleSubmit, control, setValue } = useForm<Step6Input>({
    resolver: zodResolver(step6Schema),
    defaultValues: initial
  });
  const { fields, append, remove } = useFieldArray({ control, name: "messages" });
  const watched = useWatch({ control, name: "messages" }) ?? [];

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

  async function onXlsxFile(file: File) {
    setXlsxUploading(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch(`/api/webinars/${webinarId}/messages/import`, { method: "POST", body: fd });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.message ?? "Falha ao importar XLSX");
        return;
      }
      const { messages } = (await res.json()) as { messages: Array<{ authorName: string; text: string; showAtSec: number; isOwner: boolean }> };
      for (const m of messages) append(m);
      toast.success(`${messages.length} mensagens importadas`);
    } finally {
      setXlsxUploading(false);
      if (xlsxInputRef.current) xlsxInputRef.current.value = "";
    }
  }

  function updateRow(idx: number, patch: Partial<{ authorName: string; text: string; showAtSec: number; isOwner: boolean }>) {
    if (patch.authorName !== undefined) setValue(`messages.${idx}.authorName`, patch.authorName, { shouldDirty: true });
    if (patch.text !== undefined) setValue(`messages.${idx}.text`, patch.text, { shouldDirty: true });
    if (patch.showAtSec !== undefined) setValue(`messages.${idx}.showAtSec`, patch.showAtSec, { shouldDirty: true });
    if (patch.isOwner !== undefined) setValue(`messages.${idx}.isOwner`, patch.isOwner, { shouldDirty: true });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-6 lg:grid-cols-[1fr_minmax(0,420px)]">
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Chat scriptado</h2>

        <WizardSectionAccordion
          ai={
            <AiStubSection
              badge="Novidade"
              title="Automação Inteligente de Chat"
              description="Use IA para gerar mensagens automáticas e simular engajamento no chat do seu webinar."
              cta="Gerar Chat com IA"
            />
          }
          fileTitle="Crie o chat via arquivo"
          fileSection={
            <div className="flex flex-col items-center gap-2 py-2 text-sm">
              <input
                ref={xlsxInputRef}
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onXlsxFile(f);
                }}
              />
              <Button
                type="button"
                variant="outline"
                disabled={xlsxUploading}
                onClick={() => xlsxInputRef.current?.click()}
              >
                <Upload className="mr-2 h-4 w-4" />
                {xlsxUploading ? "Importando..." : "Importar planilha XLSX"}
              </Button>
              <p className="text-xs text-muted-foreground">
                Colunas: Hora | Minuto | Segundo | Nome | Texto | Suporte
              </p>
            </div>
          }
          individualTitle="Crie o chat individualmente"
          individualSection={
            <div className="space-y-2 py-2">
              <p className="text-xs text-muted-foreground">{fields.length} mensagens. Edite na prévia ao lado.</p>
              <Button
                type="button"
                variant="outline"
                onClick={() => append({ authorName: "", text: "", showAtSec: 0, isOwner: false })}
              >
                <Plus className="mr-2 h-4 w-4" /> Adicionar mensagem
              </Button>
            </div>
          }
        />

        <WizardNav webinarId={webinarId} step={6} submitting={pending} />
      </div>

      <ChatPreviewAside
        webinarId={webinarId}
        slug={slug}
        messages={watched.map((m) => ({
          id: m?.id,
          authorName: m?.authorName ?? "",
          text: m?.text ?? "",
          showAtSec: m?.showAtSec ?? 0,
          isOwner: m?.isOwner ?? false
        }))}
        onUpdate={updateRow}
        onDelete={remove}
        onDeleteAll={() => {
          for (let i = fields.length - 1; i >= 0; i--) remove(i);
        }}
      />
    </form>
  );
}
```

- [ ] **Step 2: Update Step 6 page to pass `slug`**

In `apps/web/src/app/dashboard/webinars/[id]/(wizard)/step-6/page.tsx`, modify the `<Step6Form>` invocation to pass the new `slug` prop:

```tsx
    <Step6Form
      webinarId={id}
      slug={w.slug}
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
```

- [ ] **Step 3: Verify**

```bash
pnpm --filter web exec tsc --noEmit 2>&1 | grep -E "step-6" | head -10
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/wizard/step-6-form.tsx apps/web/src/app/dashboard/webinars/\[id\]/\(wizard\)/step-6/page.tsx
git commit -m "feat(web): D3 Step6Form rewrite — 2-column with accordion sections + preview aside"
```

---

### Task 17: Final cleanup — typecheck + tests

**Files:**
- As needed across project

- [ ] **Step 1: Run full typecheck**

```bash
pnpm -r typecheck 2>&1 | tee typecheck.log | tail -40
```

Expected: clean. Common remaining errors after T1-T16:
- A test fixture missing `salesNotifications` in `PlayerShellProps` — add `salesNotifications: []` to fixtures.
- A page/component referencing the old Step6Form signature without `slug` — pass `slug`.

Fix each minimally. Re-run.

- [ ] **Step 2: Run full test suite**

```bash
pnpm -r --workspace-concurrency=1 test 2>&1 | tail -60
```

Expected: all green.

- [ ] **Step 3: Commit cleanup if needed**

```bash
git status
git add <fixed-files>
git commit -m "chore: D3 typecheck/test cleanup"
```

If tree is clean, no commit needed.

---

### Task 18: README + acceptance

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Append D3 section after the existing "Offer (sub-plan D2)" block, before "## Deploy"**

Insert this section:

```markdown
## Chat + Vendas (sub-plan D3)

- Step 6 (Chat) redesigned: 2-column layout, accordion 3 sections (AI stub / file XLSX / individual editor), search-filterable preview aside with always-editable rows + per-row delete + bulk delete + Export XLSX + "Testar no player".
- Step 7 (Vendas) — new sub-plan: same layout. Schema `Hora | Minuto | Segundo | Nome do comprador | Produto | Preço`. Persists to new `SaleNotification` table.
- Player `/[slug]/live`: sonner toasts fire as `🛒 {buyer} comprou {product} por {price}` when timeline crosses each `showAtSec`. One toast per notif per session.
- AI generation buttons present but disabled (`disabled={true}` + tooltip "Em breve") in both steps; reserved for a future sub-plan.
- Schema migration: `20260505220000_d3_sales_notifications`.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: document sub-plan D3 chat redesign + vendas in README"
```

- [ ] **Step 3: Final verification**

```bash
git log --oneline -25
git status
```

Expected: clean tree, ~20 commits ahead of pre-D3 baseline.

---

## Self-Review

**Spec coverage:**

| Spec section | Plan task |
|---|---|
| `SaleNotification` model | T1 |
| `step7Schema` + `saleItemSchema` | T2 |
| `lib/sales-xlsx.ts` | T3 |
| Accordion + Tooltip primitives | T4 |
| AI stub section | T5 |
| WizardSectionAccordion shared | T6 |
| ChatPreviewAside | T7 |
| SalesPreviewAside | T8 |
| `/api/sales/import` | T9 |
| `/api/sales/export` | T10 |
| `updateWebinarStep7` | T11 |
| `PublicSaleNotification` DTO | T12 |
| SalesNotifier player toast logic | T13 |
| `PlayerShellProps.salesNotifications` + live wiring | T14 |
| Step 7 page + Step7Form | T15 |
| Step 6 redesign (2-column + accordion) | T16 |
| Final typecheck/tests cleanup | T17 |
| README | T18 |
| Test coverage all 9 test files | T2/T3/T6/T7/T8/T9/T10/T11/T13 |

**Placeholder check:** scanned — no TBDs, no "implement later", every code change includes complete code blocks.

**Type consistency:**
- `Step6Input.messages[].id` is `string | undefined` per `chatItemSchema.id?` — matches `ChatRowValue.id?` in `chat-preview-aside.tsx` and `Step6Form.messages.id` watcher.
- `Step7Input.notifications[].id` similarly optional — matches `SaleRowValue.id?` and `Step7Form.notifications.id` watcher.
- `PublicSaleNotification` shape (id/showAtSec/buyerName/productName/price: string|null) is identical in T12 (defined), T13 (consumed by SalesNotifier), T14 (passed via PlayerShellProps).
- `updateWebinarStep7` takes `Step7Input` (T11) which T15's Step7Form sends.
- `slug: string | null` consistent across Step6FormProps, Step7FormProps, ChatPreviewAside, SalesPreviewAside.

**Done.**
