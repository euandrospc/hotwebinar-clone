import type { WebinarRealtimeSnapshot } from "./webinar-realtime-v5";
import { zonedParts, zonedToUtc } from "./timezones";

type SalesComparison = NonNullable<WebinarRealtimeSnapshot["sales"]>;

export interface RealtimeSalesDayAggregate {
  date: string;
  revenueCents: number | bigint;
  count: number | bigint;
  excludedCount: number | bigint;
}

function calendarDate(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function numericTotal(value: number | bigint) {
  const number = Number(value);
  if (!Number.isSafeInteger(number)) throw new RangeError("Sales total exceeds safe integer precision");
  return number;
}

/** Dense local calendar days through today. Historical rows stop before yesterday;
 * the last two days reuse the card totals so parallel reads cannot disagree. */
export function buildRealtimeSalesMonth(
  historicalDays: RealtimeSalesDayAggregate[],
  comparison: SalesComparison
): NonNullable<SalesComparison["month"]> {
  const now = new Date(comparison.today.to);
  const today = zonedParts(now, comparison.timezone);
  const monthFrom = zonedToUtc(today.y, today.mo, 1, 0, 0, 0, comparison.timezone);
  const firstDate = calendarDate(today.y, today.mo, 1);
  const todayDate = calendarDate(today.y, today.mo, today.d);
  const yesterday = zonedParts(new Date(comparison.yesterday.from), comparison.timezone);
  const yesterdayDate = calendarDate(yesterday.y, yesterday.mo, yesterday.d);
  const byDate = new Map(historicalDays
    .filter(row => row.date >= firstDate && row.date < yesterdayDate)
    .map(row => [row.date, row]));
  byDate.set(todayDate, { date: todayDate, ...comparison.today });
  if (yesterdayDate >= firstDate) byDate.set(yesterdayDate, { date: yesterdayDate, ...comparison.yesterday });
  let excludedCount = 0;
  const points = Array.from({ length: today.d }, (_, index) => {
    const date = calendarDate(today.y, today.mo, index + 1);
    const aggregate = byDate.get(date);
    if (!aggregate) return { date, revenueCents: 0, count: 0 };
    excludedCount += numericTotal(aggregate.excludedCount);
    return { date, revenueCents: numericTotal(aggregate.revenueCents), count: numericTotal(aggregate.count) };
  });
  return { from: monthFrom.toISOString(), to: now.toISOString(), excludedCount, points };
}

interface RecordedSale {
  amount: number;
  currency: string;
  createdAt: Date;
}

/** Values recorded by the integrations, not net revenue or payment-time attribution. */
export function buildRealtimeSalesComparison({ todaySales, yesterdaySales, todayFrom, yesterdayFrom, now, timezone }: {
  todaySales: RecordedSale[];
  yesterdaySales: RecordedSale[];
  todayFrom: Date;
  yesterdayFrom: Date;
  now: Date;
  timezone: string;
}): NonNullable<WebinarRealtimeSnapshot["sales"]> {
  function summarize(sales: RecordedSale[], from: Date, to: Date, inclusiveEnd: boolean) {
    let revenueCents = 0;
    let count = 0;
    let excludedCount = 0;
    const start = from.getTime();
    const end = to.getTime();
    for (const sale of sales) {
      const at = sale.createdAt.getTime();
      if (at < start || (inclusiveEnd ? at > end : at >= end)) continue;
      if (sale.currency.trim().toUpperCase() !== "BRL") {
        excludedCount += 1;
        continue;
      }
      revenueCents += sale.amount;
      count += 1;
    }
    return { revenueCents, count, excludedCount, from: from.toISOString(), to: to.toISOString() };
  }

  const today = summarize(todaySales, todayFrom, now, true);
  const yesterday = summarize(yesterdaySales, yesterdayFrom, todayFrom, false);
  return {
    currency: "BRL",
    timezone,
    today,
    yesterday,
    changePct: yesterday.revenueCents === 0 ? null
      : Math.round((today.revenueCents - yesterday.revenueCents) / yesterday.revenueCents * 10_000) / 100
  };
}
