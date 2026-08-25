export interface FunnelStage {
  label: string;
  count: number;
  pct: number;
}

export interface DailyParticipants {
  date: string;
  count: number;
}

export interface DeviceBreakdown {
  desktop: number;
  mobile: number;
  desktopPct: number;
  mobilePct: number;
}

export interface DashboardStatsInput {
  leads: Array<{
    sessionStart: Date;
    enterFired: boolean;
    reachedPitch: boolean;
    ctaClicks: number;
    userAgent: string | null;
  }>;
  rangeStart: Date;
  rangeEnd: Date;
  scheduledDates: Date[];
}

export function buildFunnel(input: DashboardStatsInput): FunnelStage[] {
  const total = input.leads.length;
  const acessou = input.leads.filter((l) => l.enterFired).length;
  const pitch = input.leads.filter((l) => l.reachedPitch).length;
  const cliques = input.leads.filter((l) => l.ctaClicks > 0).length;
  const comprou = 0; // No purchase tracking yet — Firepay paywall stub
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 10000) / 100 : 0);
  return [
    { label: "Visitas", count: total, pct: pct(total) },
    { label: "Acessou o webinar", count: acessou, pct: pct(acessou) },
    { label: "Chegou no pitch", count: pitch, pct: pct(pitch) },
    { label: "Clicou na oferta", count: cliques, pct: pct(cliques) },
    { label: "Comprou", count: comprou, pct: pct(comprou) }
  ];
}

export function buildDailyParticipants(input: DashboardStatsInput): DailyParticipants[] {
  const buckets = new Map<string, number>();
  const start = new Date(input.rangeStart);
  start.setHours(0, 0, 0, 0);
  const end = new Date(input.rangeEnd);
  end.setHours(0, 0, 0, 0);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    buckets.set(toBucketKey(d), 0);
  }
  for (const l of input.leads) {
    const k = toBucketKey(l.sessionStart);
    if (buckets.has(k)) buckets.set(k, (buckets.get(k) ?? 0) + 1);
  }
  return [...buckets.entries()].map(([date, count]) => ({ date, count }));
}

function toBucketKey(d: Date): string {
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}`;
}

export function buildDeviceBreakdown(input: DashboardStatsInput): DeviceBreakdown {
  let desktop = 0;
  let mobile = 0;
  for (const l of input.leads) {
    const ua = (l.userAgent ?? "").toLowerCase();
    if (!ua) continue;
    if (/mobi|android|iphone|ipad|ipod/.test(ua)) mobile++;
    else desktop++;
  }
  const total = desktop + mobile;
  const desktopPct = total > 0 ? Math.round((desktop / total) * 10000) / 100 : 0;
  const mobilePct = total > 0 ? Math.round((mobile / total) * 10000) / 100 : 0;
  return { desktop, mobile, desktopPct, mobilePct };
}

export interface RetentionPoint {
  sec: number;
  label: string;
  count: number;
}

function fmtClock(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

export function buildRetention(
  watchedSecs: number[],
  durationSec: number,
  points = 42
): RetentionPoint[] {
  const dur = Math.max(1, durationSec);
  const step = dur / points;
  const out: RetentionPoint[] = [];
  for (let i = 0; i <= points; i++) {
    const sec = Math.round(i * step);
    const count = watchedSecs.filter((w) => w >= sec).length;
    out.push({ sec, label: fmtClock(sec), count });
  }
  return out;
}

export interface RegionRow {
  label: string;
  count: number;
  pct: number;
}

export interface RegionBreakdown {
  rows: RegionRow[];
  total: number;
  located: number;
}

export function buildRegionBreakdown(
  leads: Array<{ region: string | null; city: string | null; country: string | null }>,
  top = 6
): RegionBreakdown {
  const counts = new Map<string, number>();
  let located = 0;
  for (const l of leads) {
    const label = (l.region || l.city || l.country || "").trim();
    if (!label) continue;
    located++;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  const total = leads.length;
  const rows = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, top)
    .map(([label, count]) => ({
      label,
      count,
      pct: located > 0 ? Math.round((count / located) * 10000) / 100 : 0
    }));
  return { rows, total, located };
}

export interface WebinarKpis {
  visitas: number;
  acessou: number;
  clicouVideo: number;
  min15: number;
  min30: number;
  min45: number;
  min60: number;
  pitch: number;
  oferta: number;
  cliqueOferta: number;
  chat: number;
  comprou: number;
}

export function avgWatchedMinutes(leads: Array<{ watchedSec: number }>): number {
  if (leads.length === 0) return 0;
  const sum = leads.reduce((acc, l) => acc + l.watchedSec, 0);
  return Math.round(sum / leads.length / 60);
}

export interface SalesKpis {
  totalRevenueCents: number;
  totalSales: number;
  uniqueBuyers: number;
  revenuePerUserCents: number;
}

export function buildSalesKpis(
  sales: Array<{ amount: number; buyerEmail: string | null; leadId: string | null }>
): SalesKpis {
  const totalRevenueCents = sales.reduce((acc, s) => acc + s.amount, 0);
  const buyers = new Set<string>();
  for (const s of sales) {
    const key = s.leadId ?? s.buyerEmail;
    if (key) buyers.add(key);
  }
  const uniqueBuyers = buyers.size;
  const revenuePerUserCents = uniqueBuyers > 0 ? Math.round(totalRevenueCents / uniqueBuyers) : 0;
  return {
    totalRevenueCents,
    totalSales: sales.length,
    uniqueBuyers,
    revenuePerUserCents
  };
}
