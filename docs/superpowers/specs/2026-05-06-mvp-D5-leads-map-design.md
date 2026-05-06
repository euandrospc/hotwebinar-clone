# MVP Sub-plan D5 — Leads Map

**Status:** Approved 2026-05-06
**Predecessors:** D4 (Audiência + GeoIP) committed — Lead has `city/region/lat/lng` cols populated by `enrichLeadGeo`.

## Goal

Add a map page at `/dashboard/webinars/[id]/leads-map` showing geographic distribution of opted-in leads using Leaflet + OpenStreetMap tiles. Sidebar shows aggregated counters (total / geo / top 5 countries / top 5 cities / ungeo). Pins are individual when ≤500 geo-leads; auto-cluster (`react-leaflet-cluster`) above the threshold. Adds a contextual webinar tab nav (`webinar-tabs.tsx`) used by post-publish pages (Leads / Map / Métricas / Webhooks).

## Architecture

**Server page → client lazy-load.** Server `page.tsx` runs Prisma query, computes aggregates via pure helper, passes everything to a client wrapper. Wrapper uses `next/dynamic({ ssr: false })` to lazy-load the actual Leaflet canvas (Leaflet touches `window` and breaks SSR).

**Threshold-based pin strategy.** `LEADS_CLUSTER_THRESHOLD = 500`. Below: `<Marker>` per lead with popup. At/above: `<MarkerClusterGroup>` from `react-leaflet-cluster`. Same data shape; only the wrapper differs.

**Pure aggregate helper.** `lib/leads-map-aggregate.ts` exports `aggregateLeadsForMap(leads)` returning `{ pins, total, geoCount, topCountries, topCities, ungeoCount }`. Easy to unit-test; consumed by both page (sidebar) and client (pin source).

**Pin icon strategy.** Leaflet's default marker assets break under bundlers without manual config. Use `L.divIcon` with inline SVG / emoji to avoid asset-path issues — single source of truth in code.

**No new schema, no new API routes.** Reads exclusively `prisma.lead` rows already populated by D4. Out of scope for D5: filters, real-time, cross-webinar.

## Files

### Created

| Path | Responsibility |
|---|---|
| `apps/web/src/app/dashboard/webinars/[id]/leads-map/page.tsx` | Server: auth + ownership + Prisma fetch + aggregate + render shell |
| `apps/web/src/components/leads-map/leads-map-client.tsx` | Client wrapper. `dynamic({ ssr: false })` imports `LeadsMapCanvas`. Renders skeleton during hydration. |
| `apps/web/src/components/leads-map/leads-map-canvas.tsx` | Real `<MapContainer>` + tiles + pins (cluster vs individual) |
| `apps/web/src/components/leads-map/leads-summary-aside.tsx` | Right sidebar with totals + top 5 countries/cities |
| `apps/web/src/lib/leads-map-aggregate.ts` | Pure: shape leads → `LeadPin[]` + counters |
| `apps/web/src/components/webinar/webinar-tabs.tsx` | Client: contextual tabs (Wizard / Leads / Map / Métricas / Webhooks) using `usePathname` |
| `apps/web/src/test/lib/leads-map-aggregate.test.ts` | Aggregate tests |
| `apps/web/src/test/components/leads-summary-aside.test.tsx` | Sidebar render tests |

### Modified

| Path | Reason |
|---|---|
| `apps/web/package.json` (auto via pnpm) | Add `leaflet`, `react-leaflet`, `react-leaflet-cluster`, `@types/leaflet` |
| `apps/web/src/app/dashboard/webinars/[id]/leads/page.tsx` | Add `<WebinarTabs>` at top |
| `apps/web/src/app/dashboard/webinars/[id]/metrics/page.tsx` | Add `<WebinarTabs>` |
| `apps/web/src/app/dashboard/webinars/[id]/webhooks/page.tsx` | Add `<WebinarTabs>` |
| `README.md` | Document D5 |

## Data Shapes

