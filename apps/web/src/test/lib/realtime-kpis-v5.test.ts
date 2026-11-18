import { describe, expect, it } from "vitest";
import { buildRealtimeKpis } from "@/lib/realtime-kpis-v5";
import { buildWebinarRealtimeSnapshot, type WebinarRealtimeSnapshot } from "@/lib/webinar-realtime-v5";

function snapshot(overrides: Partial<WebinarRealtimeSnapshot> = {}): WebinarRealtimeSnapshot {
  return { ...buildWebinarRealtimeSnapshot([], new Date("2026-11-17T15:00:00.000Z")), ...overrides };
}

function audience(
  points: Array<{ at: string; online: number }>,
  overrides: Partial<NonNullable<WebinarRealtimeSnapshot["audience"]>> = {}
): NonNullable<WebinarRealtimeSnapshot["audience"]> {
  return {
    average: 8.5,
    peak: 20,
    peakAt: "2026-11-17T14:30:00.000Z",
    sampleCount: points.length,
    history: { from: "2026-11-17T03:00:00.000Z", to: "2026-11-17T15:00:00.000Z", points },
    ...overrides
  };
}

function sales(overrides: Partial<NonNullable<WebinarRealtimeSnapshot["sales"]>> = {}): NonNullable<WebinarRealtimeSnapshot["sales"]> {
  return {
    currency: "BRL",
    timezone: "America/Sao_Paulo",
    today: { from: "2026-11-17T03:00:00.000Z", to: "2026-11-17T15:00:00.000Z", revenueCents: 12_345, count: 1, excludedCount: 0 },
    yesterday: { from: "2026-11-16T03:00:00.000Z", to: "2026-11-17T03:00:00.000Z", revenueCents: 99_900, count: 2, excludedCount: 0 },
    changePct: null,
    ...overrides
  };
}

describe("realtime v5 KPI values", () => {
  it("preserves unknown data instead of inventing zero and retains observed zero", () => {
    const missing = buildRealtimeKpis(snapshot());
    expect(missing.live).toEqual({ value: 0, points: [] });
    expect(missing.audience).toEqual({ value: null, points: [] });
    expect(missing.revenue).toEqual({ value: null, points: [] });
    const zero = buildRealtimeKpis(snapshot({
      audience: audience([{ at: "2026-11-17T14:30:00.000Z", online: 0 }], { average: 0 }),
      sales: sales({ today: { ...sales().today, revenueCents: 0 } })
    }));
    expect(zero.audience.value).toBe(0);
    expect(zero.live.points).toHaveLength(1);
    expect(zero.live.points[0].value).toBe(0);
    expect(zero.revenue.value).toBe(0);
  });

  it("uses server averages and today's BRL total, not averages or totals from the curves", () => {
    const result = buildRealtimeKpis(snapshot({ online: 12, audience: audience([{ at: "2026-11-17T14:30:00.000Z", online: 20 }]), sales: sales() }));
    expect(result.live.value).toBe(12);
    expect(result.audience.value).toBe(8.5);
    expect(result.revenue.value).toBe(123.45);
    expect(result.updatedAt).toBe("2026-11-17T15:00:00.000Z");
  });
});

