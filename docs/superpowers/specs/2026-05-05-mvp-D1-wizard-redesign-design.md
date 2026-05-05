# MVP Sub-plan D1 — Wizard Redesign (Steps 1+2+3) Design

**Date:** 2026-05-05
**Branch:** `feat/capture-phase`
**Depends on:** A, B1, B2, C ✅
**Series position:** D1 → D2 (Oferta) → D3 (Chat AI + Vendas) → D4 (Audiência)

## Goal

Redesign first three wizard steps (Início, Webinar, Login) to match original Hotwebinar UI from screenshots provided in `C:\Users\e_say\Downloads\screenshots`. Adds new toggles, fuso-horário Select, waiting-room template picker, login logo alignment, configurable progress bar, login form fields with order management, and a live preview card on step 3. Plus full wizard nav redesign with Lucide icons + numbered circles + connecting line spanning 9 steps (chatbot/agente IA out of scope).

## Out of scope

- Step 4 (Vídeo) provider radio selectors (vimeo/bunny/cloudflare/etc) — current external/library/upload flow stays.
- Steps 5 (Oferta), 6 (Chat AI), 7 (Vendas), 8 (Audiência) — sub-plans D2/D3/D4.
- Steps 10 (Chatbot), 11 (Agente IA) — explicitly skipped.

## Architecture

```
apps/web/src/
├── app/dashboard/webinars/[id]/(wizard)/
│   ├── layout.tsx                 EXTEND - 9-step nav redesign
│   ├── step-1/page.tsx            EXTEND - 2 new toggles
│   ├── step-2/page.tsx            EXTEND - timezone Select, template selector
│   └── step-3/page.tsx            EXTEND - logo align, progress bar, form order, preview
├── components/wizard/
│   ├── wizard-shell.tsx           REPLACE - new horizontal nav with icons
│   ├── wizard-nav.tsx             EXTEND - back/forward buttons (existing pattern)
│   ├── step-1-form.tsx            EXTEND
│   ├── step-2-form.tsx            EXTEND
│   ├── step-3-form.tsx            REPLACE - 3-column layout + live preview
│   ├── waiting-template-picker.tsx NEW - template cards
│   ├── timezone-select.tsx        NEW - Select with ~20 zones + auto
│   └── login-preview.tsx          NEW - live preview of CaptureForm shape
├── app/[slug]/_components/
│   ├── capture-form.tsx           EXTEND - honor logoAlign, progressBar, formFieldOrder
│   └── countdown-view.tsx         EXTEND - select template by waitingTemplate
└── lib/
    ├── timezones.ts               NEW - constant list
    └── waiting-templates.ts       NEW - template descriptors
```

## Schema additions

Single migration `d1_wizard_redesign`. All fields default to safe values so existing webinars keep current behavior.

```prisma
enum WaitingTemplate {
  DEFAULT       // current: logo + title + countdown
  WITH_THUMB    // adds video thumbnail (replaces current waitingShowThumb flag)
  IMMERSIVE     // video bg muted + center countdown overlay
  MINIMAL       // only countdown clock, no title/subtitle
  FEATURES      // bullet list of what user gets + countdown beside
}

enum LogoAlign {
  LEFT
  CENTER
  RIGHT
}

model Webinar {
  // ... existing fields preserved

  accessFacilitated   Boolean         @default(false)  // UI toggle only (defer real impl)
  videoSyncWithStart  Boolean         @default(true)
  waitingTemplate     WaitingTemplate @default(DEFAULT)

  loginLogoAlign      LogoAlign       @default(CENTER)

  progressEnabled     Boolean         @default(false)
  progressStartPct    Int             @default(50)
  progressBarColor    String          @default("#dc2626")
  progressTextColor   String          @default("#ffffff")
  progressText        String          @default("{pct}% das vagas preenchidas...")

  formFieldOrder      String[]        @default(["name","email","phone"])
}
```

Notes:
- `waitingShowThumb` (added in C) is **deprecated by `waitingTemplate=WITH_THUMB`** but column stays (backwards compat). New UI sets template; old toggle still readable.
- `formFieldOrder` is Postgres `text[]`; values constrained to `["name","email","phone"]` at the application layer.

## Component design

### WizardShell — 9-step nav

Replace current shell. New layout:

```
┌─────────────────────────────────────────────────────────────┐
│ [🏁] [📺] [→] [🎥] [🎁] [💬] [💵] [👁] [🧩]          │  icons (lucide-react)
│ Início Webinar Login Vídeo Oferta Chat Vendas Aud Integ.  │  labels
│  (1)───(2)───(3)───(4)───(5)───(6)───(7)───(8)───(9)      │  circles + line
└─────────────────────────────────────────────────────────────┘
                  current step active
```

