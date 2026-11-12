import { randomInt } from "node:crypto";
import { prisma } from "db";
import { verifyAbAssignment } from "@/lib/ab-test-cookie";
import { realtimeDeviceType } from "@/lib/webinar-realtime";
import { AbTestError } from "./experiments";
import { createLimiter } from "@/lib/rate-limit";
import { computePhase, withOccurrence } from "@/lib/sync";

// Limits repeat requests by the same browser, without using IP as the allocation unit.
const allocationLimiter = createLimiter({ max: 60, windowMs: 60_000 });

export async function allocateAbVisitor(experimentId: string, visitorId: string, query: URLSearchParams, userAgent: string | null) {
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(experimentId) || !/^[a-zA-Z0-9_-]{1,128}$/.test(visitorId)) throw new AbTestError("not_found", 404);
  if (!allocationLimiter.check(`${experimentId}:${visitorId}`)) throw new AbTestError("rate_limited", 429, "Aguarde um instante e tente novamente.");
  return prisma.$transaction(async (tx) => {
    // The same lock protects admin status transitions: no allocation can race past a pause/end.
    const locked = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM "ab_experiment" WHERE id = ${experimentId} FOR UPDATE`;
    if (!locked.length) throw new AbTestError("not_found", 404);
    const experiment = await tx.abExperiment.findUnique({ where: { id: experimentId }, include: { webinarA: true, webinarB: true } });
    if (!experiment || experiment.mode !== "RANDOMIZED") throw new AbTestError("not_found", 404);
    let assignment = await tx.abAssignment.findUnique({ where: { experimentId_visitorId: { experimentId, visitorId } } });
    const now = new Date();
    if (!assignment) {
      if (experiment.status !== "RUNNING" || !experiment.startedAt || !experiment.endsAt || experiment.startedAt > now || experiment.endsAt <= now) {
        throw new AbTestError("allocation_closed", 409, "Este teste não está recebendo novos participantes no momento.");
      }
      if ([experiment.webinarA, experiment.webinarB].some((w) => w.status !== "ACTIVE" || !w.slug || computePhase(withOccurrence(w, now), now) === "closed")) {
        throw new AbTestError("variant_unavailable", 409, "As versões deste teste não estão disponíveis no momento.");
      }
      const variant = randomInt(2) === 0 ? "A" : "B";
      const utm = (key: string) => query.get(key)?.trim().slice(0, 300) || null;
      assignment = await tx.abAssignment.create({ data: {
        experimentId, visitorId, variant, createdAt: now,
        utmSource: utm("utm_source"), utmMedium: utm("utm_medium"), utmCampaign: utm("utm_campaign"), utmContent: utm("utm_content"),
        device: realtimeDeviceType(userAgent)
      } });
    }
    const webinar = assignment.variant === "A" ? experiment.webinarA : experiment.webinarB;
    if (webinar.status !== "ACTIVE" || !webinar.slug) throw new AbTestError("variant_unavailable", 409, "A versão atribuída não está disponível. Tente novamente mais tarde.");
    return { assignmentId: assignment.id, webinarId: webinar.id, slug: webinar.slug, variant: assignment.variant };
  });
}

/** A token is only a locator: its signature, webinar, identity and time window are all checked. */
export async function resolveBoundAbAssignment(webinarId: string, leadId: string, token: string | null | undefined, now = new Date()) {
  const id = verifyAbAssignment(token);
  if (!id) return null;
  const assignment = await prisma.abAssignment.findFirst({ where: { id, leadId }, include: { experiment: true } });
  if (!assignment || assignment.experiment.mode !== "RANDOMIZED") return null;
  const expectedWebinar = assignment.variant === "A" ? assignment.experiment.webinarAId : assignment.experiment.webinarBId;
  if (expectedWebinar !== webinarId || assignment.createdAt > now || now.getTime() > assignment.createdAt.getTime() + assignment.experiment.conversionWindowHours * 3_600_000) return null;
  return assignment;
}

/** First identity wins; subsequent opt-ins must never move an assignment to another lead. */
export async function bindAbAssignmentToLead(webinarId: string, leadId: string, token: string | null | undefined) {
  const id = verifyAbAssignment(token);
  if (!id) return;
  const assignment = await prisma.abAssignment.findUnique({ where: { id }, include: { experiment: true } });
  if (!assignment || assignment.leadId || assignment.experiment.mode !== "RANDOMIZED") return;
  const expectedWebinar = assignment.variant === "A" ? assignment.experiment.webinarAId : assignment.experiment.webinarBId;
  const now = new Date();
  if (expectedWebinar !== webinarId || assignment.createdAt > now || now.getTime() > assignment.createdAt.getTime() + assignment.experiment.conversionWindowHours * 3_600_000) return;
  const lead = await prisma.lead.findFirst({ where: { id: leadId, webinarId }, select: { id: true } });
  if (!lead) return;
  // Compare-and-swap keeps binding immutable even when two opt-ins race.
  await prisma.abAssignment.updateMany({ where: { id, leadId: null }, data: { leadId } });
}
