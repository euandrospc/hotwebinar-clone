import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const queries = vi.hoisted(() => ({ online: vi.fn(), webinar: vi.fn(), leads: vi.fn(), samples: vi.fn(), daily: vi.fn(), attendants: vi.fn() }));
vi.mock("db", () => ({ prisma: {
  webinar: { findUnique: queries.webinar }, lead: { findMany: queries.leads }, audienceSample: { findMany: queries.samples },
} }));
vi.mock("@/lib/online", () => ({ getOnlineSnapshot: queries.online }));
vi.mock("@/server/realtime-daily-metrics-v5", () => ({ getRealtimeDailyMetrics: queries.daily }));
vi.mock("@/server/attendance/realtime-attendants-v5", () => ({ getRealtimeAttendants: queries.attendants }));

import { prisma } from "db";
import { getWebinarRealtimeSnapshot, type RealtimeSnapshotDependencies } from "@/server/webinar-realtime-v5";

const now = new Date("2026-11-15T02:59:50.000Z");
const webinar = (timezone = "America/Sao_Paulo") => ({
  mode: "JIT", startDate: null, endDate: null, recurring: false, recurringDays: [], timezone,
  pitchAtSec: 120, offerShowAtSec: 150, offerHideAtSec: null, offerDisabled: false, videoSyncWithStart: false,
});
const sample = (at: string | Date, online: number) => ({ observedAt: new Date(at), online });
const viewer = { id: "viewer", name: null, userAgent: null, city: null, region: "SP", country: "BR", lat: null, lng: null };
const daily = () => ({
  sales: { currency: "BRL", timezone: "America/Sao_Paulo",
    today: { revenueCents: 3000, count: 3, excludedCount: 1, from: "2026-11-14T03:00:00.000Z", to: now.toISOString() },
    yesterday: { revenueCents: 2000, count: 2, excludedCount: 0, from: "2026-11-13T03:00:00.000Z", to: "2026-11-14T03:00:00.000Z" },
    changePct: 50,
    month: { from: "2026-11-01T03:00:00.000Z", to: now.toISOString(), excludedCount: 1, points: [{ date: "2026-11-14", revenueCents: 3000, count: 3 }] },
  },
  funnel: [20, 15, 8, 4, 1].map((count, index) => ({ label: `Stage ${index}`, count, pct: count * 5 })),
  reconciliation: { orders: 3, uniquePeriodBuyers: 1, repeatBuyerOrders: 1, ordersWithoutPeriodAccess: 1 },
});
const sampleQuery = (from: Date, to = now) => ({
  where: { webinarId: "selected-webinar", observedAt: { gte: from, lte: to } },
  orderBy: [{ observedAt: "asc" }, { sampledAt: "asc" }], select: { observedAt: true, online: true },
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(now);
  for (const query of Object.values(queries)) query.mockReset();
  queries.online.mockResolvedValue({ byWebinar: new Map(), leadIds: new Set() });
  queries.webinar.mockResolvedValue(webinar());
  queries.leads.mockResolvedValue([]);
  queries.samples.mockResolvedValue([]);
  queries.daily.mockResolvedValue(daily());
  queries.attendants.mockResolvedValue(undefined);
});
afterEach(() => vi.useRealTimers());

