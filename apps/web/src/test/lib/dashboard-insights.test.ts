import { describe, expect, it } from "vitest";
import {
  BRAZIL_REGIONS, buildDashboardInsights, dashboardComparisonRange, normalizeBrazilRegion,
  type BuildDashboardInsightsInput, type DashboardInsightsLead, type DashboardInsightsMessage,
  type DashboardInsightsSale
} from "@/lib/dashboard-insights";

const start = new Date("2026-11-01T03:00:00.000Z");
const end = new Date("2026-11-08T02:59:59.999Z");
const observedAt = new Date("2026-11-04T15:00:00.000Z");
const webinar = { id: "webinar", pitchAtSec: 637, videoDurationSec: 1200 };
const input = (overrides: Partial<BuildDashboardInsightsInput> = {}): BuildDashboardInsightsInput => ({
  webinars: [webinar], leads: [], viewers: [], messages: [], sales: [], rangeStart: start, rangeEnd: end, ...overrides
});
const lead = (id: string, overrides: Partial<DashboardInsightsLead> = {}): DashboardInsightsLead => ({
  id, webinarId: webinar.id, watchedSec: 100, country: "BR", region: "São Paulo", ...overrides
});
const message = (id: string, leadId: string, sender: string, seconds: number, aiAgentName: string | null = null): DashboardInsightsMessage => ({
  id, leadId, sender, aiAgentName, webinarId: webinar.id, createdAt: new Date(observedAt.getTime() + seconds * 1000)
});
const sale = (id: string, createdAt: Date, amount = 1000, overrides: Partial<DashboardInsightsSale> = {}): DashboardInsightsSale => ({
  id, createdAt, amount, webinarId: webinar.id, currency: "BRL", ...overrides
});

describe("Brazil state normalization", () => {
  it("recognizes all 27 UF codes and names without requiring accents or case", () => {
    expect(BRAZIL_REGIONS).toHaveLength(27);
    for (const region of BRAZIL_REGIONS) {
      expect(normalizeBrazilRegion(` ${region.code.toLowerCase()} `)).toEqual(region);
      expect(normalizeBrazilRegion(region.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase())).toEqual(region);
      expect(normalizeBrazilRegion(`BR-${region.code}`)).toEqual(region);
    }
    expect(normalizeBrazilRegion("Estado de São Paulo")).toEqual({ code: "SP", name: "São Paulo" });
    expect(normalizeBrazilRegion("Santa  Catarina")?.code).toBe("SC");
    expect(normalizeBrazilRegion("Springfield")).toBeNull();
    expect(normalizeBrazilRegion(null)).toBeNull();
  });
});

