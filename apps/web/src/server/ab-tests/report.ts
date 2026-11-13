import { prisma } from "db";
import { buildAbReport, type AbReportEvent, type AbReportUnit } from "@/lib/ab-report";
import type { AbReport, AbReportFilters } from "@/lib/ab-tests";
import { realtimeDeviceType } from "@/lib/webinar-realtime";
import { AbTestError, experimentInclude, serializeExperiment } from "./experiments";
import { webinarFingerprint } from "./webinar-fingerprint";
import { assembleAbAudience, createAbAudiencePlan, type AbAudienceSchedule } from "@/lib/ab-audience";
import { getAbAudienceContext, getAbAudienceContexts } from "./audience";

const eventKinds = ["OPTIN", "VIDEO_TICK", "PITCH_REACHED", "OFFER_CLICK"] as const;

/** All queries independently scope the experiment/webinars to the authenticated owner. */
export async function getAbReport(ownerId: string, experimentId: string, filters: AbReportFilters = {}, now = new Date()): Promise<AbReport> {
  if (!ownerId) throw new AbTestError("unauthorized", 401);
  const experiment = await prisma.abExperiment.findFirst({
    where: { id: experimentId, ownerId }, include: experimentInclude
  });
  if (!experiment) throw new AbTestError("not_found", 404);
  const dto = serializeExperiment(experiment);
  const recurring = dto.mode === "OBSERVATIONAL" && dto.observationUnit === "DAILY_SESSION";
  const webinarWhere = { ownerId, id: { in: [experiment.webinarAId, experiment.webinarBId] } };
  const webinars = await prisma.webinar.findMany({ where: webinarWhere });
  // A deleted or foreign webinar must never silently become an empty arm.
  if (webinars.length !== 2) throw new AbTestError("not_found", 404);
  const webinarA = webinars.find((webinar) => webinar.id === experiment.webinarAId)!;
  const webinarB = webinars.find((webinar) => webinar.id === experiment.webinarBId)!;
  const configurationChanged = (experiment.mode === "RANDOMIZED" || recurring) && Boolean(experiment.startedAt) && (
    experiment.webinarAFingerprint !== webinarFingerprint(webinarA) || experiment.webinarBFingerprint !== webinarFingerprint(webinarB)
  );
  const pitchAtSec = {
    A: dto.configuration?.frozen ? dto.configuration.A.pitchAtSec : webinarA.pitchAtSec ?? null,
    B: dto.configuration?.frozen ? dto.configuration.B.pitchAtSec : webinarB.pitchAtSec ?? null
  };
  const schedules: Record<"A" | "B", AbAudienceSchedule> = { A: webinarA, B: webinarB };
  if (dto.configuration?.frozen) for (const variant of ["A", "B"] as const) {
    const snapshot = dto.configuration[variant];
    schedules[variant] = { mode: snapshot.mode, startDate: snapshot.startAt ? new Date(snapshot.startAt) : null,
      endDate: snapshot.endAt ? new Date(snapshot.endAt) : null, timezone: snapshot.timezone,
      recurring: snapshot.recurring, recurringDays: snapshot.recurringDays,
      videoSyncWithStart: snapshot.videoSyncWithStart, pitchAtSec: snapshot.pitchAtSec };
  }
  const collectionEnd = new Date(Math.min(experiment.endsAt?.getTime() ?? now.getTime(),
    experiment.mode === "RANDOMIZED" ? experiment.completedAt?.getTime() ?? Infinity : Infinity, now.getTime()));
  if (!experiment.startedAt || experiment.startedAt > collectionEnd) {
    const report = buildAbReport({ experiment: dto, units: [], events: [], sales: [], pitchAtSec, filters, now, configurationChanged });
    report.diagnostics!.audience = assembleAbAudience(createAbAudiencePlan({ experiment: dto, units: [], filters, now, schedules, configurationChanged }), {}, []);
    if (report.periods) for (const period of [...report.periods.daily, ...report.periods.weekly, report.periods.total]) {
      period.audience = assembleAbAudience(createAbAudiencePlan({ experiment: dto, units: [], filters: { ...filters, from: period.from, to: period.to }, now, schedules, configurationChanged }), {}, []);
    }
    return report;
  }
  const collectionRange = { gte: experiment.startedAt, lte: collectionEnd };
  const units: AbReportUnit[] = [];
  if (experiment.mode === "RANDOMIZED") {
    const assignments = await prisma.abAssignment.findMany({
      where: { experimentId, experiment: { ownerId }, createdAt: collectionRange },
      select: {
        id: true, variant: true, leadId: true, createdAt: true,
        utmSource: true, utmMedium: true, utmCampaign: true, utmContent: true, device: true,
        lead: { select: { email: true, webinarId: true } }
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }]
    });
    for (const assignment of assignments) {
      const webinarId = assignment.variant === "A" ? experiment.webinarAId : experiment.webinarBId;
      const correctLead = assignment.lead?.webinarId === webinarId;
      units.push({
        id: assignment.id, variant: assignment.variant, webinarId,
        leadId: correctLead ? assignment.leadId : null, email: correctLead ? assignment.lead!.email : null,
        assignedAt: assignment.createdAt, source: assignment.utmSource, medium: assignment.utmMedium,
        campaign: assignment.utmCampaign, content: assignment.utmContent, device: assignment.device ?? "unknown"
      });
    }
  } else {
    // First observed event in the fixed collection window. Lead.sessionStart is
    // mutable on return visits and cannot reconstruct a historical entry cohort.
    const entries = recurring ? (await prisma.$queryRaw<{ webinarId: string; leadId: string; entryDate: string; assignedAt: Date }[]>`
      SELECT e."webinarId", e."leadId",
        to_char((e."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD') AS "entryDate",
        min(e."createdAt") AS "assignedAt"
      FROM event e JOIN webinar w ON w.id = e."webinarId" AND w."ownerId" = ${ownerId}
      WHERE e."webinarId" IN (${experiment.webinarAId}, ${experiment.webinarBId}) AND e."leadId" IS NOT NULL
        AND e.kind IN ('OPTIN', 'VIDEO_TICK', 'PITCH_REACHED')
        AND e."createdAt" >= (${experiment.startedAt}::timestamptz AT TIME ZONE 'UTC')
        AND e."createdAt" <= (${collectionEnd}::timestamptz AT TIME ZONE 'UTC')
      GROUP BY e."webinarId", e."leadId", "entryDate"
    `).map((entry) => ({ ...entry, _min: { createdAt: entry.assignedAt } })) : await prisma.event.groupBy({
      by: ["webinarId", "leadId"],
      where: { webinar: webinarWhere, leadId: { not: null }, kind: { in: [...eventKinds] }, createdAt: collectionRange },
      _min: { createdAt: true }
    });
    const leads = entries.length ? await prisma.lead.findMany({
      where: { webinar: webinarWhere, id: { in: [...new Set(entries.flatMap((entry) => entry.leadId ? [entry.leadId] : []))] } },
      select: { id: true, webinarId: true, email: true, userAgent: true, utmSource: true, utmMedium: true, utmCampaign: true, utmContent: true }
    }) : [];
    const leadById = new Map(leads.map((lead) => [lead.id, lead]));
    for (const entry of entries) {
      const lead = entry.leadId ? leadById.get(entry.leadId) : undefined;
      if (!lead || lead.webinarId !== entry.webinarId || !entry._min.createdAt) continue;
      units.push({
        id: `observed:${lead.id}${recurring && "entryDate" in entry ? `:${entry.entryDate}` : ""}`, variant: lead.webinarId === experiment.webinarAId ? "A" : "B", webinarId: lead.webinarId,
        leadId: lead.id, email: lead.email, assignedAt: entry._min.createdAt,
        source: lead.utmSource, medium: lead.utmMedium, campaign: lead.utmCampaign,
        content: lead.utmContent, device: realtimeDeviceType(lead.userAgent)
      });
    }
  }

  const windowMs = experiment.conversionWindowHours * 3_600_000;
  const outcomesUntil = new Date(Math.min(now.getTime(), collectionEnd.getTime() + windowMs));
  // Pass one JSON parameter to PostgreSQL and aggregate heartbeats there. The
  // per-unit timestamp join prevents old/later visits from entering its result.
  // No N+1 query per visitor and no materialization of millions of VIDEO_TICKs.
  const firstLeadIds = new Set<string>();
  const ordered = [...units].sort((a, b) => a.assignedAt.getTime() - b.assignedAt.getTime() || a.id.localeCompare(b.id));
  const nextByUnit = new Map<string, Date>(), lastByLead = new Map<string, AbReportUnit>();
  if (recurring) for (const unit of ordered) {
    const key = `${unit.webinarId}:${unit.leadId}`, previous = lastByLead.get(key);
    if (previous) nextByUnit.set(previous.id, unit.assignedAt);
    lastByLead.set(key, unit);
  }
  const windows = ordered.flatMap((unit) => {
    const leadKey = `${unit.webinarId}:${unit.leadId}`;
    if (!unit.leadId || (!recurring && firstLeadIds.has(leadKey))) return [];
    firstLeadIds.add(leadKey);
    if (experiment.mode === "RANDOMIZED" && unit.assignedAt.getTime() + windowMs > now.getTime()) return [];
    return [{ unitId: unit.id, leadId: unit.leadId, webinarId: unit.webinarId, pitchAtSec: pitchAtSec[unit.variant],
      ...(recurring ? { nextEntry: nextByUnit.get(unit.id)?.toISOString() ?? null } : {}),
      from: unit.assignedAt.toISOString(), to: new Date(Math.min(unit.assignedAt.getTime() + windowMs, now.getTime())).toISOString() }];
  });
  const [events, sales] = await Promise.all([
    windows.length ? prisma.$queryRaw<AbReportEvent[]>`
      WITH units AS (
        SELECT * FROM jsonb_to_recordset(${JSON.stringify(windows)}::jsonb)
        AS u("unitId" text, "leadId" text, "webinarId" text, "pitchAtSec" integer, "from" timestamptz, "to" timestamptz, "nextEntry" timestamptz)
      )
      SELECT u."unitId", e.kind::text AS kind, min(e."createdAt") AS "firstOccurredAt", max(e."videoSec") AS "maxVideoSec",
        min(e."createdAt") FILTER (WHERE e.kind::text = 'PITCH_REACHED' OR
          (e.kind::text = 'VIDEO_TICK' AND u."pitchAtSec" IS NOT NULL AND e."videoSec" >= u."pitchAtSec")) AS "firstPitchAt"
      FROM units u
      JOIN webinar w ON w.id = u."webinarId" AND w."ownerId" = ${ownerId}
      JOIN event e ON e."webinarId" = w.id AND e."leadId" = u."leadId"
        AND e."createdAt" >= (u."from" AT TIME ZONE 'UTC') AND e."createdAt" <= (u."to" AT TIME ZONE 'UTC')
        AND (u."nextEntry" IS NULL OR e."createdAt" < (u."nextEntry" AT TIME ZONE 'UTC'))
      WHERE e.kind::text IN ('OPTIN', 'VIDEO_TICK', 'PITCH_REACHED', 'OFFER_CLICK')
      GROUP BY u."unitId", e.kind
    ` : Promise.resolve([] as AbReportEvent[]),
    prisma.sale.findMany({
      where: { webinar: webinarWhere, createdAt: { gte: experiment.startedAt, lte: outcomesUntil } },
      select: { id: true, webinarId: true, leadId: true, amount: true, currency: true, createdAt: true }
    })
  ]);
  const report = buildAbReport({ experiment: dto, units, events, sales, pitchAtSec, filters, now, configurationChanged });
  const audiencePlan = createAbAudiencePlan({ experiment: dto, units, filters, now, schedules, configurationChanged });
  if (report.periods) {
    const periods = [...report.periods.daily, ...report.periods.weekly, report.periods.total];
    const plans = { selected: audiencePlan, ...Object.fromEntries(periods.map((period) => [period.key, createAbAudiencePlan({
      experiment: dto, units, filters: { ...filters, from: period.from, to: period.to }, now, schedules, configurationChanged
    })])) };
    const audiences = await getAbAudienceContexts(ownerId, { A: webinarA.id, B: webinarB.id }, plans);
    report.diagnostics!.audience = audiences.selected;
    for (const period of periods) period.audience = audiences[period.key];
  } else report.diagnostics!.audience = await getAbAudienceContext(ownerId, { A: webinarA.id, B: webinarB.id }, audiencePlan);
  return report;
}
