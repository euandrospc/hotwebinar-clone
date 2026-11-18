import { describe, expect, it } from "vitest";
import { buildRealtimeKpis } from "@/lib/realtime-kpis-v5";
import { buildRealtimeMapV5 } from "@/lib/realtime-map-v5";
import { buildRealtimeKpisV5DemoSnapshot, isRealtimeKpiDemoRequest } from "@/lib/realtime-kpis-v5-demo";

describe("realtime v5 local preview guard", () => {
  it.each(["localhost", "localhost:3000", "LOCALHOST:3000", "127.0.0.1", "127.0.0.1:3211", "[::1]", "[::1]:3000"])("allows development on the exact loopback host %s", host => {
    expect(isRealtimeKpiDemoRequest({ nodeEnv: "development", host, demo: "1" })).toBe(true);
  });

  it.each(["production", "test", undefined])("denies preview in %s even on localhost", nodeEnv => {
    expect(isRealtimeKpiDemoRequest({ nodeEnv, host: "localhost:3000", demo: "1" })).toBe(false);
  });

  it.each([
    null, "", "lives.bravy.com", "192.168.1.10:3000", "localhost.example.com",
    "example.com:localhost", "localhost@external.test", "localhost:3000, external.test",
    "https://localhost:3000", "localhost:3000/path", " localhost:3000", "localhost:3000 ",
    "127.0.0.2", "127.0.0.1.external.test", "[::1].external.test"
  ])("denies external or spoofed host %s", host => {
    expect(isRealtimeKpiDemoRequest({ nodeEnv: "development", host, demo: "1" })).toBe(false);
  });

  it("uses real data by default and requires one explicit demo=1 parameter", () => {
    const request = { nodeEnv: "development", host: "localhost:3000" };
    expect(isRealtimeKpiDemoRequest(request)).toBe(false);
    expect(isRealtimeKpiDemoRequest({ ...request, demo: "" })).toBe(false);
    expect(isRealtimeKpiDemoRequest({ ...request, demo: "true" })).toBe(false);
    expect(isRealtimeKpiDemoRequest({ ...request, demo: "0" })).toBe(false);
    expect(isRealtimeKpiDemoRequest({ ...request, demo: ["1", "0"] })).toBe(false);
    expect(isRealtimeKpiDemoRequest({ ...request, demo: ["1", "1"] })).toBe(false);
    expect(isRealtimeKpiDemoRequest({ ...request, demo: [] })).toBe(false);
    expect(isRealtimeKpiDemoRequest({ ...request, demo: "1" })).toBe(true);
  });
});

describe("realtime v5 demo snapshot", () => {
  it("is deterministic and returns independent objects", () => {
    const first = buildRealtimeKpisV5DemoSnapshot();
    const second = buildRealtimeKpisV5DemoSnapshot();
    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    first.audience!.history!.points[0].online = 999;
    first.sales!.month!.points[0].revenueCents = 999;
    expect(buildRealtimeKpisV5DemoSnapshot()).toEqual(second);
  });

  it("has one hour of observed 15-second samples with consistent current, average and peak values", () => {
    const snapshot = buildRealtimeKpisV5DemoSnapshot();
    const audience = snapshot.audience!;
    const points = audience.history!.points;
    expect(snapshot.updatedAt).toBe("2026-11-17T18:00:00.000Z");
    expect(snapshot.online).toBe(178);
    expect(points).toHaveLength(241);
    expect(audience.sampleCount).toBe(points.length);
    expect(points.at(-1)).toEqual({ at: snapshot.updatedAt, online: snapshot.online });
    expect(Date.parse(points.at(-1)!.at) - Date.parse(points[0].at)).toBe(60 * 60 * 1_000);
    for (let index = 1; index < points.length; index += 1) {
      expect(Date.parse(points[index].at) - Date.parse(points[index - 1].at)).toBe(15_000);
    }
    expect(audience.average).toBe(points.reduce((sum, point) => sum + point.online, 0) / points.length);
    expect(audience.average).toBeGreaterThan(145);
    expect(audience.average).toBeLessThan(160);
    expect(audience.peak).toBe(201);
    expect(points.find(point => point.at === audience.peakAt)?.online).toBe(audience.peak);
    // This visual fixture has no observed previous day; never invent the comparison.
    expect(audience.yesterday).toBeUndefined();
  });

  it("keeps today's and yesterday's revenue aligned with the monthly series and webinar calendar", () => {
    const snapshot = buildRealtimeKpisV5DemoSnapshot();
    const sales = snapshot.sales!;
    expect(sales.timezone).toBe("America/Sao_Paulo");
    expect(sales.today).toMatchObject({ from: "2026-11-17T03:00:00.000Z", to: snapshot.updatedAt, revenueCents: 8_070_994, count: 61 });
    expect(sales.yesterday).toMatchObject({ from: "2026-11-16T03:00:00.000Z", to: sales.today.from });
    expect(sales.month!.points).toHaveLength(17);
    expect(sales.month!.points.at(-1)).toEqual({ date: "2026-11-17", revenueCents: sales.today.revenueCents, count: sales.today.count });
    expect(sales.month!.points.at(-2)).toEqual({ date: "2026-11-16", revenueCents: sales.yesterday.revenueCents, count: sales.yesterday.count });
    const kpis = buildRealtimeKpis(snapshot);
    expect(kpis.live.points).toHaveLength(241);
    expect(kpis.live.points.every(point => point.value !== null)).toBe(true);
    expect(kpis.revenue.value).toBe(80_709.94);
    expect(kpis.revenue.points).toHaveLength(17);
    expect(snapshot.funnel?.map(stage => stage.count)).toEqual([2610, 2231, 1066, 117, 61]);
    expect(snapshot.funnel?.at(-1)?.count).toBe(sales.today.count);
    for (const stage of snapshot.funnel ?? []) {
      expect(stage.pct).toBe(Math.round(stage.count / 2610 * 10_000) / 100);
    }
    expect(snapshot.schedule).toMatchObject({
      mode: "UNICO",
      startDate: "2026-11-17T17:30:00.000Z",
      endDate: "2026-11-17T19:00:00.000Z",
      pitchAtSec: 2700,
      offerShowAtSec: 3000,
      offerHideAtSec: 4800,
      offerDisabled: false,
      videoSyncWithStart: true,
    });
    expect(snapshot.locations).toHaveLength(168);
  });

  it("keeps individual mock viewers consistent across the live KPI and Brazil map", () => {
    const snapshot = buildRealtimeKpisV5DemoSnapshot();
    const map = buildRealtimeMapV5(snapshot);
    expect(snapshot.locations.every(location => location.count === 1)).toBe(true);
    expect(new Set(snapshot.locations.map(location => location.id)).size).toBe(168);
    expect(snapshot.located).toBe(168);
    expect(snapshot.unlocated).toBe(10);
    expect(snapshot.located + snapshot.unlocated).toBe(snapshot.online);
    expect(map).toMatchObject({ available: true, totalOnline: 178, brazilMapped: 160, outsideBrazil: 8, unmapped: 10 });
    expect(map.states.filter(state => state.value! > 0)).toHaveLength(12);
    expect(map.states.reduce((sum, state) => sum + state.value!, 0)).toBe(160);
    expect(map.states.find(state => state.uf === "SP")?.value).toBe(46);
    expect(snapshot.topCountries.reduce((sum, country) => sum + country.count, 0)).toBe(snapshot.located);
  });
});
