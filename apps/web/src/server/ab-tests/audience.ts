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