`LeadPin`:
```ts
export interface LeadPin {
  id: string;
  name: string;
  email: string;
  city: string | null;
  region: string | null;
  country: string | null;
  lat: number;
  lng: number;
  createdAtIso: string;
}
```

`LeadsMapAggregate`:
```ts
export interface LeadsMapAggregate {
  pins: LeadPin[];                                // only leads with lat+lng
  total: number;                                  // all leads for webinar
  geoCount: number;                               // pins.length
  ungeoCount: number;                             // total - geoCount
  topCountries: Array<{ code: string; count: number }>;  // top 5, "Unknown" excluded
  topCities: Array<{ city: string; count: number }>;     // top 5
}
```

## Aggregate Function (`lib/leads-map-aggregate.ts`)

```ts
export interface LeadsMapInputLead {
  id: string;
  name: string;
  email: string;
  city: string | null;
  region: string | null;
  country: string | null;
  lat: number | null;
  lng: number | null;
  createdAt: Date;
}

function topN<K>(map: Map<K, number>, n: number): Array<[K, number]> {
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
}

export function aggregateLeadsForMap(leads: LeadsMapInputLead[]): LeadsMapAggregate {
  const pins: LeadPin[] = [];
  const countriesByCode = new Map<string, number>();
  const citiesByName = new Map<string, number>();

  for (const l of leads) {
    if (l.country) countriesByCode.set(l.country, (countriesByCode.get(l.country) ?? 0) + 1);
    if (l.city) citiesByName.set(l.city, (citiesByName.get(l.city) ?? 0) + 1);
    if (typeof l.lat === "number" && typeof l.lng === "number") {
      pins.push({
        id: l.id, name: l.name, email: l.email,
        city: l.city, region: l.region, country: l.country,
        lat: l.lat, lng: l.lng,
        createdAtIso: l.createdAt.toISOString()
      });
    }
  }

  return {
    pins,
    total: leads.length,
    geoCount: pins.length,
    ungeoCount: leads.length - pins.length,
    topCountries: topN(countriesByCode, 5).map(([code, count]) => ({ code, count })),
    topCities: topN(citiesByName, 5).map(([city, count]) => ({ city, count }))
  };
}
```

## Server Page Contract

```tsx
// apps/web/src/app/dashboard/webinars/[id]/leads-map/page.tsx
export default async function LeadsMapPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) notFound();
  const w = await prisma.webinar.findUnique({ where: { id } });
  if (!w || w.ownerId !== session.user.id) notFound();

  const leads = await prisma.lead.findMany({
    where: { webinarId: id },
    select: { id: true, name: true, email: true, city: true, region: true, country: true, lat: true, lng: true, createdAt: true }
  });

  const agg = aggregateLeadsForMap(leads);

  return (
    <div className="space-y-4">
      <WebinarTabs webinarId={id} />
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <LeadsMapClient pins={agg.pins} />
        <LeadsSummaryAside agg={agg} />
      </div>
    </div>
  );
}
```

## Client Wrapper Contract

```tsx
// apps/web/src/components/leads-map/leads-map-client.tsx
"use client";
import dynamic from "next/dynamic";
import type { LeadPin } from "@/lib/leads-map-aggregate";

const LeadsMapCanvas = dynamic(
  () => import("./leads-map-canvas").then((m) => m.LeadsMapCanvas),
  { ssr: false, loading: () => <div className="h-[600px] animate-pulse rounded-lg bg-muted" /> }
);

export function LeadsMapClient({ pins }: { pins: LeadPin[] }) {
  return <LeadsMapCanvas pins={pins} />;
}
```

## Canvas Contract (`leads-map-canvas.tsx`)

