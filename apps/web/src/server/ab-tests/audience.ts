import { prisma } from "db";
import { assembleAbAudience, type AbAudienceAggregate, type AbAudiencePlan, type AbAudienceSample } from "@/lib/ab-audience";
import type { AbVariantKey } from "@/lib/ab-tests";

/** Constant query count; no loading of months of 15-second audience snapshots. */
export async function getAbAudienceContext(ownerId: string, webinarIds: Record<AbVariantKey, string>, plan: AbAudiencePlan) {
  const aggregates: Partial<Record<AbVariantKey, AbAudienceAggregate>> = {};
  const samples: AbAudienceSample[] = [];
  await Promise.all((["A", "B"] as const).map(async (variant) => {
    const arm = plan[variant];
    if (arm.reason || !arm.windows.length) return;
    const scope = { webinarId: webinarIds[variant], webinar: { ownerId } };
    const where = { ...scope, OR: arm.windows.map((window) => ({ observedAt: { gte: window.from, lte: window.to } })) };
    const [aggregate, peak, aroundPitch] = await Promise.all([
      prisma.audienceSample.aggregate({ where, _avg: { online: true }, _max: { online: true }, _count: true }),
      prisma.audienceSample.findFirst({ where, orderBy: [{ online: "desc" }, { observedAt: "asc" }], select: { observedAt: true } }),
      arm.pitchTargets.length ? prisma.audienceSample.findMany({ where: { ...scope,
        OR: arm.pitchTargets.map((target) => ({ observedAt: { gte: new Date(target.getTime() - 15_000), lte: new Date(target.getTime() + 15_000) } })) },
        select: { online: true, observedAt: true }, orderBy: { observedAt: "asc" } }) : Promise.resolve([])
    ]);
    aggregates[variant] = { average: aggregate._avg.online, peak: aggregate._max.online, peakAt: peak?.observedAt ?? null, sampleCount: aggregate._count };
    samples.push(...aroundPitch.map((sample) => ({ ...sample, variant })));
  }));
  return assembleAbAudience(plan, aggregates, samples);
}

/** Aggregate all calendar comparisons in two queries, rather than one per day. */
export async function getAbAudienceContexts(ownerId: string, webinarIds: Record<AbVariantKey, string>, plans: Record<string, AbAudiencePlan>) {
  const windows = Object.entries(plans).flatMap(([key, plan]) => (["A", "B"] as const).flatMap((variant) =>
    plan[variant].reason ? [] : plan[variant].windows.map((window) => ({ key, variant, webinarId: webinarIds[variant],
      from: window.from.toISOString(), to: window.to.toISOString() }))));
  const targets = Object.entries(plans).flatMap(([key, plan]) => (["A", "B"] as const).flatMap((variant) =>
    plan[variant].reason ? [] : plan[variant].pitchTargets.map((target) => ({ key, variant, webinarId: webinarIds[variant], at: target.toISOString() }))));
  type AggregateRow = AbAudienceAggregate & { key: string; variant: AbVariantKey };
  type SampleRow = AbAudienceSample & { key: string };
  const [aggregates, samples] = await Promise.all([
    windows.length ? prisma.$queryRaw<AggregateRow[]>`
      WITH windows AS (
        SELECT * FROM jsonb_to_recordset(${JSON.stringify(windows)}::jsonb)
        AS u(key text, variant text, "webinarId" text, "from" timestamptz, "to" timestamptz)
      )
      SELECT u.key, u.variant, avg(s.online)::float8 AS average, max(s.online)::integer AS peak,
        (array_agg(s."observedAt" ORDER BY s.online DESC, s."observedAt" ASC))[1] AS "peakAt",
        count(*)::integer AS "sampleCount"
      FROM windows u JOIN webinar w ON w.id = u."webinarId" AND w."ownerId" = ${ownerId}
      JOIN audience_sample s ON s."webinarId" = w.id AND s.online >= 0
        AND s."observedAt" >= (u."from" AT TIME ZONE 'UTC') AND s."observedAt" <= (u."to" AT TIME ZONE 'UTC')
      GROUP BY u.key, u.variant
    ` : Promise.resolve([] as AggregateRow[]),
    targets.length ? prisma.$queryRaw<SampleRow[]>`
      WITH targets AS (
        SELECT * FROM jsonb_to_recordset(${JSON.stringify(targets)}::jsonb)
        AS u(key text, variant text, "webinarId" text, at timestamptz)
      )
      SELECT DISTINCT u.key, u.variant, s.online, s."observedAt"
      FROM targets u JOIN webinar w ON w.id = u."webinarId" AND w."ownerId" = ${ownerId}
      JOIN audience_sample s ON s."webinarId" = w.id AND s.online >= 0
        AND s."observedAt" >= ((u.at - interval '15 seconds') AT TIME ZONE 'UTC')
        AND s."observedAt" <= ((u.at + interval '15 seconds') AT TIME ZONE 'UTC')
    ` : Promise.resolve([] as SampleRow[])
  ]);
  return Object.fromEntries(Object.entries(plans).map(([key, plan]) => [key, assembleAbAudience(plan,
    Object.fromEntries(aggregates.filter((row) => row.key === key).map((row) => [row.variant, row])),
    samples.filter((row) => row.key === key))]));
}