describe("realtime v5 audience curves", () => {
  it("keeps the latest exact observation per 15-second slot and leaves missing slots null", () => {
    const result = buildRealtimeKpis(snapshot({ audience: audience([
      { at: "2026-11-17T14:59:46.100Z", online: 6 },
      { at: "2026-11-17T14:59:05.900Z", online: 5 },
      { at: "2026-11-17T14:59:01.000Z", online: 4 },
      { at: "2026-11-17T14:59:16.000Z", online: 0 }
    ]) }));
    expect(result.live.points).toEqual([
      { x: Date.parse("2026-11-17T14:59:05.900Z"), at: "2026-11-17T14:59:05.900Z", value: 5 },
      { x: Date.parse("2026-11-17T14:59:16.000Z"), at: "2026-11-17T14:59:16.000Z", value: 0 },
      { x: Date.parse("2026-11-17T14:59:30.000Z"), at: null, value: null },
      { x: Date.parse("2026-11-17T14:59:46.100Z"), at: "2026-11-17T14:59:46.100Z", value: 6 }
    ]);
  });

  it("separates the last hour from today's history and excludes prior-day and future readings", () => {
    const result = buildRealtimeKpis(snapshot({ audience: audience([], { history: {
      from: "2026-11-16T03:00:00.000Z", to: "2026-11-18T03:00:00.000Z",
      points: [
        { at: "2026-11-17T02:59:59.000Z", online: 1 },
        { at: "2026-11-17T03:00:00.000Z", online: 2 },
        { at: "2026-11-17T13:59:59.999Z", online: 3 },
        { at: "2026-11-17T14:00:00.000Z", online: 4 },
        { at: "2026-11-17T15:00:00.000Z", online: 5 },
        { at: "2026-11-17T15:00:00.001Z", online: 6 }
      ]
    } }) }));
    expect(result.live.points.filter(point => point.value !== null).map(point => point.value)).toEqual([4, 5]);
    expect(result.audience.points.filter(point => point.value !== null).map(point => point.value)).toEqual([2, 3, 4, 5]);
  });

  it("respects history's earlier cutoff without padding an isolated sample", () => {
    const point = { at: "2026-11-17T14:10:05.250Z", online: 7 };
    const result = buildRealtimeKpis(snapshot({ audience: audience([], { history: {
      from: "2026-11-17T14:00:00.000Z", to: "2026-11-17T14:15:00.000Z",
      points: [point, { at: "2026-11-17T14:16:00.000Z", online: 9 }]
    } }) }));
    expect(result.live.points).toEqual([{ x: Date.parse(point.at), at: point.at, value: 7 }]);
  });

  it("keeps the full last hour across midnight without mixing previous-day readings into Audience", () => {
    const cutoff = "2026-11-18T03:20:00.000Z";
    const midnight = "2026-11-18T03:00:00.000Z";
    const observed = [
      { at: "2026-11-18T02:19:59.999Z", online: 99 },
      { at: "2026-11-18T02:20:00.000Z", online: 12 },
      { at: midnight, online: 0 },
      { at: cutoff, online: 8 },
      { at: "2026-11-18T03:20:00.001Z", online: 100 },
    ];
    const result = buildRealtimeKpis(snapshot({ updatedAt: cutoff, online: 3, audience: audience([], {
      average: 4,
      history: { from: midnight, to: cutoff, points: observed.slice(2, 4) },
      liveHistory: { from: "2026-11-18T02:20:00.000Z", to: cutoff, points: observed },
    }) }));
    expect(result.live.value).toBe(3);
    expect(result.live.points.filter(point => point.value !== null).map(point => point.value)).toEqual([12, 0, 8]);
    expect(result.audience.value).toBe(4);
    expect(result.audience.points.filter(point => point.value !== null).map(point => point.value)).toEqual([0, 8]);
  });

  it("keeps compatible legacy history across midnight without fabricating missing readings", () => {
    const result = buildRealtimeKpis(snapshot({ updatedAt: "2026-11-18T03:10:00.000Z", audience: audience([], {
      history: { from: "2026-11-18T02:00:00.000Z", to: "2026-11-18T03:10:00.000Z", points: [
        { at: "2026-11-18T02:09:59.999Z", online: 20 },
        { at: "2026-11-18T02:10:00.000Z", online: 7 },
        { at: "2026-11-18T03:00:00.000Z", online: 0 },
      ] },
    }) }));
    expect(result.live.points.filter(point => point.value !== null).map(point => point.value)).toEqual([7, 0]);
    expect(result.audience.points.map(point => point.value)).toEqual([0]);
  });

  it("does not replace explicitly missing last-hour readings with the daily history", () => {
    const result = buildRealtimeKpis(snapshot({ audience: audience([{ at: "2026-11-17T14:30:00.000Z", online: 20 }], {
      liveHistory: { from: "2026-11-17T14:00:00.000Z", to: "2026-11-17T15:00:00.000Z", points: [] },
    }) }));
    expect(result.live.points).toEqual([]);
    expect(result.audience.points).toHaveLength(1);
  });

  it("keeps unavailable or invalid samples out of the curve", () => {
    const result = buildRealtimeKpis(snapshot({ audience: audience([
      { at: "invalid", online: 1 },
      { at: "2026-11-17T14:59:00.000Z", online: -1 },
      { at: "2026-11-17T14:59:15.000Z", online: Number.NaN },
      { at: "2026-11-17T14:59:30.000Z", online: 1.5 }
    ], { average: null }) }));
    expect(result.audience).toEqual({ value: null, points: [] });
    expect(buildRealtimeKpis(snapshot({ updatedAt: "invalid", audience: audience([]) })).live.points).toEqual([]);
  });
});

describe("realtime v5 revenue curve", () => {
  it("shows daily reais with real zeros, unknown gaps and no future or previous-month days", () => {
    const result = buildRealtimeKpis(snapshot({ updatedAt: "2026-11-04T15:00:00.000Z", sales: sales({ month: {
      from: "2026-11-01T03:00:00.000Z", to: "2026-11-06T15:00:00.000Z", excludedCount: 0,
      points: [
        { date: "2026-10-31", revenueCents: 100_000, count: 5 },
        { date: "2026-11-01", revenueCents: 12_345, count: 1 },
        { date: "2026-11-02", revenueCents: 0, count: 0 },
        { date: "2026-11-04", revenueCents: 2_000, count: 2 },
        { date: "2026-11-05", revenueCents: 100_000, count: 5 }
      ]
    } }) }));
    expect(result.revenue.points.map(point => [point.at, point.value, point.count])).toEqual([
      ["2026-11-01", 123.45, 1], ["2026-11-02", 0, 0], ["2026-11-03", null, undefined], ["2026-11-04", 20, 2]
    ]);
    expect(result.revenue.points[0].x).toBe(Date.parse("2026-11-01T12:00:00.000Z"));
  });

  it("uses the webinar calendar at a UTC month rollover", () => {
    const result = buildRealtimeKpis(snapshot({ updatedAt: "2026-12-01T02:00:00.000Z", sales: sales({ timezone: "America/Manaus", month: {
      from: "2026-11-01T04:00:00.000Z", to: "2026-12-01T02:00:00.000Z", excludedCount: 0,
      points: [{ date: "2026-11-30", revenueCents: 9_900, count: 1 }, { date: "2026-12-01", revenueCents: 8_800, count: 1 }]
    } }) }));
    expect(result.timezone).toBe("America/Manaus");
    expect(result.revenue.points).toHaveLength(30);
    expect(result.revenue.points.at(-1)).toMatchObject({ at: "2026-11-30", value: 99 });
  });

  it("leaves an invalid or stale month unavailable and falls back for an unknown timezone", () => {
    const result = buildRealtimeKpis(snapshot({ sales: sales({ timezone: "__auto__", month: {
      from: "2026-10-01T03:00:00.000Z", to: "2026-10-31T12:00:00.000Z", excludedCount: 0,
      points: [{ date: "2026-10-31", revenueCents: 9_900, count: 1 }]
    } }) }));
    expect(result.timezone).toBe("America/Sao_Paulo");
    expect(result.revenue).toEqual({ value: 123.45, points: [] });
  });
});
