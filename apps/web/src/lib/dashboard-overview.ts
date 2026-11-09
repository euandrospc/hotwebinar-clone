import type { FunnelStage } from "@/lib/dashboard-stats";

export const DASHBOARD_TIME_ZONE = "America/Sao_Paulo";
export const DASHBOARD_EVENT_KINDS = ["OPTIN", "VIDEO_TICK", "PITCH_REACHED", "OFFER_CLICK"] as const;

export interface DashboardOverviewTotals {
  revenueCents: number;
  sales: number;
  /** Compatibility name: unique accesses observed inside the platform, not acquired leads or registrations. */
  registrations: number;
  viewers: number;
  /** Playback recorded in this period. Same population as viewers. */
  attendees: number;
  attendanceRate: number | null;
  convertedLeads: number;
  /** Percentage from 0 to 100, or null when there are no observed accesses. */
  conversionRate: number | null;
}

export interface DashboardOverviewDailyPoint {
  date: string;
  label: string;
  /** Observed accesses, placed on the first in-platform event in the period. */
  registrations: number;
  viewers: number;
  revenueCents: number;
  sales: number;
}

export interface DashboardOverviewWebinarInput {
  id: string;
  title: string;
  name?: string;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  mode: "UNICO" | "JIT";
  pitchAtSec?: number | null;
}

export interface DashboardOverviewWebinar extends DashboardOverviewTotals {
  id: string;
  title: string;
  status: DashboardOverviewWebinarInput["status"];
  mode: DashboardOverviewWebinarInput["mode"];
}

/** Co-occurrence in the selected period, never proof of chronological progression. */
export interface DashboardFunnelTransition {
  fromLabel: string;
  toLabel: string;
  fromCount: number;
  toCount: number;
  /** Unique (webinar, person) pairs observed in both adjacent stages. */
  overlapCount: number;
  previousOnlyCount: number;
  currentOnlyCount: number;
  /** overlapCount / fromCount as a percentage; unknown when fromCount is zero. */
  overlapRate: number | null;
}

export interface DashboardOverview {
  totals: DashboardOverviewTotals;
  funnel: FunnelStage[];
  funnelTransitions: DashboardFunnelTransition[];
  daily: DashboardOverviewDailyPoint[];
  webinars: DashboardOverviewWebinar[];
  excludedCurrencySales: number;
}

/** The first occurrence for this webinar/lead/kind inside the selected period. */
export interface DashboardOverviewEvent {
  webinarId: string;
  leadId: string | null;
  kind: (typeof DASHBOARD_EVENT_KINDS)[number];
  firstOccurredAt: Date;
  /** Greatest recorded player position for this group inside the selected period. */
  maxVideoSec?: number | null;
}

export interface DashboardOverviewSale {
  id: string;
  webinarId: string | null;
  leadId: string | null;
  amount: number;
  currency: string;
  createdAt: Date;
}

export interface BuildDashboardOverviewInput {
  webinars: readonly DashboardOverviewWebinarInput[];
  events: readonly DashboardOverviewEvent[];
  sales: readonly DashboardOverviewSale[];
  rangeStart: Date;
  rangeEnd: Date;
}

const dayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: DASHBOARD_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});

function dateKey(date: Date): string {
  const parts = dayFormatter.formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)!.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function emptyTotals(): DashboardOverviewTotals {
  return {
    revenueCents: 0, sales: 0, registrations: 0, viewers: 0,
    attendees: 0, attendanceRate: null, convertedLeads: 0, conversionRate: null
  };
}

function percentage(count: number, total: number): number | null {
  return total ? Math.round(count / total * 10_000) / 100 : null;
}