describe("realtime snapshot orchestration", () => {
  it.each([
    ["America/Sao_Paulo", "2026-11-14T03:00:00.000Z"],
    ["__auto__", "2026-11-14T03:00:00.000Z"],
    ["Asia/Tokyo", "2026-11-14T15:00:00.000Z"],
  ])("freezes the cutoff before I/O with the correct day in %s", async (timezone, from) => {
    queries.webinar.mockResolvedValue(webinar(timezone));
    queries.online.mockImplementation(async () => {
      vi.setSystemTime(new Date(now.getTime() + 60_000));
      return { byWebinar: new Map(), leadIds: new Set() };
    });
    const result = await getWebinarRealtimeSnapshot("selected-webinar");
    expect(queries.online).toHaveBeenCalledWith(now);
    expect(result.updatedAt).toBe(now.toISOString());
    expect(queries.samples).toHaveBeenCalledWith(sampleQuery(new Date(from)));
    expect(result.audience?.history).toEqual({ from, to: now.toISOString(), points: [] });
    expect(result.audience?.liveHistory).toEqual({ from: "2026-11-15T01:59:50.000Z", to: now.toISOString(), points: [] });
    expect(queries.daily).toHaveBeenCalledWith({ webinarId: "selected-webinar", now,
      timezone: timezone === "__auto__" ? "America/Sao_Paulo" : timezone, pitchAtSec: 120, db: prisma });
    expect(queries.attendants).toHaveBeenCalledWith({ webinarId: "selected-webinar", from: new Date(from), to: now });
  });

  it("uses shared daily metrics without changing order/buyer reconciliation", async () => {
    const result = await getWebinarRealtimeSnapshot("selected-webinar");
    expect(result.sales).toEqual({ ...daily().sales, reconciliation: daily().reconciliation });
    expect(result.funnel).toEqual(daily().funnel);
    expect(result.sales?.today.count).toBe(3);
    expect(result.funnel?.at(-1)?.count).toBe(1);
    expect(queries.daily).toHaveBeenCalledTimes(1);
  });

  it("scopes viewer details to the webinar and includes geography without coordinates", async () => {
    queries.online.mockResolvedValue({ byWebinar: new Map([["selected-webinar", 1], ["other-webinar", 1]]), leadIds: new Set(["viewer", "other-viewer"]) });
    queries.leads.mockResolvedValue([viewer]);
    const result = await getWebinarRealtimeSnapshot("selected-webinar");
    expect(queries.leads).toHaveBeenCalledWith(expect.objectContaining({ where: { webinarId: "selected-webinar", id: { in: ["viewer", "other-viewer"] } } }));
    expect(result).toMatchObject({ online: 1, devices: { unknown: 1 }, locations: [], geography: [{ country: "BR", region: "SP", count: 1 }] });
  });

  it("does not load viewer details when this webinar has no online viewers", async () => {
    expect((await getWebinarRealtimeSnapshot("selected-webinar")).online).toBe(0);
    expect(queries.leads).not.toHaveBeenCalled();
  });

  it("preserves genuine zero staff and distinguishes unavailable presence", async () => {
    const empty = { from: "2026-11-14T03:00:00.000Z", to: now.toISOString(), presenceSource: "local", online: [] };
    queries.attendants.mockResolvedValueOnce(empty).mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("Presence unavailable"));
    expect((await getWebinarRealtimeSnapshot("selected-webinar")).attendants).toEqual(empty);
    expect((await getWebinarRealtimeSnapshot("selected-webinar")).attendants).toBeUndefined();
    const failed = await getWebinarRealtimeSnapshot("selected-webinar");
    expect(failed.attendants).toBeUndefined();
    expect(failed.sales?.today.revenueCents).toBe(3000);
  });

  it("fails for missing configuration or core metric errors instead of fabricating zeros", async () => {
    queries.webinar.mockResolvedValueOnce(null);
    await expect(getWebinarRealtimeSnapshot("missing")).rejects.toThrow("Realtime webinar unavailable");
    expect(queries.daily).not.toHaveBeenCalled();
    queries.daily.mockRejectedValueOnce(new Error("Daily metrics unavailable"));
    await expect(getWebinarRealtimeSnapshot("selected-webinar")).rejects.toThrow("Daily metrics unavailable");
    queries.samples.mockRejectedValueOnce(new Error("History unavailable"));
    await expect(getWebinarRealtimeSnapshot("selected-webinar")).rejects.toThrow("History unavailable");
  });

  it("supports an injected operational source without reading the local default database", async () => {
    const db = {
      webinar: { findUnique: vi.fn().mockResolvedValue(webinar()) },
      lead: { findMany: vi.fn().mockResolvedValue([viewer]) },
      audienceSample: { findMany: vi.fn().mockResolvedValue([sample(now, 1)]) },
      event: {}, sale: {}, $queryRaw: vi.fn(),
    } as unknown as NonNullable<RealtimeSnapshotDependencies["db"]>;
    const readOnline = vi.fn().mockResolvedValue({ byWebinar: new Map([["selected-webinar", 1]]), leadIds: new Set(["viewer"]) });
    const readAttendants = vi.fn().mockResolvedValue(undefined);
    const result = await getWebinarRealtimeSnapshot("selected-webinar", { db, readOnline, readAttendants });
    for (const query of [queries.webinar, queries.leads, queries.samples, queries.online, queries.attendants]) expect(query).not.toHaveBeenCalled();
    expect(queries.daily).toHaveBeenCalledWith(expect.objectContaining({ db }));
    expect(result).toMatchObject({ online: 1, audience: { average: 1, sampleCount: 1 } });
  });
});

