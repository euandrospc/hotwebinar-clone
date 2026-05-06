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

export function avgWatchedMinutes(leads: Array<{ watchedSec: number }>): number {
  if (leads.length === 0) return 0;
  const sum = leads.reduce((acc, l) => acc + l.watchedSec, 0);
  return Math.round(sum / leads.length / 60);
}