- Icons: `Flag` (1), `MonitorPlay` (2), `LogIn` (3), `Video` (4), `Gift` (5), `MessageCircle` (6), `DollarSign` (7), `Eye` (8), `Plug2` (9)
- Active step: icon red, label red bold
- Past steps: icon green-600, label green-600
- Future steps: icon gray-400, label gray-400
- Circle: green filled with white number (past + active), gray outlined with gray number (future)
- Line: green between past circles + up to active, gray after
- Container: `overflow-x-auto` for narrow viewports
- Server-determined current step via existing `x-pathname` middleware header (already wired in B1)

### Step 1 form additions

Below existing fields (name/title/slug/language) add two `<Switch>` cards:

```
┌──────────────────────────────────────────────────────────┐
│ Forma de acesso a sala  ⓘ                                │
│ [○ Switch] Acesso Facilitado                             │
│ ┌──────────────────────────────────────────────────────┐│
│ │ ⓘ Importante                                         ││
│ │ Ao ativar o acesso facilitado, o usuário é          ││
│ │ direcionado imediatamente para a sala...            ││
│ └──────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│ Sincronizar vídeo com tempo de início do webinar  ⓘ     │
│ [● Switch] Ativo                                         │
│ ┌──────────────────────────────────────────────────────┐│
│ │ ⓘ Importante                                         ││
│ │ Ao sincronizar o vídeo com o tempo de início...     ││
│ └──────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────┘
```

Both rendered as a generic `<ToggleCard title description info>` component for reuse.

### Step 2 form additions

- Replace `<Input>` for timezone with `<TimezoneSelect>` (Select shadcn). First option: "Detectar automático (browser)" (special value `__auto__`). On select, client computes via `Intl.DateTimeFormat().resolvedOptions().timeZone` and sends real string to server. Static list of ~20 zones (PT-BR labels): São Paulo, Recife, Belém, Manaus, Rio Branco, Buenos Aires, Mexico City, Bogotá, Santiago, Lisboa, Madrid, London, Paris, Berlin, Roma, NY, LA, Tokyo, Sydney.
- Add `<WaitingTemplatePicker>` below existing waiting-room fields. Grid 5 cards (icon + label + 1-line description). Selected card has primary ring. Sets `waitingTemplate`.

### Step 3 form REPLACE (3-column layout)

```
┌────────────────────┬────────────────────┬────────────────────┐
│ Logo do webinar    │ Alinhamento logo   │  PRÉVIA            │
│ [Upload card]      │ [⊞ ⊟ ⊠] (3 btn)    │  ┌───────────────┐ │
│                    │                    │  │  [logo]       │ │
│ Barra progresso    │                    │  │  Título       │ │
│ ☑ Exibir          │                    │  │  ▓▓▓▓░░ 75%  │ │
│ Iniciar em: [83 ]  │                    │  │  [name input] │ │
│ Cor barra ●        │                    │  │  [email]      │ │
│ Cor texto ○        │                    │  │  [phone]      │ │
│ Texto: [{pct}...]  │                    │  │  [BTN VERDE]  │ │
│                    │                    │  └───────────────┘ │
│ Título do Webinar  │                    │  (sticky)          │
│ [textarea]         │                    │                    │
│                    │                    │                    │
│ Editar botão       │                    │                    │
│ Texto: [Entrar]    │                    │                    │
│ Cor btn ● txt ○    │                    │                    │
│                    │                    │                    │
│ Form acesso a sala │ Campos obrigatórios│ Campos formulário  │
│ [Nome] [+/-]       │ [● Nome obrig]     │ Nome label [...]   │
│ [E-mail] [+/-]     │ [○ Email obrig]    │ E-mail label [...] │
│ [WhatsApp] [+/-]   │ [● WhatsApp obrig] │ WhatsApp label [..]│
└────────────────────┴────────────────────┴────────────────────┘
```

Implementation notes:
- Top sub-grid: 2 cols (form left, logo+align middle) + sticky preview right (col-span 1)
- Logo align: 3 `<Button>` icon-only with `AlignLeft`/`AlignCenter`/`AlignRight` (lucide). Active = primary fill.
- Progress bar fields visible only when `progressEnabled` checked.
- Form fields list: 3 rows fixed `name|email|phone` (per pergunta 7 decision). Each row shows label + `+/-` button toggling `nameEnabled`/etc. Drag-drop reorder (`formFieldOrder`) via `<button>` arrows or HTML5 drag (TBD: arrows for simplicity).
- Required column: 3 Switches mapping to `nameRequired`/`emailRequired`/`phoneRequired`.
- Field placeholder column: 3 Inputs mapping to `namePlaceholder`/etc.
- Preview column: `<LoginPreview>` consumes RHF `watch()` values and renders mini-form in same shape `<CaptureForm>` produces, but read-only.

### Public-side updates

**CaptureForm** (`apps/web/src/app/[slug]/_components/capture-form.tsx`):
- Add `progress-bar.tsx` mini-component if `webinar.progressEnabled`. Renders bar with `progressStartPct..99` animated over 30s loop, `progressBarColor`/`progressTextColor`, text from `progressText` with `{pct}` substitution.
- Logo wrapper `<div>` gets justify class from `loginLogoAlign`: `justify-start`/`center`/`end`.
- Field render order driven by `formFieldOrder.map()` instead of hardcoded order.

