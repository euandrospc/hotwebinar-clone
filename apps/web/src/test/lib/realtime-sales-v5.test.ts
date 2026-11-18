import { describe, expect, it } from "vitest";
import { buildRealtimeSalesComparison, buildRealtimeSalesMonth } from "@/lib/realtime-sales-v5";
import { zonedParts, zonedToUtc } from "@/lib/timezones";

const todayFrom = new Date("2026-11-15T03:00:00.000Z");
const yesterdayFrom = new Date("2026-11-14T03:00:00.000Z");
const now = new Date("2026-11-15T15:00:00.000Z");
const sale = (amount: number, at = now, currency = "BRL") => ({ amount, currency, createdAt: at });
const compare = (todaySales: ReturnType<typeof sale>[], yesterdaySales: ReturnType<typeof sale>[]) =>
  buildRealtimeSalesComparison({ todaySales, yesterdaySales, todayFrom, yesterdayFrom, now, timezone: "America/Sao_Paulo" });

describe("realtime recorded sales comparison", () => {
  it("sums BRL cents, counts each order and reports other currencies without conversion", () => {
    const result = compare([
      sale(14_900), sale(14_900, now, " brl "), sale(500, now, "USD")
    ], [sale(20_000, yesterdayFrom), sale(700, yesterdayFrom, "EUR")]);
    expect(result).toEqual({
      currency: "BRL", timezone: "America/Sao_Paulo", changePct: 49,
      today: { revenueCents: 29_800, count: 2, excludedCount: 1, from: todayFrom.toISOString(), to: now.toISOString() },
      yesterday: { revenueCents: 20_000, count: 1, excludedCount: 1, from: yesterdayFrom.toISOString(), to: todayFrom.toISOString() }
    });
  });

  it("compares today through its frozen cutoff with the complete previous calendar day", () => {
    const result = compare([
      sale(100, new Date(todayFrom.getTime() - 1)),
      sale(200, todayFrom),
      sale(300, now),
      sale(400, new Date(now.getTime() + 1))
    ], [
      sale(100, new Date(yesterdayFrom.getTime() - 1)),
      sale(200, yesterdayFrom),
      sale(800, new Date(todayFrom.getTime() - 1)),
      sale(400, todayFrom)
    ]);
    expect(result.today).toMatchObject({ revenueCents: 500, count: 2 });
    expect(result.yesterday).toMatchObject({ revenueCents: 1_000, count: 2 });
    expect(result.changePct).toBe(-50);
  });

  it.each([0, 14_900])("has no percentage base when yesterday has no BRL revenue and today is %i", amount => {
    const result = compare(amount ? [sale(amount)] : [], [sale(1_000, yesterdayFrom, "USD")]);
    expect(result.yesterday).toMatchObject({ revenueCents: 0, count: 0, excludedCount: 1 });
    expect(result.changePct).toBeNull();
  });

  it("preserves genuine zero-value orders and a decrease to zero", () => {
    const result = compare([sale(0)], [sale(14_900, yesterdayFrom)]);
    expect(result.today).toMatchObject({ revenueCents: 0, count: 1, excludedCount: 0 });
    expect(result.changePct).toBe(-100);
  });

  it("normalizes whitespace and case without converting foreign currency or accepting a similar code", () => {
    const result = compare([
      sale(100, now, "\t\n\u00a0brl\u2009\ufeff"), sale(200, now, "BRL"),
      sale(900, now, "BRLx"), sale(800, now, "USD"), sale(700, now, "")
    ], []);
    expect(result.today).toMatchObject({ revenueCents: 300, count: 2, excludedCount: 3 });
  });
});

function comparisonAt(value: string, timezone = "America/Sao_Paulo") {
  const instant = new Date(value);
  const day = zonedParts(instant, timezone);
  const todayFrom = zonedToUtc(day.y, day.mo, day.d, 0, 0, 0, timezone);
  const yesterdayFrom = zonedToUtc(day.y, day.mo, day.d - 1, 0, 0, 0, timezone);
  return buildRealtimeSalesComparison({
    todaySales: [sale(200, instant), sale(700, instant, "USD"), sale(999, new Date(instant.getTime() + 1))],
    yesterdaySales: [sale(300, yesterdayFrom), sale(800, yesterdayFrom, "EUR")],
    todayFrom, yesterdayFrom, now: instant, timezone
  });
}

