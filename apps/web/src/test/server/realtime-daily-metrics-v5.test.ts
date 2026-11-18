import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "db";
import { dashboardCourseSalesScope } from "@/server/dashboard/sales-scope-v5";
import { getRealtimeDailyMetrics, type RealtimeMetricsDatabase } from "@/server/realtime-daily-metrics-v5";

const events = vi.fn();
const sales = vi.fn();
const monthly = vi.fn();
const db = { event: { groupBy: events }, sale: { findMany: sales }, $queryRaw: monthly } as unknown as RealtimeMetricsDatabase;
const now = new Date("2026-11-17T20:15:00.000Z");
const from = new Date("2026-11-17T03:00:00.000Z");
const yesterday = new Date("2026-11-16T03:00:00.000Z");
const run = (overrides: Partial<Parameters<typeof getRealtimeDailyMetrics>[0]> = {}) => getRealtimeDailyMetrics({
  webinarId: "webinar-a", now, timezone: "America/Sao_Paulo", pitchAtSec: 120, db, ...overrides
});
const event = (leadId: string, kind: string, videoSec: number | null = null) => ({ leadId, kind, _max: { videoSec } });
const sale = (id: string, leadId: string | null, amount = 1_000, currency = "BRL", createdAt = now) => ({ id, leadId, amount, currency, createdAt });

beforeEach(() => {
  events.mockReset().mockResolvedValue([]);
  sales.mockReset().mockResolvedValue([]);
  monthly.mockReset().mockResolvedValue([]);
});

