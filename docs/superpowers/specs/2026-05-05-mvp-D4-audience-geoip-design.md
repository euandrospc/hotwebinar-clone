# MVP Sub-plan D4 — Audiência + GeoIP

**Status:** Approved 2026-05-05
**Predecessors:** D1 (Wizard 1-3), D2 (Offer), D3 (Chat + Vendas) — all committed.

## Goal

Implement Step 8 (Audiência) and capture lead geolocation at opt-in (city/region/lat/lng). Step 8 lets the owner pick a simulated audience mode (NONE / FIXED / DYNAMIC), set min/max participants, and toggle a "🔴 AO VIVO" badge. The public player renders an `<AudienceBadge>` in the header showing a deterministic simulated counter that varies over time in DYNAMIC mode. GeoIP enrichment populates Lead.city/region/lat/lng so a future sub-plan can render a leads map.

## Architecture

**Audience config = 4 fields on Webinar.** Same pattern as D1/D2 offer fields. Enum `AudienceMode { NONE, FIXED, DYNAMIC }`. `audienceMin`, `audienceMax` (Int), `audienceLiveBadge` (Boolean). Default mode = NONE so existing webinars stay silent.

**Deterministic simulation, client-side.** Pure function `simulateAudienceAt(t, duration, min, max, seed)` returns a count for a given time. Seed = `webinarId + leadId` hashed to int — same lead sees same curve across refreshes without persisting it. S-curve envelope: ramp 0→1 over first 30% of duration, plateau, gentle decline (1.0→0.8) over last 20%. Sinusoidal jitter ±5% for organic feel. Wizard chart and player counter share this function — single source of truth.

**FIXED mode** picks one number in [min, max] from the seed at mount time and never moves. **DYNAMIC mode** ticks every 5 seconds via `setInterval` reading `currentTimeRef.current`. **NONE mode** renders nothing.

**GeoIP enrichment (best-effort, non-blocking).** After `submitOptin` creates/updates the Lead, fire `void enrichLeadGeo(lead.id, ip)` without `await` — redirect happens immediately. `enrichLeadGeo` calls `https://ipapi.co/<ip>/json/` with a 3 s `AbortSignal.timeout`, parses the response, updates the Lead row. On any failure (rate limit, network, malformed response, private/local IP) writes nothing. No retry, no backoff, no error toast.

**Wizard preview chart.** Recharts (`recharts` package, ~50 KB gzipped). Owner sees a smooth line of simulated counts over the webinar duration. Live-updates as min/max/mode change via `useWatch`. Uses webinar's `endDate - startDate` for duration; falls back to 3600 s if dates unset.

## Data Model

### Migration `d4_audience_and_geo`

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

### Prisma schema delta

`schema.prisma` adds:

```prisma
enum AudienceMode {
  NONE
  FIXED
  DYNAMIC
}

model Webinar {
  // ... existing fields
  audienceMode      AudienceMode @default(NONE)
  audienceMin       Int          @default(50)
  audienceMax       Int          @default(500)
  audienceLiveBadge Boolean      @default(true)
}

model Lead {
  // ... existing fields
  city   String?
  region String?
  lat    Float?
  lng    Float?
}
```

## Files

### Created — Lib

- `apps/web/src/lib/audience-sim.ts` — pure functions:
  - `hashSeed(s: string): number` — deterministic 32-bit hash of webinarId+leadId.
  - `simulateAudienceAt(t, duration, min, max, seed): number` — returns count for given time.
  - `simulateAudienceSeries(duration, min, max, seed, samples?): Array<{t, count}>` — sampled curve for chart (default 60 points).
- `apps/web/src/lib/geoip.ts` — `enrichLeadGeo(leadId, ip): Promise<void>`. Calls ipapi.co, updates Lead. Silent fail on error/private IP.

### Created — UI primitives

- `apps/web/src/components/ui/radio-group.tsx` — shadcn primitive over `@radix-ui/react-radio-group` (install: `pnpm --filter web add @radix-ui/react-radio-group`).

### Created — Wizard

- `apps/web/src/components/wizard/audience-chart.tsx` — Recharts `<LineChart>` reading `simulateAudienceSeries`. Live-updates via props.
- `apps/web/src/components/wizard/step-8-form.tsx` — RHF form: RadioGroup mode, NumberInputs for min/max, Switch for liveBadge, sticky chart aside.

### Modified — Wizard

- `apps/web/src/app/dashboard/webinars/[id]/(wizard)/step-8/page.tsx` — replace stub. Query webinar.audience* + chat to determine duration → pass to Step8Form.

### Created — Player

- `apps/web/src/app/[slug]/_components/audience-badge.tsx` — client component. Reads `webinar.audience*` props + `lead.id` (seed) + `currentTimeRef`. setInterval 5 s computes count. Renders `🔴 AO VIVO · {count} assistindo` when mode != NONE, with optional live dot.

### Modified — Server / DTO / Public

- `apps/web/src/lib/validations/webinar.ts` — add `step8Schema` + `Step8Input`.
- `apps/web/src/server/actions/webinar.ts` — add `updateWebinarStep8` (mirrors step1 pattern: ownership + parse + 4-col update).
- `apps/web/src/server/actions/public.ts` — `submitOptin` calls `void enrichLeadGeo(lead.id, ip)` after lead persist (no await).
- `apps/web/src/lib/public-dto.ts` — `PublicWebinar` adds 4 audience fields; `publicWebinarDto` returns them.
- `apps/web/src/app/[slug]/live/page.tsx` — `audience*` already on webinar; passes whole `wDto` already.
- `apps/web/src/app/[slug]/_components/player-shell.tsx` — renders `<AudienceBadge>` in header between logo and lead name.

