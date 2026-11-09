import { describe, expect, it } from "vitest";
import {
  buildDashboardOverview,
  type BuildDashboardOverviewInput,
  type DashboardOverviewEvent,
  type DashboardOverviewSale
} from "@/lib/dashboard-overview";

const start = new Date("2026-11-01T03:00:00.000Z");
const end = new Date("2026-11-08T02:59:59.999Z");
const at = new Date("2026-11-04T15:00:00.000Z");

function event(leadId: string, kind: DashboardOverviewEvent["kind"], overrides: Partial<DashboardOverviewEvent> = {}): DashboardOverviewEvent {
  return { webinarId: "w1", leadId, kind, firstOccurredAt: at, ...overrides };
}

function sale(id: string, leadId: string | null, amount: number, overrides: Partial<DashboardOverviewSale> = {}): DashboardOverviewSale {
  return { id, webinarId: "w1", leadId, amount, currency: "BRL", createdAt: at, ...overrides };
}

function build(overrides: Partial<BuildDashboardOverviewInput> = {}) {
  return buildDashboardOverview({
    webinars: [
      { id: "w1", title: "Primeiro webinar", status: "ACTIVE", mode: "UNICO" },
      { id: "w2", title: "Webinar em rascunho", status: "DRAFT", mode: "JIT" }
    ],
    events: [], sales: [], rangeStart: start, rangeEnd: end,
    ...overrides
  });
}