describe("dashboard insights aggregation", () => {
  it("keeps absent averages unknown and does not invent retention for an empty cohort", () => {
    const result = buildDashboardInsights(input());
    expect(result.watch).toEqual({ averageWatchedSeconds: null, totalWatchedSeconds: 0, viewerCount: 0, retention: [], pitchAtSeconds: 637 });
    expect(result.support.human).toEqual({ conversations: 0, replies: 0, averageFirstReplySeconds: null });
    expect(result.comparison).toEqual({ previousRevenueCents: 0, previousSales: 0, revenueChangePct: null });
  });

  it("uses lifetime watched time only for observed viewers and position for retention, not time", () => {
    const result = buildDashboardInsights(input({
      leads: [lead("returning", { watchedSec: 5000 }), lead("short", { watchedSec: 200 }), lead("only-access", { watchedSec: 9000 })],
      viewers: [
        { webinarId: webinar.id, leadId: "returning", maxVideoSec: 700 },
        { webinarId: webinar.id, leadId: "returning", maxVideoSec: 650 },
        { webinarId: webinar.id, leadId: "short", maxVideoSec: 100 },
        { webinarId: webinar.id, leadId: null, maxVideoSec: 1200 }
      ]
    }));
    expect(result.watch).toMatchObject({ viewerCount: 2, totalWatchedSeconds: 5200, averageWatchedSeconds: 2600 });
    expect(result.watch.retention).toHaveLength(26);
    expect(result.watch.retention[0]).toEqual({ positionSeconds: 0, label: "0:00", viewers: 2, percentage: 100 });
    expect(result.watch.retention.find((point) => point.positionSeconds === 637)).toEqual({ positionSeconds: 637, label: "10:37", viewers: 1, percentage: 50 });
    expect(result.watch.retention.at(-1)).toMatchObject({ positionSeconds: 1200, viewers: 0, percentage: 0 });
  });

  it("uses observed positions when duration is unavailable and never treats another webinar as the same viewer", () => {
    const result = buildDashboardInsights(input({
      webinars: [{ ...webinar, pitchAtSec: null, videoDurationSec: null }],
      leads: [lead("valid", { watchedSec: -10 }), lead("foreign", { webinarId: "foreign" })],
      viewers: [
        { webinarId: webinar.id, leadId: "valid", maxVideoSec: 3600 },
        { webinarId: "foreign", leadId: "valid", maxVideoSec: 5000 },
        { webinarId: "foreign", leadId: "foreign", maxVideoSec: 5000 },
        { webinarId: webinar.id, leadId: "missing", maxVideoSec: 5000 }
      ]
    }));
    expect(result.watch).toMatchObject({ viewerCount: 1, totalWatchedSeconds: 0, averageWatchedSeconds: 0, pitchAtSeconds: null });
    expect(result.watch.retention.at(-1)).toEqual({ positionSeconds: 3600, label: "1:00:00", viewers: 1, percentage: 100 });
  });

  it("partitions latest location across UF, foreign, missing country and unresolved Brazilian state", () => {
    const sp = lead("sp");
    const result = buildDashboardInsights(input({ leads: [
      sp, sp, lead("sp-code", { country: " br ", region: "BR-SP" }),
      lead("rio", { region: "Rio de Janeiro" }),
      lead("foreign", { country: "US", region: "SP" }),
      lead("unknown", { country: null, region: "SP" }),
      lead("empty", { country: "  ", region: null }),
      lead("sentinel", { country: "ZZ", region: "SP" }),
      lead("unresolved", { region: "Unknown" }),
      lead("no-state", { region: null }),
      lead("other-owner", { webinarId: "foreign" })
    ] }));
    expect(result.geography).toEqual({
      regions: [{ code: "SP", name: "São Paulo", count: 2 }, { code: "RJ", name: "Rio de Janeiro", count: 1 }],
      outsideBrazil: 1, unlocated: 3, brazilUnresolved: 2, totalAccesses: 9
    });
    const { regions, outsideBrazil, unlocated, brazilUnresolved, totalAccesses } = result.geography;
    expect(regions.reduce((sum, region) => sum + region.count, 0) + outsideBrazil + unlocated + brazilUnresolved).toBe(totalAccesses);
  });

  it("attributes first reply only to the first responding channel while mixed chats count for both", () => {
    const messages = [
      message("a1", "mixed", "lead", 0), message("a2", "mixed", "lead", 4),
      message("a3", "mixed", "team", 10, "Assistente"), message("a4", "mixed", "team", 40),
      message("a5", "mixed", "lead", 50), message("a6", "mixed", "team", 90),
      message("b1", "human", "lead", 0), message("b2", "human", "team", 30),
      message("c1", "pending", "lead", 2), message("d1", "outgoing", "team", 3),
      message("e1", "system-only", "system", 1)
    ];
    const result = buildDashboardInsights(input({ messages: [...messages.slice().reverse(), messages[0], messages[2]] }));
    expect(result.support).toMatchObject({
      ai: { conversations: 1, replies: 1, averageFirstReplySeconds: 10 },
      human: { conversations: 3, replies: 4, averageFirstReplySeconds: 30 },
      uniqueConversations: 4
    });
  });

  it("does not measure reply times across the selected range and preserves deterministic timestamp ties", () => {
    const before = { ...message("before", "old", "lead", 0), createdAt: new Date(start.getTime() - 1) };
    const after = { ...message("after", "future", "team", 0), createdAt: new Date(end.getTime() + 1) };
    const result = buildDashboardInsights(input({ messages: [
      before, message("old-team", "old", "team", 20), message("future-lead", "future", "lead", 10), after,
      message("tie-b", "tied", "team", 30), message("tie-a", "tied", "lead", 30),
      { ...message("foreign", "foreign", "team", 0, "Bot"), webinarId: "foreign" }
    ] }));
    expect(result.support.human).toEqual({ conversations: 2, replies: 2, averageFirstReplySeconds: 0 });
    expect(result.support.ai.conversations).toBe(0);
    expect(result.support.uniqueConversations).toBe(3);
  });

  it("compares adjacent equal-duration windows in BRL, deduplicates records and excludes foreign data", () => {
    const previous = dashboardComparisonRange(start, end);
    expect(previous).toEqual({ start: new Date("2026-10-25T03:00:00.000Z"), end: new Date("2026-11-01T02:59:59.999Z") });
    const previousSale = sale("previous-start", previous.start);
    const result = buildDashboardInsights(input({ sales: [
      previousSale, previousSale, sale("previous-end", previous.end),
      sale("start", start, 1500), sale("end", end, 1500, { currency: " brl " }),
      sale("outside", new Date(previous.start.getTime() - 1), 99999),
      sale("after", new Date(end.getTime() + 1), 99999),
      sale("foreign", observedAt, 99999, { webinarId: "foreign" }),
      sale("unattributed", observedAt, 99999, { webinarId: null }),
      sale("usd", observedAt, 99999, { currency: "USD" })
    ] }));
    expect(result.comparison).toEqual({ previousRevenueCents: 2000, previousSales: 2, revenueChangePct: 50 });
    expect(buildDashboardInsights(input({ sales: [previousSale] })).comparison.revenueChangePct).toBe(-100);
    expect(buildDashboardInsights(input({ sales: [sale("current-only", observedAt)] })).comparison.revenueChangePct).toBeNull();
  });

  it("rejects invalid dates and never invents a common pitch for multiple webinars", () => {
    expect(() => buildDashboardInsights(input({ rangeStart: new Date("invalid") }))).toThrow(RangeError);
    expect(() => buildDashboardInsights(input({ rangeStart: end, rangeEnd: start }))).toThrow(RangeError);
    expect(buildDashboardInsights(input({ webinars: [webinar, { ...webinar, id: "second" }] })).watch.pitchAtSeconds).toBeNull();
  });
});
