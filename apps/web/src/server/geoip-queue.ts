import { prisma, type Prisma } from "db";
import { hasValidGeo, normalizePublicIp, type GeoIpData } from "../lib/geoip";
import { publishPresenceEvent } from "./realtime/bus";

// Include partial and out-of-range coordinates, not just two NULL columns.
export const missingGeoWhere: Prisma.LeadWhereInput = {
  OR: [
    { lat: null }, { lng: null },
    { lat: { lt: -90 } }, { lat: { gt: 90 } },
    { lng: { lt: -180 } }, { lng: { gt: 180 } }
  ]
};

type GeoLead = { id: string; ip: string | null; lat: number | null; lng: number | null };

// Persist only to leads still using this IP and still missing valid coordinates.
// A retry must never erase/replace a good location or a newer session's IP.
export async function applyGeoIpResult(ip: string, data: GeoIpData): Promise<void> {
  if (!hasValidGeo(data)) return;
  const webinars = await prisma.$transaction(async tx => {
    const where = { AND: [{ ip }, missingGeoWhere] };
    const affected = await tx.lead.findMany({ where, distinct: ["webinarId"], select: { webinarId: true } });
    if (!affected.length) return [];
    const updated = await tx.lead.updateMany({ where, data });
    return updated.count ? affected : [];
  });
  await Promise.all(webinars.map(({ webinarId }) => publishPresenceEvent(webinarId)));
}

// No provider call is made on the HTTP path. An enqueue failure must not stop
// playback: the paginated scanner recovers persisted leads on a following tick.
export async function queueLeadGeo(lead: GeoLead, requestIp?: string | null, priority = 1): Promise<void> {
  if (hasValidGeo(lead)) return;
  const ip = normalizePublicIp(requestIp) ?? normalizePublicIp(lead.ip);
  if (!ip) return;
  try {
    if (lead.ip !== ip) {
      const updated = await prisma.lead.updateMany({
        where: { id: lead.id, ip: lead.ip, AND: [missingGeoWhere] },
        data: { ip }
      });
      if (!updated.count) return;
    }

    // createMany/skipDuplicates is atomic under simultaneous opt-ins/heartbeats.
    // Existing retries and leases are deliberately left untouched.
    await prisma.geoIpLookup.createMany({ data: [{ ip, priority }], skipDuplicates: true });
    if (priority > 0) await prisma.geoIpLookup.updateMany({
      where: { ip, status: "PENDING", priority: { lt: priority } }, data: { priority }
    });
    const lookup = await prisma.geoIpLookup.findUnique({ where: { ip } });
    if (!lookup) return;
    const now = new Date();
    if (lookup.status === "SUCCESS" && lookup.expiresAt && lookup.expiresAt > now && hasValidGeo(lookup)) {
      await applyGeoIpResult(ip, {
        country: lookup.country, region: lookup.region, city: lookup.city,
        lat: lookup.lat!, lng: lookup.lng!
      });
      return;
    }

    // A negative cache prevents one unavailable IP from monopolizing the queue.
    // After expiry it can be retried, without rearming active jobs on every tick.
    await prisma.geoIpLookup.updateMany({
      where: {
        ip, status: { in: ["SUCCESS", "FAILED"] },
        OR: [{ expiresAt: null }, { expiresAt: { lte: now } }]
      },
      data: {
        status: "PENDING", priority, attempts: 0, nextAttemptAt: now,
        leaseToken: null, leaseUntil: null, lastError: null, expiresAt: null
      }
    });
  } catch {
    console.warn("[geoip] enqueue_failed");
  }
}

// Keyset pagination advances past invalid/private IPs and negative caches, so
// an unresolved first page cannot starve the rest of the historical backlog.
export async function backfillGeoIpBatch(cursor?: string): Promise<string | undefined> {
  const leads = await prisma.lead.findMany({
    // Recover recent activity, including old registrations watching now, without
    // spending today's provider quota on the entire inactive historical archive.
    // Older viewers are also explicitly enqueued when they return to /live.
    where: { AND: [missingGeoWhere, { ip: { not: null }, lastSeenAt: { gte: new Date(Date.now() - 86_400_000) } },
      ...(cursor ? [{ id: { gt: cursor } }] : [])] },
    orderBy: { id: "asc" }, take: 50,
    select: { id: true, ip: true, lat: true, lng: true }
  });
  for (const lead of leads) await queueLeadGeo(lead, undefined, 0);
  return leads.length === 50 ? leads[leads.length - 1].id : undefined;
}