describe("dashboard overview aggregation", () => {
  it("counts in-platform returns as accesses while keeping all BRL sales separate from conversion", () => {
    const overview = build({
      events: [
        event("a", "OPTIN"), event("b", "OPTIN"), event("c", "OPTIN"),
        event("a", "VIDEO_TICK"), event("previous-registration", "VIDEO_TICK"),
        event("b", "OFFER_CLICK")
      ],
      sales: [
        sale("s1", "a", 10_000), sale("s2", "a", 20_000), sale("s3", "b", 30_000),
        sale("s4", "previous-registration", 40_000), sale("unlinked", null, 50_000),
        sale("foreign-currency", "c", 60_000, { currency: "USD" }),
        sale("foreign-owner", "a", 70_000, { webinarId: "not-owned" })
      ]
    });
    expect(overview.totals).toEqual({
      revenueCents: 150_000, sales: 5, registrations: 4, viewers: 2,
      attendees: 2, attendanceRate: 50,
      convertedLeads: 3, conversionRate: 75
    });
    expect(overview.funnel.map(({ count }) => count)).toEqual([4, 2, 0, 1, 3]);
    // A linked purchase does not require an OFFER_CLICK; chat checkouts are valid.
    expect(overview.funnel[4].pct).toBe(75);
    expect(overview.excludedCurrencySales).toBe(1);
  });

  it("deduplicates observed accesses, heartbeats and buyers while retaining separate payments", () => {
    const overview = build({
      events: [
        event("a", "OPTIN"), event("a", "OPTIN"),
        event("a", "VIDEO_TICK"), event("a", "VIDEO_TICK"), event("a", "VIDEO_TICK"),
        event("a", "OFFER_CLICK"), event("a", "OFFER_CLICK")
      ],
      sales: [sale("s1", "a", 100), sale("s1", "a", 100), sale("s2", "a", 200)]
    });
    expect(overview.totals).toEqual({
      revenueCents: 300, sales: 2, registrations: 1, viewers: 1,
      attendees: 1, attendanceRate: 100,
      convertedLeads: 1, conversionRate: 100
    });
    expect(overview.funnel.map(({ count }) => count)).toEqual([1, 1, 0, 1, 1]);
    expect(overview.funnelTransitions.map(({ overlapCount }) => overlapCount)).toEqual([1, 0, 0, 1]);
    expect(overview.funnelTransitions[3]).toMatchObject({ overlapCount: 1, previousOnlyCount: 0, currentOnlyCount: 0, overlapRate: 100 });
  });

  it("intersects actual people rather than subtracting independent stage totals", () => {
    const overview = build({
      events: [
        event("all", "VIDEO_TICK"), event("all", "PITCH_REACHED"), event("all", "OFFER_CLICK"),
        event("play-only", "VIDEO_TICK"), event("pitch-only", "PITCH_REACHED"),
        event("click-only", "OFFER_CLICK"), event("buyer-no-click", "OPTIN")
      ],
      // A purchase before an offer click still counts as co-occurrence in the
      // period; no chronological conversion or causality is inferred.
      sales: [
        sale("earlier-purchase", "all", 100, { createdAt: new Date("2026-11-02T15:00:00Z") }),
        sale("chat-purchase", "buyer-no-click", 100),
        sale("unobserved-purchase", "unseen", 100),
        sale("non-brl", "click-only", 100, { currency: "USD" })
      ]
    });
    expect(overview.funnel.map(({ count }) => count)).toEqual([5, 2, 2, 2, 2]);
    expect(overview.funnelTransitions).toEqual([
      { fromLabel: "Acessos", toLabel: "Assistiram", fromCount: 5, toCount: 2, overlapCount: 2, previousOnlyCount: 3, currentOnlyCount: 0, overlapRate: 40 },
      { fromLabel: "Assistiram", toLabel: "Chegaram ao pitch", fromCount: 2, toCount: 2, overlapCount: 1, previousOnlyCount: 1, currentOnlyCount: 1, overlapRate: 50 },
      { fromLabel: "Chegaram ao pitch", toLabel: "Clicaram na oferta", fromCount: 2, toCount: 2, overlapCount: 1, previousOnlyCount: 1, currentOnlyCount: 1, overlapRate: 50 },
      { fromLabel: "Clicaram na oferta", toLabel: "Compraram", fromCount: 2, toCount: 2, overlapCount: 1, previousOnlyCount: 1, currentOnlyCount: 1, overlapRate: 50 }
    ]);
  });

  it("counts a unique participation separately for each webinar and never crosses attribution", () => {
    const overview = build({
      events: [event("same-key", "OFFER_CLICK"), event("same-key", "OPTIN", { webinarId: "w2" })],
      sales: [sale("s1", "same-key", 200, { webinarId: "w2" })]
    });
    expect(overview.totals.registrations).toBe(2);
    expect(overview.totals.conversionRate).toBe(50);
    expect(overview.webinars[0]).toMatchObject({ id: "w2", convertedLeads: 1, conversionRate: 100 });
    expect(overview.webinars[1]).toMatchObject({ id: "w1", convertedLeads: 0, conversionRate: 0 });
    expect(overview.funnelTransitions[3]).toMatchObject({ fromCount: 1, toCount: 1, overlapCount: 0, previousOnlyCount: 1, currentOnlyCount: 1, overlapRate: 0 });
  });

  it("places each participation on its first event inside the period, not on every heartbeat day", () => {
    const earlier = new Date("2026-11-02T17:00:00Z");
    const overview = build({
      events: [
        event("a", "OPTIN"),
        event("a", "VIDEO_TICK"), event("a", "VIDEO_TICK", { firstOccurredAt: earlier })
      ],
      sales: [sale("s1", "a", 38900)]
    });
    expect(overview.daily.find(({ date }) => date === "2026-11-02")).toMatchObject({ registrations: 1, viewers: 1, revenueCents: 0 });
    expect(overview.daily.find(({ date }) => date === "2026-11-04")).toMatchObject({ registrations: 0, viewers: 0, revenueCents: 38900, sales: 1 });
    expect(overview.daily.reduce((sum, day) => sum + day.registrations, 0)).toBe(overview.totals.registrations);
    expect(overview.daily.reduce((sum, day) => sum + day.viewers, 0)).toBe(overview.totals.viewers);
  });

  it("uses São Paulo calendar days across UTC midnight and year boundaries", () => {
    const overview = build({
      rangeStart: new Date("2025-12-31T03:00:00Z"),
      rangeEnd: new Date("2026-01-02T02:59:59.999Z"),
      events: [
        event("december", "OPTIN", { firstOccurredAt: new Date("2026-01-01T02:59:59Z") }),
        event("january", "OPTIN", { firstOccurredAt: new Date("2026-01-01T03:00:00Z") })
      ]
    });
    expect(overview.daily.map(({ date, label, registrations }) => ({ date, label, registrations }))).toEqual([
      { date: "2025-12-31", label: "31/12", registrations: 1 },
      { date: "2026-01-01", label: "01/01", registrations: 1 }
    ]);
  });

  it("includes cookie returns and observed actions without requiring an in-period OPTIN", () => {
    const overview = build({
      events: [event("cookie-return", "VIDEO_TICK"), event("offer-only", "OFFER_CLICK"), event("pitch-only", "PITCH_REACHED")],
      sales: [sale("return-purchase", "cookie-return", 38900), sale("no-observed-access", "unseen", 10000)]
    });
    expect(overview.totals).toMatchObject({ registrations: 3, viewers: 1, attendees: 1, attendanceRate: 33.33, convertedLeads: 1, conversionRate: 33.33, sales: 2 });
    expect(overview.funnel).toEqual([
      { label: "Acessos", count: 3, pct: 100 },
      { label: "Assistiram", count: 1, pct: 33.33 },
      { label: "Chegaram ao pitch", count: 1, pct: 33.33 },
      { label: "Clicaram na oferta", count: 1, pct: 33.33 },
      { label: "Compraram", count: 1, pct: 33.33 }
    ]);
  });

  it("recovers pitch from the period's player positions without double-counting its one-shot event", () => {
    const overview = build({
      webinars: [
        { id: "w1", title: "Com pitch", status: "ACTIVE", mode: "UNICO", pitchAtSec: 120 },
        { id: "w2", title: "Sem pitch", status: "ACTIVE", mode: "JIT", pitchAtSec: null }
      ],
      events: [
        event("before-pitch", "VIDEO_TICK", { maxVideoSec: 119 }),
        event("at-pitch", "VIDEO_TICK", { maxVideoSec: 120 }),
        event("at-pitch", "PITCH_REACHED"),
        event("one-shot-return", "PITCH_REACHED", { firstOccurredAt: new Date(start.getTime() - 1) }),
        event("one-shot-return", "VIDEO_TICK", { maxVideoSec: 300 }),
        event("explicit-only", "PITCH_REACHED"),
        event("no-config", "VIDEO_TICK", { webinarId: "w2", maxVideoSec: 9999 })
      ]
    });
    expect(overview.totals).toMatchObject({ registrations: 5, viewers: 4, attendees: 4, attendanceRate: 80 });
    expect(overview.funnel[2]).toEqual({ label: "Chegaram ao pitch", count: 3, pct: 60 });
    expect(overview.funnelTransitions[1]).toMatchObject({ fromCount: 4, toCount: 3, overlapCount: 2, previousOnlyCount: 2, currentOnlyCount: 1, overlapRate: 50 });
  });

  it("rejects out-of-range/unowned data and preserves all owned webinar rows", () => {
    const overview = build({
      events: [
        event("before", "OPTIN", { firstOccurredAt: new Date(start.getTime() - 1) }),
        event("after", "VIDEO_TICK", { firstOccurredAt: new Date(end.getTime() + 1) }),
        event("foreign", "OPTIN", { webinarId: "not-owned" })
      ],
      sales: [sale("old", null, 999, { createdAt: new Date(start.getTime() - 1) })]
    });
    expect(overview.webinars).toHaveLength(2);
    expect(overview.webinars.find(({ id }) => id === "w2")).toMatchObject({ status: "DRAFT", sales: 0, conversionRate: null });
    expect(overview.totals).toEqual({
      revenueCents: 0, sales: 0, registrations: 0, viewers: 0,
      attendees: 0, attendanceRate: null, convertedLeads: 0, conversionRate: null
    });
    expect(overview.daily).toHaveLength(7);
    expect(overview.funnel.every(({ pct }) => pct === 0)).toBe(true);
    expect(overview.funnelTransitions).toHaveLength(4);
    for (const transition of overview.funnelTransitions) {
      expect(transition).toMatchObject({ fromCount: 0, toCount: 0, overlapCount: 0, previousOnlyCount: 0, currentOnlyCount: 0, overlapRate: null });
    }
  });

  it("includes both normalized bounds and keeps receipts without lead attribution out of conversion", () => {
    const overview = build({
      events: [event("at-start", "OPTIN", { firstOccurredAt: start }), event("at-end", "OPTIN", { firstOccurredAt: end })],
      sales: [sale("receipt", null, 12345, { createdAt: end, currency: "brl" })]
    });
    expect(overview.totals).toMatchObject({ registrations: 2, sales: 1, revenueCents: 12345, convertedLeads: 0, conversionRate: 0 });
    expect(overview.excludedCurrencySales).toBe(0);
  });

  it("rejects invalid and reversed date ranges", () => {
    expect(() => build({ rangeStart: new Date("invalid") })).toThrow(RangeError);
    expect(() => build({ rangeStart: end, rangeEnd: start })).toThrow(RangeError);
  });
});