- Imports Leaflet CSS top of file: `import "leaflet/dist/leaflet.css";`
- Default `MapContainer` props: `center={[-15, -55]}`, `zoom={3}`, `style={{ height: 600 }}`, `scrollWheelZoom={true}`
- Tile layer: OpenStreetMap with attribution
- Cluster decision: `pins.length >= 500 ? <MarkerClusterGroup>{markers}</MarkerClusterGroup> : <>{markers}</>`
- Marker icon: `L.divIcon({ className: "...", html: "<div class='hw-pin'>📍</div>" })` to avoid Leaflet default icon URL pitfall
- Popup content: `<strong>{name}</strong><br/>{email}<br/>{city, region, country}<br/>{new Date(createdAtIso).toLocaleDateString("pt-BR")}`

## Sidebar Contract (`leads-summary-aside.tsx`)

```
- "Total" big number
- "Com geolocalização" small caption "{geoCount} ({pct}%)"
- Top 5 países section (each row: flag/code + count + bar fraction)
- Top 5 cidades section (city + count)
- "Sem geolocalização" {ungeoCount} small caption
```

Uses `Intl.NumberFormat("pt-BR")` for counts. Country code → flag emoji via `String.fromCodePoint(127397 + char.charCodeAt(0))` for each letter (standard ISO-2 → flag).

## Webinar Tabs Contract

```tsx
// apps/web/src/components/webinar/webinar-tabs.tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface Props { webinarId: string }

const TABS = [
  { label: "Editor", suffix: "/step-1" },
  { label: "Leads", suffix: "/leads" },
  { label: "Mapa", suffix: "/leads-map" },
  { label: "Métricas", suffix: "/metrics" },
  { label: "Webhooks", suffix: "/webhooks" }
];

export function WebinarTabs({ webinarId }: Props) {
  const pathname = usePathname() ?? "";
  const base = `/dashboard/webinars/${webinarId}`;
  return (
    <nav className="flex gap-1 border-b">
      {TABS.map((t) => {
        const href = `${base}${t.suffix}`;
        const active = pathname === href || (t.suffix === "/step-1" && pathname.includes("/step-"));
        return (
          <Link key={t.label} href={href} className={cn("border-b-2 px-4 py-2 text-sm transition-colors", active ? "border-primary text-foreground font-medium" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
```

Editor tab is "active" for any wizard step page. Other tabs match exact pathname.

## Tests

| File | Cases |
|---|---|
| `test/lib/leads-map-aggregate.test.ts` | empty array → zeros; mixed null lat/lng → only valid pins; lat/lng null but country set → counts country, no pin; top 5 capping; topCountries excludes null country code; ungeoCount = total - pins.length |
| `test/components/leads-summary-aside.test.tsx` | renders total + geo + ungeo + top lists; flag emoji for "BR" present; pt-BR numeric formatting (`1.247`) |

`leads-map-canvas.tsx` not unit-tested (Leaflet + jsdom tricky). Smoke via browser. `leads-map-client.tsx` not tested directly — it's a thin dynamic wrapper.

## Library Install

```
pnpm --filter web add leaflet react-leaflet react-leaflet-cluster
pnpm --filter web add -D @types/leaflet
```

react-leaflet 4.x peers React 18 — same RC peer-dep warning as other Radix packages. Acceptable.

## Out of Scope

- Date / country / UTM filters
- Heatmap mode
- Cross-webinar / global aggregate map
- Export CSV / PDF
- SSE / real-time pin updates
- Reverse-geocode missing fields (D4 already best-effort)
- Per-cluster popup with breakdown

## Acceptance

- `WebinarTabs` rendered on `/leads`, `/leads-map`, `/metrics`, `/webhooks`. Active tab highlighted.
- `/dashboard/webinars/[id]/leads-map` renders Leaflet map with OSM tiles, centered Brazil-default.
- Leads with `lat+lng` non-null show as pins. Click → popup with name/email/city/region/country/date.
- ≤500 pins: individual markers. >500: `<MarkerClusterGroup>` wraps.
- Sidebar shows total, geo count, top 5 countries (with flags), top 5 cities, ungeo count.
- Map lazy-loaded (skeleton placeholder during hydration).
- Page server-renders shell + sidebar instantly.
- Typecheck + tests green.