describe("realtime daily metrics", () => {
  it("uses observed activity rather than mutable registration dates or lifetime flags", async () => {
    events.mockResolvedValue([
      event("cookie-return", "VIDEO_TICK", 180),
      event("cookie-return", "OFFER_CLICK"),
      event("new-optin", "OPTIN"),
      event("return-with-old-flags", "VIDEO_TICK", 20),
      event("explicit-pitch", "PITCH_REACHED")
    ]);
    const result = await run();
    expect(result.funnel.map(stage => stage.count)).toEqual([4, 2, 2, 1, 0]);
    expect(result.funnel.map(stage => stage.pct)).toEqual([100, 50, 50, 25, 0]);
    expect(events).toHaveBeenCalledWith({
      by: ["leadId", "kind"],
      where: { webinarId: "webinar-a", leadId: { not: null }, kind: { in: ["OPTIN", "VIDEO_TICK", "PITCH_REACHED", "OFFER_CLICK"] }, createdAt: { gte: from, lte: now } },
      _max: { videoSec: true }
    });
  });

  it("reconciles BRL orders with unique buyers who accessed this webinar today", async () => {
    events.mockResolvedValue([event("a", "OPTIN"), event("a", "VIDEO_TICK", 40), event("b", "VIDEO_TICK", 140)]);
    sales.mockResolvedValueOnce([
      sale("a-first", "a"), sale("a-repeat", "a", 2_000), sale("b-first", "b", 3_000, " brl\u00a0"),
      sale("outside-cohort", "old-lead", 4_000), sale("unattributed", null, 5_000), sale("foreign", "a", 900, "USD")
    ]).mockResolvedValueOnce([sale("yesterday", "a", 8_000, "BRL", yesterday)]);
    const result = await run();
    expect(result.sales.today).toMatchObject({ revenueCents: 15_000, count: 5, excludedCount: 1, to: now.toISOString() });
    expect(result.sales.yesterday).toMatchObject({ revenueCents: 8_000, count: 1 });
    expect(result.funnel.at(-1)).toMatchObject({ label: "Purchased", count: 2, pct: 100 });
    expect(result.reconciliation).toEqual({ orders: 5, uniquePeriodBuyers: 2, repeatBuyerOrders: 1, ordersWithoutPeriodAccess: 2 });
    expect(result.reconciliation.orders).toBe(result.reconciliation.uniquePeriodBuyers + result.reconciliation.repeatBuyerOrders + result.reconciliation.ordersWithoutPeriodAccess);
  });

  it("applies the validated course allowlist to both days and the bounded month aggregate", async () => {
    await run();
    expect(sales.mock.calls[0][0].where).toEqual({ webinarId: "webinar-a", createdAt: { gte: from, lte: now }, ...dashboardCourseSalesScope });
    expect(sales.mock.calls[1][0].where).toEqual({ webinarId: "webinar-a", createdAt: { gte: yesterday, lt: from }, ...dashboardCourseSalesScope });
    expect(dashboardCourseSalesScope.OR).toEqual([
      { payload: { path: ["products", "0", "id"], equals: "922bb805-1360-4795-ad91-087797e2f38c" } },
      { payload: { path: ["products", "0", "id"], equals: "ce8747d4-de4b-424b-9260-25ed59968f98" } },
      { AND: [
        { OR: [{ payload: { path: ["products", "0", "id"], equals: Prisma.AnyNull } }, { payload: { path: ["products", "0", "id"], equals: "" } }] },
        { OR: ["Claude Code do Zero ao Avançado: Agentes e Skills na Prática", "Claude Code do Zero ao Avançado -", "Dominando Claude Code"]
          .map(name => ({ productName: { equals: name, mode: "insensitive" } })) }
      ] }
    ]);
    const query = monthly.mock.calls[0][0] as Prisma.Sql;
    expect(query.values).toEqual(expect.arrayContaining([
      "webinar-a", "America/Sao_Paulo", new Date("2026-11-01T03:00:00.000Z"), yesterday,
      "922bb805-1360-4795-ad91-087797e2f38c", "ce8747d4-de4b-424b-9260-25ed59968f98",
      "claude code do zero ao avançado: agentes e skills na prática", "claude code do zero ao avançado -"
    ]));
    expect(query.sql).toContain('NULLIF("payload" #>> \'{products,0,id}\', \'\') IS NULL');
    expect(query.sql).toContain('LOWER("productName") IN');
    expect(query.sql).toContain('COUNT(*) FILTER (WHERE NOT "isBrl")');
  });

  it("keeps the monthly series on the same today/yesterday totals with zeros and no future days", async () => {
    monthly.mockResolvedValue([{ date: "2026-11-03", revenueCents: 1_500n, count: 2n, excludedCount: 1n }]);
    sales.mockResolvedValueOnce([sale("today", null, 700)]).mockResolvedValueOnce([sale("yesterday", null, 900, "BRL", yesterday)]);
    const result = await run();
    expect(result.sales.month.points).toHaveLength(17);
    expect(result.sales.month.points[0]).toEqual({ date: "2026-11-01", revenueCents: 0, count: 0 });
    expect(result.sales.month.points[2]).toEqual({ date: "2026-11-03", revenueCents: 1_500, count: 2 });
    expect(result.sales.month.points.slice(-2)).toEqual([
      { date: "2026-11-16", revenueCents: 900, count: 1 }, { date: "2026-11-17", revenueCents: 700, count: 1 }
    ]);
    expect(result.sales.month.excludedCount).toBe(1);
  });

  it("shares a frozen inclusive cutoff for revenue and purchases without counting future or previous-day orders", async () => {
    const mutableNow = new Date(now);
    events.mockImplementation(async () => { mutableNow.setUTCDate(18); return [event("a", "VIDEO_TICK", 0)]; });
    sales.mockResolvedValueOnce([
      sale("before", "a", 100, "BRL", new Date(from.getTime() - 1)),
      sale("at-start", "a", 200, "BRL", from), sale("at-cutoff", "a", 300),
      sale("future", "a", 400, "BRL", new Date(now.getTime() + 1))
    ]);
    const result = await run({ now: mutableNow });
    expect(result.sales.today).toMatchObject({ revenueCents: 500, count: 2, to: now.toISOString() });
    expect(result.reconciliation).toMatchObject({ orders: 2, uniquePeriodBuyers: 1, repeatBuyerOrders: 1 });
  });

  it("handles the first instant of a month without querying older days or carrying yesterday into this month", async () => {
    const midnight = new Date("2026-11-01T03:00:00.000Z");
    sales.mockResolvedValueOnce([sale("at-midnight", null, 0, "BRL", midnight)])
      .mockResolvedValueOnce([sale("old-month", null, 5_000, "BRL", new Date("2026-10-31T15:00:00.000Z"))]);
    const result = await run({ now: midnight });
    expect(monthly).not.toHaveBeenCalled();
    expect(result.sales.month.points).toEqual([{ date: "2026-11-01", revenueCents: 0, count: 1 }]);
    expect(result.sales.yesterday.revenueCents).toBe(5_000);
    expect(result.funnel.map(stage => stage.count)).toEqual([0, 0, 0, 0, 0]);
    expect(result.reconciliation.ordersWithoutPeriodAccess).toBe(1);
  });

  it("does not infer pitch without a valid threshold, while retaining explicit pitch events", async () => {
    events.mockResolvedValue([event("a", "VIDEO_TICK", 10_000), event("b", "PITCH_REACHED")]);
    expect((await run({ pitchAtSec: null })).funnel.map(stage => stage.count)).toEqual([2, 1, 1, 0, 0]);
  });

  it("rejects invalid scope before any database reads", async () => {
    await expect(run({ webinarId: " " })).rejects.toThrow("Invalid realtime metric scope");
    await expect(run({ now: new Date("invalid") })).rejects.toThrow("Invalid realtime metric scope");
    expect(events).not.toHaveBeenCalled();
    expect(sales).not.toHaveBeenCalled();
  });
});
