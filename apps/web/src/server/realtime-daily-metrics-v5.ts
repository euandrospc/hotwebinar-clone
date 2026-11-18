import { Prisma, prisma, type PrismaClient } from "db";
import type { FunnelStage } from "@/lib/dashboard-stats";
import { DASHBOARD_EVENT_KINDS } from "@/lib/dashboard-overview";
import { buildRealtimeSalesComparison, buildRealtimeSalesMonth, type RealtimeSalesDayAggregate } from "@/lib/realtime-sales-v5";
import { zonedParts, zonedToUtc } from "@/lib/timezones";
import { dashboardCourseSalesScope, dashboardCourseSalesScopeSql } from "./dashboard/sales-scope-v5";

export type RealtimeMetricsDatabase = Pick<PrismaClient, "event" | "sale" | "$queryRaw">;

export interface RealtimeSalesReconciliation {
  orders: number;
  uniquePeriodBuyers: number;
  repeatBuyerOrders: number;
  ordersWithoutPeriodAccess: number;
}

const stageLabels = ["Visitors", "Watched", "Reached pitch", "Clicked offer", "Purchased"];
// Match String.trim(), not only ASCII spaces, when aggregating recorded BRL sales.
const currencyWhitespace = "\u0009\u000a\u000b\u000c\u000d\u0020\u00a0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u2028\u2029\u202f\u205f\u3000\ufeff";

/** Caller authorizes the webinar. Reads only: events describe activity in this
 * day, while sales retain the dashboard's recorded gross-order semantics. */
export async function getRealtimeDailyMetrics({ webinarId, now, timezone, pitchAtSec, db = prisma }: {
  webinarId: string;
  now: Date;
  timezone: string;
  pitchAtSec: number | null;
  db?: RealtimeMetricsDatabase;
}) {
  if (!webinarId.trim() || !Number.isFinite(now.getTime())) throw new RangeError("Invalid realtime metric scope");
  const cutoff = new Date(now.getTime());
  const today = zonedParts(cutoff, timezone);
  const todayFrom = zonedToUtc(today.y, today.mo, today.d, 0, 0, 0, timezone);
  const yesterdayFrom = zonedToUtc(today.y, today.mo, today.d - 1, 0, 0, 0, timezone);
  const monthFrom = zonedToUtc(today.y, today.mo, 1, 0, 0, 0, timezone);
  const select = { id: true, leadId: true, amount: true, currency: true, createdAt: true } as const;

  const [events, todayRows, yesterdaySales, historicalDays] = await Promise.all([
    db.event.groupBy({
      by: ["leadId", "kind"],
      where: { webinarId, leadId: { not: null }, kind: { in: [...DASHBOARD_EVENT_KINDS] }, createdAt: { gte: todayFrom, lte: cutoff } },
      _max: { videoSec: true }
    }),
    db.sale.findMany({
      where: { webinarId, createdAt: { gte: todayFrom, lte: cutoff }, ...dashboardCourseSalesScope }, select
    }),
    db.sale.findMany({
      where: { webinarId, createdAt: { gte: yesterdayFrom, lt: todayFrom }, ...dashboardCourseSalesScope }, select
    }),
    // At most one row per older calendar day. Do not download the full month's
    // order history on every 15-second realtime refresh.
    monthFrom < yesterdayFrom ? db.$queryRaw<RealtimeSalesDayAggregate[]>(Prisma.sql`
      WITH scoped_sales AS (
        SELECT
          to_char(("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${timezone}, 'YYYY-MM-DD') AS "date",
          "amount", UPPER(BTRIM("currency", ${currencyWhitespace})) = 'BRL' AS "isBrl"
        FROM "sale"
        WHERE "webinarId" = ${webinarId}
          AND "createdAt" >= (${monthFrom}::timestamptz AT TIME ZONE 'UTC')
          AND "createdAt" < (${yesterdayFrom}::timestamptz AT TIME ZONE 'UTC')
          AND ${dashboardCourseSalesScopeSql()}
      )
      SELECT "date",
        COALESCE(SUM("amount") FILTER (WHERE "isBrl"), 0) AS "revenueCents",
        COUNT(*) FILTER (WHERE "isBrl") AS "count",
        COUNT(*) FILTER (WHERE NOT "isBrl") AS "excludedCount"
      FROM scoped_sales GROUP BY "date" ORDER BY "date" ASC
    `) : Promise.resolve([])
  ]);

  // One frozen range for the revenue total and the funnel buyer population.
  const todaySales = todayRows.filter(sale => sale.createdAt >= todayFrom && sale.createdAt <= cutoff);
  const comparison = buildRealtimeSalesComparison({ todaySales, yesterdaySales, todayFrom, yesterdayFrom, now: cutoff, timezone });
  const accesses = new Set<string>();
  const watched = new Set<string>();
  const pitch = new Set<string>();
  const clicked = new Set<string>();
  const buyers = new Set<string>();
  const hasPitch = pitchAtSec !== null && Number.isFinite(pitchAtSec) && pitchAtSec >= 0;
  for (const event of events) {
    if (!event.leadId) continue;
    accesses.add(event.leadId);
    if (event.kind === "VIDEO_TICK") watched.add(event.leadId);
    if (event.kind === "OFFER_CLICK") clicked.add(event.leadId);
    if (event.kind === "PITCH_REACHED" || event.kind === "VIDEO_TICK" && hasPitch
      && event._max.videoSec !== null && event._max.videoSec >= pitchAtSec!) pitch.add(event.leadId);
  }

  const reconciliation: RealtimeSalesReconciliation = {
    orders: comparison.today.count, uniquePeriodBuyers: 0, repeatBuyerOrders: 0, ordersWithoutPeriodAccess: 0
  };
  for (const sale of todaySales) {
    if (sale.currency.trim().toUpperCase() !== "BRL") continue;
    if (!sale.leadId || !accesses.has(sale.leadId)) reconciliation.ordersWithoutPeriodAccess++;
    else {
      if (buyers.has(sale.leadId)) reconciliation.repeatBuyerOrders++;
      buyers.add(sale.leadId);
    }
  }
  reconciliation.uniquePeriodBuyers = buyers.size;
  const counts = [accesses.size, watched.size, pitch.size, clicked.size, buyers.size];
  const funnel: FunnelStage[] = counts.map((count, index) => ({
    label: stageLabels[index], count,
    pct: accesses.size > 0 ? Math.round(count / accesses.size * 10_000) / 100 : 0
  }));
  return {
    sales: { ...comparison, month: buildRealtimeSalesMonth(historicalDays, comparison) },
    funnel,
    reconciliation
  };
}