describe("realtime sales calendar month", () => {
  it("densifies observed calendar days, preserves zero and uses the exact recent card totals", () => {
    const comparison = comparisonAt("2026-11-04T15:00:00.000Z");
    const month = buildRealtimeSalesMonth([
      { date: "2026-11-01", revenueCents: 1_000n, count: 2n, excludedCount: 1n },
      { date: "2026-11-02", revenueCents: 0n, count: 0n, excludedCount: 3n },
      ...["2026-10-31", "2026-11-03", "2026-11-04", "2026-11-05"].map(date => ({ date, revenueCents: 999, count: 999, excludedCount: 999 }))
    ], comparison);
    expect(month).toEqual({
      from: "2026-11-01T03:00:00.000Z", to: comparison.today.to, excludedCount: 6,
      points: [
        { date: "2026-11-01", revenueCents: 1_000, count: 2 },
        { date: "2026-11-02", revenueCents: 0, count: 0 },
        { date: "2026-11-03", revenueCents: 300, count: 1 },
        { date: "2026-11-04", revenueCents: 200, count: 1 }
      ]
    });
    expect(() => JSON.stringify(month)).not.toThrow();
  });

  it("uses zero for days without recorded sales and never appends future days", () => {
    const comparison = comparisonAt("2026-11-05T03:00:00.000Z");
    const month = buildRealtimeSalesMonth([], comparison);
    expect(month.points).toHaveLength(5);
    expect(month.points.slice(0, 3)).toEqual([1, 2, 3].map(day => ({ date: `2026-11-0${day}`, revenueCents: 0, count: 0 })));
    expect(month.points.at(-1)).toEqual({ date: "2026-11-05", revenueCents: 200, count: 1 });
    expect(month.to).toBe(comparison.today.from);
  });

  it("starts a new month in the webinar timezone and excludes yesterday from the prior month", () => {
    const comparison = comparisonAt("2026-12-31T15:00:00.000Z", "Asia/Tokyo");
    const month = buildRealtimeSalesMonth([{ date: "2026-12-31", revenueCents: 900, count: 9, excludedCount: 9 }], comparison);
    expect(month).toEqual({
      from: "2026-12-31T15:00:00.000Z", to: "2026-12-31T15:00:00.000Z", excludedCount: 1,
      points: [{ date: "2027-01-01", revenueCents: 200, count: 1 }]
    });
    expect(comparison.yesterday.count).toBe(1);
  });

  it.each([
    ["America/New_York", "2026-03-09T16:00:00.000Z", "2026-03-01T05:00:00.000Z", "2026-03-09", 9, 23],
    ["America/New_York", "2026-11-02T17:00:00.000Z", "2026-11-01T04:00:00.000Z", "2026-11-02", 2, 25],
    ["Australia/Sydney", "2026-10-05T02:00:00.000Z", "2026-09-30T14:00:00.000Z", "2026-10-05", 5, 23]
  ])("keeps calendar days across DST in %s at %s", (timezone, cutoff, from, lastDate, length, yesterdayHours) => {
    const comparison = comparisonAt(cutoff, timezone);
    const month = buildRealtimeSalesMonth([], comparison);
    expect(month.from).toBe(from);
    expect(month.to).toBe(cutoff);
    expect(month.points).toHaveLength(length);
    expect(month.points.at(-1)).toEqual({ date: lastDate, revenueCents: 200, count: 1 });
    expect(month.points.at(-2)).toMatchObject({ revenueCents: 300, count: 1 });
    expect((Date.parse(comparison.yesterday.to) - Date.parse(comparison.yesterday.from)) / 3_600_000).toBe(yesterdayHours);
  });

  it("refuses a database aggregate that cannot be represented accurately in the JSON contract", () => {
    expect(() => buildRealtimeSalesMonth([
      { date: "2026-11-01", revenueCents: BigInt(Number.MAX_SAFE_INTEGER) + 1n, count: 1n, excludedCount: 0n }
    ], comparisonAt("2026-11-04T15:00:00.000Z"))).toThrow(RangeError);
  });
});
