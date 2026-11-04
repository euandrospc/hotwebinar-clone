import { prisma } from "db";
import { getOnlineSnapshot } from "../lib/online";
import { publishPresenceEvent } from "./realtime/bus";
import { computePhase, withOccurrence } from "../lib/sync";

export const AUDIENCE_SAMPLE_MS = 15_000;

export interface AudienceSummary {
  average: number | null;
  peak: number | null;
  peakAt: string | null;
  sampleCount: number;
}

// One row per webinar and time slot, even when multiple server replicas collect.
export async function recordAudienceSample(now = new Date()) {
  const webinars = await prisma.webinar.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, mode: true, startDate: true, endDate: true, recurring: true, recurringDays: true, timezone: true }
  });
  if (!webinars.length) return;
  const online = await getOnlineSnapshot();
  const sampledAt = new Date(Math.floor(now.getTime() / AUDIENCE_SAMPLE_MS) * AUDIENCE_SAMPLE_MS);
  const data = webinars.filter(webinar => computePhase(withOccurrence(webinar, now), now) === "open")
    .map(webinar => ({
      webinarId: webinar.id, sampledAt, observedAt: now, online: online.byWebinar.get(webinar.id) ?? 0
    }));
  if (data.length) {
    const result = await prisma.audienceSample.createMany({ data, skipDuplicates: true });
    if (result.count) await Promise.all(data.map(sample => publishPresenceEvent(sample.webinarId)));
  }
}

export async function getAudienceSummary(webinarId: string, from: Date, to: Date): Promise<AudienceSummary> {
  const where = { webinarId, observedAt: { gte: from, lte: to } };
  const [aggregate, peak] = await Promise.all([
    prisma.audienceSample.aggregate({ where, _avg: { online: true }, _max: { online: true }, _count: true }),
    prisma.audienceSample.findFirst({ where, orderBy: [{ online: "desc" }, { observedAt: "asc" }], select: { observedAt: true } })
  ]);
  return { average: aggregate._avg.online, peak: aggregate._max.online, peakAt: peak?.observedAt.toISOString() ?? null, sampleCount: aggregate._count };
}

export function startAudienceRecorder() {
  let busy = false;
  let closed = false;
  async function tick() {
    if (closed || busy) return;
    busy = true;
    try { await recordAudienceSample(); }
    catch { console.error("Audience history collection failed; retrying next interval."); }
    finally { busy = false; }
  }
  void tick();
  const timer = setInterval(() => void tick(), AUDIENCE_SAMPLE_MS);
  timer.unref();
  return () => { closed = true; clearInterval(timer); };
}
