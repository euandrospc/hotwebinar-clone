import { zonedParts, zonedToUtc } from "@/lib/timezones";
import type { WebinarRealtimeSnapshot } from "@/lib/webinar-realtime-v5";

const SAMPLE_MS = 15_000;
const HOUR_MS = 60 * 60 * 1_000;
const DEFAULT_TIMEZONE = "America/Sao_Paulo";

export interface RealtimeKpiPoint {
  /** Observed timestamp; calendar-day revenue uses UTC noon. */
  x: number;
  /** Exact observation ISO, revenue YYYY-MM-DD, or null for a missing sample. */
  at: string | null;
  value: number | null;
  count?: number;
}

export interface RealtimeKpiSeries {
  value: number | null;
  points: RealtimeKpiPoint[];
}

export interface RealtimeKpis {
  live: RealtimeKpiSeries;
  audience: RealtimeKpiSeries;
  revenue: RealtimeKpiSeries;
  updatedAt: string;
  timezone: string;
}

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function timezoneFor(snapshot: WebinarRealtimeSnapshot) {
  const timezone = snapshot.sales?.timezone || DEFAULT_TIMEZONE;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    return timezone;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

function calendarDate(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function buildRealtimeAudiencePoints(history: NonNullable<WebinarRealtimeSnapshot["audience"]>["history"], start: number, cutoff: number): RealtimeKpiPoint[] {
  if (!history || !Number.isFinite(start) || !Number.isFinite(cutoff)) return [];
  const from = Math.max(start, Date.parse(history.from));
  const to = Math.min(cutoff, Date.parse(history.to));
  if (!Number.isFinite(from) || !Number.isFinite(to) || from > to) return [];

  const observed = new Map<number, RealtimeKpiPoint>();
  for (const point of history.points) {
    const x = Date.parse(point.at);
    if (!Number.isFinite(x) || x < from || x > to || !isCount(point.online)) continue;
    const slot = Math.floor(x / SAMPLE_MS);
    const previous = observed.get(slot);
    if (!previous || previous.x <= x) observed.set(slot, { x, at: point.at, value: point.online });
  }
  if (!observed.size) return [];

  // Missing readings remain gaps. Never extend the series or append the live KPI.
  const slots = [...observed.keys()].sort((a, b) => a - b);
  const result: RealtimeKpiPoint[] = [];
  for (let slot = slots[0]; slot <= slots[slots.length - 1]; slot += 1) {
    result.push(observed.get(slot) ?? { x: slot * SAMPLE_MS, at: null, value: null });
  }
  return result;
}

function revenuePoints(snapshot: WebinarRealtimeSnapshot, cutoff: number, timezone: string): RealtimeKpiPoint[] {
  const month = snapshot.sales?.month;
  if (!month || !Number.isFinite(cutoff)) return [];
  const from = Date.parse(month.from);
  const to = Math.min(Date.parse(month.to), cutoff);
  if (!Number.isFinite(from) || !Number.isFinite(to) || from > to) return [];

  const current = zonedParts(new Date(cutoff), timezone);
  const first = zonedParts(new Date(from), timezone);
  const last = zonedParts(new Date(to), timezone);
  if (first.y !== current.y || first.mo !== current.mo || last.y !== current.y || last.mo !== current.mo) return [];
  const firstDate = calendarDate(first.y, first.mo, first.d);
  const lastDate = calendarDate(last.y, last.mo, last.d);
  const observed = new Map<string, RealtimeKpiPoint>();

  for (const point of month.points) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(point.date) || point.date < firstDate || point.date > lastDate) continue;
    if (!isCount(point.revenueCents) || !isCount(point.count)) continue;
    const x = Date.parse(`${point.date}T12:00:00.000Z`);
    if (!Number.isFinite(x) || new Date(x).toISOString().slice(0, 10) !== point.date) continue;
    observed.set(point.date, { x, at: point.date, value: point.revenueCents / 100, count: point.count });
  }
  if (!observed.size) return [];

  return Array.from({ length: last.d }, (_, index) => {
    const date = calendarDate(current.y, current.mo, index + 1);
    return observed.get(date) ?? { x: Date.parse(`${date}T12:00:00.000Z`), at: date, value: null };
  });
}

/** Display adapter only: KPI totals retain the server's scope and frozen cutoff. */
export function buildRealtimeKpis(snapshot: WebinarRealtimeSnapshot): RealtimeKpis {
  const timezone = timezoneFor(snapshot);
  const cutoff = Date.parse(snapshot.updatedAt);
  let dayStart = Number.NaN;
  if (Number.isFinite(cutoff)) {
    const today = zonedParts(new Date(cutoff), timezone);
    dayStart = zonedToUtc(today.y, today.mo, today.d, 0, 0, 0, timezone).getTime();
  }
  const average = snapshot.audience?.average;
  const revenueCents = snapshot.sales?.today.revenueCents;

  return {
    updatedAt: snapshot.updatedAt,
    timezone,
    live: {
      value: isCount(snapshot.online) ? snapshot.online : null,
      points: buildRealtimeAudiencePoints(snapshot.audience?.liveHistory ?? snapshot.audience?.history, cutoff - HOUR_MS, cutoff)
    },
    audience: {
      value: typeof average === "number" && Number.isFinite(average) && average >= 0 ? average : null,
      points: buildRealtimeAudiencePoints(snapshot.audience?.history, dayStart, cutoff)
    },
    revenue: {
      value: isCount(revenueCents) ? revenueCents / 100 : null,
      points: revenuePoints(snapshot, cutoff, timezone)
    }
  };
}