**CountdownView** — branch on `waitingTemplate`:
- `DEFAULT` — current layout
- `WITH_THUMB` — current + thumb (unchanged from C)
- `IMMERSIVE` — fullscreen video poster bg, countdown center white
- `MINIMAL` — only countdown clock huge, no title
- `FEATURES` — title + bullet list (3-5 hardcoded copy items) + countdown side

DTO additions in `publicWebinarDto`: include all new fields except `accessFacilitated` (UI-only).

### Server actions

- `updateWebinarStep1` extends with `accessFacilitated`, `videoSyncWithStart`.
- `updateWebinarStep2` extends with `waitingTemplate`. Replace deprecated `waitingShowThumb` mutation with template-derived value (set `waitingShowThumb = (template === "WITH_THUMB")` for backwards compat OR drop column in future migration; keep for D1).
- `updateWebinarStep3` (new — currently step 3 fields are split across step 1 + bring all login-related fields here): logoUrl, primaryColor, loginButtonText, loginButtonColor, nameEnabled/Required/Placeholder, emailEnabled/Required/Placeholder, phoneEnabled/Required/Placeholder, formFieldOrder, loginLogoAlign, progressEnabled, progressStartPct, progressBarColor, progressTextColor, progressText.

Currently step 3 in B1 owns branding + form fields under `step3Schema`. We extend that schema + the existing `updateWebinarStep3` action.

## Validations

`step1Schema` extension:
```ts
accessFacilitated: z.boolean(),
videoSyncWithStart: z.boolean()
```

`step2Schema` extension:
```ts
waitingTemplate: z.enum(["DEFAULT","WITH_THUMB","IMMERSIVE","MINIMAL","FEATURES"])
```

`step3Schema` extension:
```ts
loginLogoAlign: z.enum(["LEFT","CENTER","RIGHT"]),
progressEnabled: z.boolean(),
progressStartPct: z.number().int().min(0).max(99),
progressBarColor: z.string().regex(/^#[0-9a-f]{6}$/i),
progressTextColor: z.string().regex(/^#[0-9a-f]{6}$/i),
progressText: z.string().min(1).max(120),
formFieldOrder: z.array(z.enum(["name","email","phone"])).min(1).max(3)
  .refine((arr) => new Set(arr).size === arr.length, "Sem duplicatas")
```

## Tests

Unit (vitest):
- `step1Schema` — toggles default false/true correctly
- `step2Schema` — template enum accepts all 5 values
- `step3Schema` — formFieldOrder rejects duplicates, accepts subsets, color regex
- `lib/timezones.ts` — list contains São Paulo + has auto sentinel
- Server actions extension tests (extend existing `webinar.test.ts`)

Component (vitest jsdom):
- `<TimezoneSelect>` — auto detect resolves to browser zone
- `<WaitingTemplatePicker>` — selecting card updates form value
- `<LoginPreview>` — reflects RHF watch() values (logo, progress, button color)

E2E (manual): create webinar, walk through 3 steps, verify preview matches public page.

## Definition of Done

1. Migration `d1_wizard_redesign` applies clean
2. Wizard nav: 9 icons + labels + circles + line, scrolls horizontally on narrow viewport
3. Step 1: 2 new toggles render correctly + persist
4. Step 2: timezone Select with auto + 20 zones + waiting template picker (5 cards) persists
5. Step 3: 3-column layout + logo align buttons + progress bar fields + form fields with +/- + required toggles + placeholder inputs + live preview
6. CaptureForm honors `loginLogoAlign` + `progressEnabled` + `formFieldOrder` on public page
7. CountdownView branches on `waitingTemplate` rendering correct variant
8. `pnpm -r --workspace-concurrency=1 typecheck` + `test` clean
9. README updated noting deprecation of `waitingShowThumb` in favor of `waitingTemplate=WITH_THUMB`

## File-level decomposition (~22 tasks)

T1: Migration + schema
T2: lib/timezones.ts
T3: lib/waiting-templates.ts
T4: validations webinar.ts step1+step2+step3 extensions
T5: ToggleCard component
T6: TimezoneSelect component
T7: WaitingTemplatePicker component
T8: LoginPreview component
T9: WizardShell redesign (9-step nav)
T10: step-1-form extension
T11: step-2-form extension (timezone + template)
T12: step-3-form replacement (3-col + preview)
T13: updateWebinarStep1 action extension
T14: updateWebinarStep2 action extension
T15: updateWebinarStep3 action extension
T16: step-1/page.tsx + step-2/page.tsx + step-3/page.tsx initial values
T17: publicWebinarDto extension
T18: CaptureForm public-side updates (logoAlign + progress + order)
T19: CountdownView template branching
T20: Tests — schemas + server actions
T21: Tests — components (TimezoneSelect, WaitingTemplatePicker, LoginPreview)
T22: Final acceptance + README + commits walkthrough