function createDailyPoints(start: Date, end: Date): Map<string, DashboardOverviewDailyPoint> {
  const first = dateKey(start);
  const last = dateKey(end);
  const cursor = new Date(`${first}T00:00:00Z`);
  const points = new Map<string, DashboardOverviewDailyPoint>();
  // Increment calendar dates in UTC after extracting São Paulo's wall-clock day.
  // ISO keys retain the year, so equal day/month values never merge across years.
  while (cursor.toISOString().slice(0, 10) <= last) {
    const date = cursor.toISOString().slice(0, 10);
    points.set(date, {
      date, label: `${date.slice(8, 10)}/${date.slice(5, 7)}`,
      registrations: 0, viewers: 0, revenueCents: 0, sales: 0
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return points;
}

/**
 * Uses recorded events, never mutable Lead.sessionStart/enterFired snapshots.
 * An observed access is a (webinarId, leadId) pair with any supported in-platform
 * event. Cookie returns count even when acquisition happened outside the app.
 * registrations remains an internal compatibility alias for these accesses.
 * Funnel stages are independent: a purchase does not require an offer click,
 * because checkout links may also come from the chat.
 * Sales/revenue are BRL records received in the period, regardless of cohort.
 * Bounds are inclusive; callers normalize the selected end minute/day.
 */
export function buildDashboardOverview(input: BuildDashboardOverviewInput): DashboardOverview {
  const start = input.rangeStart.getTime();
  const end = input.rangeEnd.getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) {
    throw new RangeError("Invalid dashboard date range");
  }
  const inRange = (date: Date) => date.getTime() >= start && date.getTime() <= end;
  const daily = createDailyPoints(input.rangeStart, input.rangeEnd);
  const states = new Map(input.webinars.map((webinar) => [webinar.id, {
    row: {
      ...emptyTotals(), id: webinar.id, title: webinar.title.trim() || webinar.name?.trim() || "Sem título",
      status: webinar.status, mode: webinar.mode
    } satisfies DashboardOverviewWebinar,
    accesses: new Map<string, Date>(),
    OPTIN: new Map<string, Date>(),
    VIDEO_TICK: new Map<string, Date>(),
    PITCH_REACHED: new Map<string, Date>(),
    OFFER_CLICK: new Map<string, Date>(),
    pitchAtSec: webinar.pitchAtSec,
    pitchViewers: new Set<string>(),
    buyers: new Set<string>()
  }]));

  for (const event of input.events) {
    const state = states.get(event.webinarId);
    if (!state || !event.leadId || !inRange(event.firstOccurredAt)) continue;
    const previous = state[event.kind].get(event.leadId);
    if (!previous || event.firstOccurredAt < previous) state[event.kind].set(event.leadId, event.firstOccurredAt);
    const firstAccess = state.accesses.get(event.leadId);
    if (!firstAccess || event.firstOccurredAt < firstAccess) state.accesses.set(event.leadId, event.firstOccurredAt);
    if (event.kind === "PITCH_REACHED" || (
      event.kind === "VIDEO_TICK" &&
      typeof state.pitchAtSec === "number" && Number.isFinite(state.pitchAtSec) && state.pitchAtSec >= 0 &&
      typeof event.maxVideoSec === "number" && Number.isFinite(event.maxVideoSec) && event.maxVideoSec >= state.pitchAtSec
    )) state.pitchViewers.add(event.leadId);
  }

  let excludedCurrencySales = 0;
  const seenSales = new Set<string>();
  for (const sale of input.sales) {
    const state = sale.webinarId ? states.get(sale.webinarId) : undefined;
    if (!state || !inRange(sale.createdAt) || seenSales.has(sale.id)) continue;
    seenSales.add(sale.id);
    if (sale.currency.trim().toUpperCase() !== "BRL") {
      excludedCurrencySales++;
      continue;
    }
    state.row.revenueCents += sale.amount;
    state.row.sales++;
    const point = daily.get(dateKey(sale.createdAt))!;
    point.revenueCents += sale.amount;
    point.sales++;
    // Never guess a lead from buyerEmail. Multiple payments from one lead are
    // multiple sales, but only one converted member of this webinar's cohort.
    if (sale.leadId && state.accesses.has(sale.leadId)) state.buyers.add(sale.leadId);
  }

  const totals = emptyTotals();
  let cohortClicks = 0;
  let cohortPitch = 0;
  const overlaps = [0, 0, 0, 0];
  for (const state of states.values()) {
    state.row.registrations = state.accesses.size;
    state.row.viewers = state.VIDEO_TICK.size;
    state.row.attendees = state.row.viewers;
    state.row.convertedLeads = state.buyers.size;
    state.row.conversionRate = percentage(state.row.convertedLeads, state.row.registrations);
    for (const firstSeen of state.accesses.values()) {
      daily.get(dateKey(firstSeen))!.registrations++;
    }
    cohortClicks += state.OFFER_CLICK.size;
    cohortPitch += state.pitchViewers.size;
    // Keep webinar attribution: an event in one webinar cannot match a person
    // seen in another. The stages may be non-nested or recorded out of order.
    const populations = [state.accesses, state.VIDEO_TICK, state.pitchViewers, state.OFFER_CLICK, state.buyers];
    for (let index = 1; index < populations.length; index++) {
      const previous = populations[index - 1];
      const current = populations[index];
      for (const leadId of previous.keys()) {
        if (current.has(leadId)) overlaps[index - 1]++;
      }
    }
    state.row.attendanceRate = percentage(state.row.attendees, state.row.registrations);
    for (const firstSeen of state.VIDEO_TICK.values()) daily.get(dateKey(firstSeen))!.viewers++;
    totals.registrations += state.row.registrations;
    totals.viewers += state.row.viewers;
    totals.attendees += state.row.attendees;
    totals.sales += state.row.sales;
    totals.revenueCents += state.row.revenueCents;
    totals.convertedLeads += state.row.convertedLeads;
  }
  totals.conversionRate = percentage(totals.convertedLeads, totals.registrations);
  totals.attendanceRate = percentage(totals.attendees, totals.registrations);
  const funnel = [
    { label: "Acessos", count: totals.registrations },
    { label: "Assistiram", count: totals.attendees },
    { label: "Chegaram ao pitch", count: cohortPitch },
    { label: "Clicaram na oferta", count: cohortClicks },
    { label: "Compraram", count: totals.convertedLeads }
  ].map((stage) => ({ ...stage, pct: percentage(stage.count, totals.registrations) ?? 0 }));

  return {
    totals,
    funnel,
    funnelTransitions: funnel.slice(1).map((stage, index) => ({
      fromLabel: funnel[index].label,
      toLabel: stage.label,
      fromCount: funnel[index].count,
      toCount: stage.count,
      overlapCount: overlaps[index],
      previousOnlyCount: funnel[index].count - overlaps[index],
      currentOnlyCount: stage.count - overlaps[index],
      overlapRate: percentage(overlaps[index], funnel[index].count)
    })),
    daily: [...daily.values()],
    webinars: [...states.values()].map(({ row }) => row).sort((a, b) =>
      b.revenueCents - a.revenueCents || b.sales - a.sales || b.registrations - a.registrations ||
      a.title.localeCompare(b.title, "pt-BR") || a.id.localeCompare(b.id)
    ),
    excludedCurrencySales
  };
}
