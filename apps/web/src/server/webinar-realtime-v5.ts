import { zonedParts, zonedToUtc } from "@/lib/timezones";
import { withOccurrence } from "@/lib/sync";
import { prisma, type PrismaClient } from "db";
import { getOnlineSnapshot, type OnlineSnapshot } from "@/lib/online";
import { buildWebinarRealtimeSnapshot, type WebinarRealtimeSnapshot } from "@/lib/webinar-realtime-v5";
import { getRealtimeDailyMetrics } from "./realtime-daily-metrics-v5";
import { getRealtimeAttendants } from "./attendance/realtime-attendants-v5";

export interface RealtimeSnapshotDependencies {
  db?: Pick<PrismaClient, "lead" | "webinar" | "audienceSample" | "event" | "sale" | "$queryRaw">;
  readOnline?: (now: Date) => Promise<OnlineSnapshot>;
  readAttendants?: typeof getRealtimeAttendants;
}

// Callers must verify ownership before requesting a webinar snapshot. Optional
// dependencies allow an explicitly configured read-only operational source.
export async function getWebinarRealtimeSnapshot(
  webinarId: string,
  { db = prisma, readOnline = getOnlineSnapshot, readAttendants = getRealtimeAttendants }: RealtimeSnapshotDependencies = {},
): Promise<WebinarRealtimeSnapshot> {
  // Freeze the cutoff before any I/O, including presence and configuration.
  const now = new Date();
  const [online, webinar] = await Promise.all([
    readOnline(now),
    db.webinar.findUnique({
      where: { id: webinarId },
      select: { title: true, name: true, mode: true, startDate: true, endDate: true, recurring: true,
        recurringDays: true, timezone: true, pitchAtSec: true,
        offerShowAtSec: true, offerHideAtSec: true, offerDisabled: true, videoSyncWithStart: true },
    }),
  ]);
  if (!webinar) throw new Error("Realtime webinar unavailable");
  const occurrence = withOccurrence(webinar, now);
  const timezone = !webinar.timezone || webinar.timezone === "__auto__" ? "America/Sao_Paulo" : webinar.timezone;
  const today = zonedParts(now, timezone);
  const dayStart = zonedToUtc(today.y, today.mo, today.d, 0, 0, 0, timezone);
  // Resolve wall-clock midnights independently: yesterday can have 23 or 25
  // hours at a DST transition, and is not always "dayStart minus 24 hours".
  const yesterdayStart = zonedToUtc(today.y, today.mo, today.d - 1, 0, 0, 0, timezone);
  const audienceRange = { gte: dayStart, lte: now };
  const liveRange = { gte: new Date(now.getTime() - 60 * 60 * 1_000), lte: now };
  const recentRange = { gte: new Date(Math.min(dayStart.getTime(), liveRange.gte.getTime())), lte: now };
  const { startDate: sessionStart, endDate: sessionEnd } = occurrence;
  const sessionRange = occurrence.mode === "UNICO" && occurrence.videoSyncWithStart
    && sessionStart && sessionEnd
    && Number.isFinite(sessionStart.getTime()) && Number.isFinite(sessionEnd.getTime())
    && sessionEnd > sessionStart && sessionStart <= now
    ? { gte: sessionStart, lte: new Date(Math.min(sessionEnd.getTime(), now.getTime())) }
    : null;
  // Day and last-hour windows overlap. A past session may be disjoint: keep its
  // separate bounded range rather than loading all intervening calendar days.
  const sampleWhere = sessionRange && sessionRange.gte < recentRange.gte
    ? { webinarId, OR: [{ observedAt: recentRange }, { observedAt: sessionRange }] }
    : { webinarId, observedAt: recentRange };

  const [leads, daily, samples, yesterdayPeak, attendants] = await Promise.all([
    online.byWebinar.has(webinarId) ? db.lead.findMany({
      where: { webinarId, id: { in: [...online.leadIds] } },
      select: { id: true, name: true, userAgent: true, city: true, region: true, country: true, lat: true, lng: true },
    }) : Promise.resolve([]),
    getRealtimeDailyMetrics({ webinarId, now, timezone, pitchAtSec: webinar.pitchAtSec, db }),
    db.audienceSample.findMany({
      where: sampleWhere,
      orderBy: [{ observedAt: "asc" }, { sampledAt: "asc" }],
      select: { observedAt: true, online: true },
    }),
    // Read one peak instead of loading yesterday's whole curve. Use observedAt,
    // as in today's KPI, and retain the first observed time when peaks tie.
    db.audienceSample.findFirst({
      where: { webinarId, observedAt: { gte: yesterdayStart, lt: dayStart } },
      orderBy: [{ online: "desc" }, { observedAt: "asc" }, { sampledAt: "asc" }],
      select: { observedAt: true, online: true },
    }),
    // Staff presence is optional. An unavailable presence service must not turn
    // the independently available audience and sales metrics into stale data.
    readAttendants({ webinarId, from: dayStart, to: now }).catch(() => undefined),
  ]);
  const inRange = (sample: typeof samples[number], range: { gte: Date; lte: Date }) =>
    sample.observedAt >= range.gte && sample.observedAt <= range.lte;
  const historyFor = (range: { gte: Date; lte: Date }) => ({
    from: range.gte.toISOString(),
    to: range.lte.toISOString(),
    // Preserve observed timestamps and zero readings; never fill collection gaps.
    points: samples.filter(sample => inRange(sample, range))
      .map(sample => ({ at: sample.observedAt.toISOString(), online: sample.online })),
  });
  const daySamples = samples.filter(sample => inRange(sample, audienceRange));
  const peak = daySamples.reduce<typeof daySamples[number] | undefined>((highest, sample) =>
    !highest || sample.online > highest.online ? sample : highest, undefined);

  return {
    ...buildWebinarRealtimeSnapshot(leads, now),
    webinarTitle: webinar.title?.trim() || webinar.name?.trim() || "Webinar",
    sales: { ...daily.sales, reconciliation: daily.reconciliation },
    funnel: daily.funnel,
    ...(attendants ? { attendants } : {}),
    audience: {
      // Derive the summary from the exact same frozen observations as the curve.
      average: daySamples.length ? daySamples.reduce((sum, sample) => sum + sample.online, 0) / daySamples.length : null,
      peak: peak?.online ?? null,
      peakAt: peak?.observedAt.toISOString() ?? null,
      yesterday: {
        peak: yesterdayPeak?.online ?? null,
        peakAt: yesterdayPeak?.observedAt.toISOString() ?? null,
        from: yesterdayStart.toISOString(),
        to: dayStart.toISOString(),
      },
      sampleCount: daySamples.length,
      history: historyFor(audienceRange),
      liveHistory: historyFor(liveRange),
      ...(sessionRange ? { sessionHistory: historyFor(sessionRange) } : {}),
    },
    schedule: {
      mode: occurrence.mode,
      startDate: occurrence.startDate?.toISOString() ?? null,
      endDate: occurrence.endDate?.toISOString() ?? null,
      pitchAtSec: occurrence.pitchAtSec,
      offerShowAtSec: occurrence.offerShowAtSec,
      offerHideAtSec: occurrence.offerHideAtSec,
      offerDisabled: occurrence.offerDisabled,
      videoSyncWithStart: occurrence.videoSyncWithStart,
    },
  };
}