describe("realtime audience windows", () => {
  it("derives daily average and first peak from the exact same observations, retaining zeros and gaps", async () => {
    const first = "2026-11-14T23:00:07.000Z", second = "2026-11-14T23:00:22.000Z", afterGap = "2026-11-15T00:03:08.000Z";
    queries.samples.mockResolvedValue([sample(first, 0), sample(second, 12), sample(afterGap, 3), sample(now, 12)]);
    const result = await getWebinarRealtimeSnapshot("selected-webinar");
    expect(result.audience).toMatchObject({ average: 6.75, peak: 12, peakAt: second, sampleCount: 4,
      history: { points: [{ at: first, online: 0 }, { at: second, online: 12 }, { at: afterGap, online: 3 }, { at: now.toISOString(), online: 12 }] },
      liveHistory: { points: [{ at: now.toISOString(), online: 12 }] },
    });
  });

  it("keeps absent readings distinct from observed zero audience", async () => {
    expect((await getWebinarRealtimeSnapshot("selected-webinar")).audience).toMatchObject({ average: null, peak: null, peakAt: null, sampleCount: 0, history: { points: [] } });
    queries.samples.mockResolvedValue([sample(now, 0)]);
    expect((await getWebinarRealtimeSnapshot("selected-webinar")).audience).toMatchObject({ average: 0, peak: 0, sampleCount: 1 });
  });

  it("includes last-hour readings from yesterday without counting them or future readings in today's totals", async () => {
    const cutoff = new Date("2026-11-15T03:20:00.000Z"), from = new Date("2026-11-15T02:20:00.000Z"), midnight = "2026-11-15T03:00:00.000Z";
    vi.setSystemTime(cutoff);
    queries.samples.mockResolvedValue([
      sample("2026-11-15T02:19:59.999Z", 99), sample(from, 7), sample(midnight, 0), sample(cutoff, 4), sample("2026-11-15T03:20:00.001Z", 99),
    ]);
    const result = await getWebinarRealtimeSnapshot("selected-webinar");
    expect(queries.samples).toHaveBeenCalledWith(sampleQuery(from, cutoff));
    expect(result.audience).toMatchObject({ average: 2, sampleCount: 2, peak: 4 });
    expect(result.audience?.history?.points.map(point => point.online)).toEqual([0, 4]);
    expect(result.audience?.liveHistory?.points.map(point => point.online)).toEqual([7, 0, 4]);
  });

  it("reuses the recent query for a resolved recurring session across midnight", async () => {
    const cutoff = new Date("2026-11-15T03:30:00.000Z"), start = new Date("2026-11-15T02:30:00.000Z"), midnight = "2026-11-15T03:00:00.000Z";
    vi.setSystemTime(cutoff);
    queries.webinar.mockResolvedValue({ ...webinar(), mode: "UNICO", videoSyncWithStart: true, recurring: true, recurringDays: [0, 1, 2, 3, 4, 5, 6],
      startDate: new Date("2026-11-01T02:30:00.000Z"), endDate: new Date("2026-11-01T05:00:00.000Z") });
    queries.samples.mockResolvedValue([sample(start, 4), sample(midnight, 0), sample(cutoff, 7)]);
    const result = await getWebinarRealtimeSnapshot("selected-webinar");
    expect(queries.samples).toHaveBeenCalledTimes(1);
    expect(queries.samples).toHaveBeenCalledWith(sampleQuery(start, cutoff));
    expect(result.schedule?.startDate).toBe(start.toISOString());
    expect(result.audience).toMatchObject({ average: 3.5, sampleCount: 2 });
    expect(result.audience?.sessionHistory?.points.map(point => point.online)).toEqual([4, 0, 7]);
    expect(result.audience?.history?.points.map(point => point.online)).toEqual([0, 7]);
  });

  it("keeps a past session in a separate bounded window without loading intervening days", async () => {
    const start = new Date("2026-10-01T23:00:00.000Z"), end = new Date("2026-10-02T01:30:00.000Z");
    queries.webinar.mockResolvedValue({ ...webinar(), mode: "UNICO", videoSyncWithStart: true, startDate: start, endDate: end });
    queries.samples.mockResolvedValue([sample(start, 2), sample(end, 3), sample(now, 1)]);
    const result = await getWebinarRealtimeSnapshot("selected-webinar");
    expect(queries.samples).toHaveBeenCalledTimes(1);
    expect(queries.samples.mock.calls[0][0].where).toEqual({ webinarId: "selected-webinar", OR: [
      { observedAt: { gte: new Date("2026-11-14T03:00:00.000Z"), lte: now } }, { observedAt: { gte: start, lte: end } },
    ] });
    expect(result.audience).toMatchObject({ average: 1, sampleCount: 1 });
    expect(result.audience?.sessionHistory?.points.map(point => point.online)).toEqual([2, 3]);
    expect(result.audience?.history?.points.map(point => point.online)).toEqual([1]);
  });

  it.each([
    { mode: "JIT", videoSyncWithStart: true, startDate: new Date("2026-11-13T23:00:00.000Z"), endDate: new Date("2026-11-15T04:00:00.000Z") },
    { mode: "UNICO", videoSyncWithStart: false, startDate: new Date("2026-11-13T23:00:00.000Z"), endDate: new Date("2026-11-15T04:00:00.000Z") },
    { mode: "UNICO", videoSyncWithStart: true, startDate: new Date("2026-11-16T23:00:00.000Z"), endDate: new Date("2026-11-17T04:00:00.000Z") },
    { mode: "UNICO", videoSyncWithStart: true, startDate: new Date("2026-11-13T23:00:00.000Z"), endDate: new Date("2026-11-13T20:00:00.000Z") },
    { mode: "UNICO", videoSyncWithStart: true, startDate: null, endDate: new Date("2026-11-15T04:00:00.000Z") },
  ])("does not manufacture shared history for %j", async schedule => {
    queries.webinar.mockResolvedValue({ ...webinar(), ...schedule });
    const result = await getWebinarRealtimeSnapshot("selected-webinar");
    expect(result.audience?.sessionHistory).toBeUndefined();
    expect(queries.samples).toHaveBeenCalledWith(sampleQuery(new Date("2026-11-14T03:00:00.000Z")));
  });
});