### Tests (created)

- `apps/web/src/test/lib/audience-sim.test.ts` — hash determinism, count ∈ [min, max], FIXED returns same value at any t, DYNAMIC varies, NONE n/a (function not called for NONE).
- `apps/web/src/test/lib/validations/step8.test.ts` — happy, max<min reject, invalid mode reject, negative min reject.
- `apps/web/src/test/lib/geoip.test.ts` — mock global `fetch`: happy path persists fields; HTTP error skips silently; private IP skips without fetch; timeout skips silently.
- `apps/web/src/test/server/actions/webinar.test.ts` — extend with `describe("updateWebinarStep8", ...)`: persist 4 cols + ownership rejection.
- `apps/web/src/test/components/audience-badge.test.tsx` — mode=NONE returns null; mode=FIXED renders static count; liveBadge=false hides live dot; mode=DYNAMIC updates count over fake-timer ticks.
- `apps/web/src/test/components/audience-chart.test.tsx` — renders SVG paths for DYNAMIC mode; renders placeholder/empty for NONE.

## Audience Simulation Algorithm

Hash function (32-bit FNV-style or similar deterministic mixer):

```ts
export function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  }
  return Math.abs(h);
}
```

Envelope (S-curve over normalized time `n = t / duration`):

| n range | envelope |
|---|---|
| `[0, 0.3)` | `n / 0.3` (ramp 0→1) |
| `[0.3, 0.8]` | `1` (plateau) |
| `(0.8, 1]` | `1 - (n - 0.8) / 0.2 * 0.2` (decline 1→0.8) |

Jitter: `Math.sin((t + hashSeed(seed)) * 0.13) * 0.05` — oscillates ±5% deterministically per t.

Final count: `Math.round(min + (max - min) * clamp01(envelope + jitter))`.

`FIXED` mode shortcut: `min + hashSeed(seed) % (max - min + 1)`. Constant for all `t`.

## GeoIP Contract (`lib/geoip.ts`)

```ts
const PRIVATE_IP_PREFIXES = ["127.", "10.", "192.168.", "172.16.", "172.17.", "172.18.", "172.19.", "172.20.", "172.21.", "172.22.", "172.23.", "172.24.", "172.25.", "172.26.", "172.27.", "172.28.", "172.29.", "172.30.", "172.31.", "::1", "fe80:"];

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

Note: `country` field already exists on Lead; we update it with the new value too (overwrites whatever was there). Lead may be deleted between fire-and-forget enrichment dispatch and update completion — the `prisma.lead.update` will throw `P2025` (not found) and the catch swallows it.

## AudienceBadge UI Contract

Position: inserted in `PlayerShell` header. Current header:

```tsx
<header className="flex items-center justify-between border-b p-4">
  {webinar.logoUrl ? <img ...logo... /> : <div />}
  <span>Olá, {lead.name}</span>
</header>
```

Becomes:

```tsx
<header className="flex items-center justify-between border-b p-4">
  {webinar.logoUrl ? <img ...logo... /> : <div />}
  <AudienceBadge
    mode={webinar.audienceMode}
    min={webinar.audienceMin}
    max={webinar.audienceMax}
    showLiveBadge={webinar.audienceLiveBadge}
    seed={`${webinar.id}:${lead.id}`}
    durationSec={video?.durationSec ?? 3600}
    currentTimeRef={currentTimeRef}
  />
  <span>Olá, {lead.name}</span>
</header>
```

`AudienceBadge` returns `null` when `mode === "NONE"`. Otherwise renders inline-flex pill:

- Optional live dot: `<span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />` + label "AO VIVO" (when `showLiveBadge`).
- Counter: `Intl.NumberFormat("pt-BR").format(count)` + " assistindo".

Tick: `setInterval(() => setCount(simulateAudienceAt(currentTimeRef.current ?? 0, duration, min, max, seed)), 5000)`. Runs only for DYNAMIC mode. FIXED computes once at mount.

## Wizard Chart

`<AudienceChart>` props: `mode`, `min`, `max`, `seed`, `duration`. When `mode === "NONE"` → render placeholder ("Modo desabilitado"). When FIXED → flat line. When DYNAMIC → 60-sample series via `simulateAudienceSeries`.

Recharts setup minimal: `LineChart` + `XAxis` (formatted HH:MM via `tickFormatter`) + `YAxis` (number) + `Line` (smooth, primary color) + `Tooltip`. Container: `ResponsiveContainer width="100%" height={240}`.

## Out of Scope

- Leads map (deferred to D5).
- Real WebSocket-based audience counter from actual concurrent leads (current = simulated only).
- GeoIP self-hosted DB (MaxMind) — explicit free-tier API choice.
- Per-region counter breakdown.
- Click-to-zoom on chart.
- Export of audience metrics.
- Audience persistence (don't store individual ticks; pure function).
- Re-fetch GeoIP if first call failed (one shot, silent).

## Acceptance

- Step 8 page renders the form with RadioGroup + Min/Max inputs + LiveBadge switch + chart aside.
- Step 8 form persists 4 cols on Webinar via `updateWebinarStep8`. Save → reload → values stick.
- Player `/<slug>/live`: header badge appears when `audienceMode != NONE`. Number animates over time when DYNAMIC. Live dot pulses when `audienceLiveBadge=true`.
- `submitOptin`: after a real (public) IP opt-in, Lead.city/region/lat/lng populate within ~3 s. For local/private IPs they stay null. Failures don't crash the action.
- Schema migration `20260505XXXXXX_d4_audience_and_geo` applied.
- All tests + typecheck green.
