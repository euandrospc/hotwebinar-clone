import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "db";
import { applyGeoIpResult, backfillGeoIpBatch, queueLeadGeo } from "@/server/geoip-queue";

const { publishPresenceEvent } = vi.hoisted(() => ({ publishPresenceEvent: vi.fn(async () => {}) }));
vi.mock("@/server/realtime/bus", () => ({ publishPresenceEvent }));

const IP = "8.8.8.8";
const GEO = { country: "BR", region: "São Paulo", city: "São Paulo", lat: -23.5, lng: -46.6 };
let webinarId: string;

beforeEach(async () => {
  vi.clearAllMocks();
  await prisma.geoIpLookup.deleteMany();
  await prisma.geoIpProviderState.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.webinar.deleteMany();
  await prisma.user.deleteMany();
  const user = await prisma.user.create({ data: { id: "geo-queue-user", name: "Geo", email: "geo-queue@example.test" } });
  const webinar = await prisma.webinar.create({ data: { ownerId: user.id, name: "Geo", title: "Geo", slug: "geo-queue" } });
  webinarId = webinar.id;
});
afterAll(async () => { await prisma.$disconnect(); });

async function makeLead(id: string, overrides: Record<string, unknown> = {}) {
  return prisma.lead.create({ data: { id, webinarId, name: "Test", email: `${id}@example.test`, ip: IP, ...overrides } });
}

describe("durable GeoIP queue", () => {
  it("deduplicates simultaneous opt-ins sharing an IP and never calls the provider", async () => {
    const first = await makeLead("first");
    const second = await makeLead("second");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("unexpected request"));
    try {
      await Promise.all([queueLeadGeo(first), queueLeadGeo(second), queueLeadGeo(first)]);
      expect(await prisma.geoIpLookup.count()).toBe(1);
      expect(await prisma.geoIpLookup.findUnique({ where: { ip: IP } })).toMatchObject({ status: "PENDING", attempts: 0 });
      expect(fetchMock).not.toHaveBeenCalled();
    } finally { fetchMock.mockRestore(); }
  });

  it("does not reset a retry's attempts, schedule or lease on each heartbeat", async () => {
    const lead = await makeLead("retry");
    const future = new Date(Date.now() + 60_000);
    await prisma.geoIpLookup.create({ data: { ip: IP, attempts: 3, nextAttemptAt: future, leaseToken: "owner", leaseUntil: future } });
    await queueLeadGeo(lead);
    expect(await prisma.geoIpLookup.findUnique({ where: { ip: IP } })).toMatchObject({
      attempts: 3, nextAttemptAt: future, leaseToken: "owner", leaseUntil: future
    });
  });

  it("reuses a successful cache for all missing leads but preserves good coordinates", async () => {
    const missing = await makeLead("missing");
    await makeLead("partial", { lat: -15, lng: null });
    const good = await makeLead("good", { lat: 10, lng: 20, city: "Original" });
    await prisma.geoIpLookup.create({ data: { ip: IP, status: "SUCCESS", ...GEO, expiresAt: new Date(Date.now() + 60_000) } });
    await queueLeadGeo(missing);
    expect(await prisma.lead.findUnique({ where: { id: missing.id } })).toMatchObject(GEO);
    expect(await prisma.lead.findUnique({ where: { id: "partial" } })).toMatchObject(GEO);
    expect(await prisma.lead.findUnique({ where: { id: good.id } })).toMatchObject({ lat: 10, lng: 20, city: "Original" });
    expect(publishPresenceEvent).toHaveBeenCalledWith(webinarId);
  });

  it("skips leads with valid coordinates and ignores invalid provider results", async () => {
    const good = await makeLead("good", GEO);
    await queueLeadGeo(good, "1.1.1.1");
    expect(await prisma.geoIpLookup.count()).toBe(0);
    expect(await prisma.lead.findUnique({ where: { id: good.id } })).toMatchObject({ ip: IP, ...GEO });
    const missing = await makeLead("missing");
    await applyGeoIpResult(IP, { ...GEO, lat: Number.NaN });
    expect(await prisma.lead.findUnique({ where: { id: missing.id } })).toMatchObject({ lat: null, lng: null });
  });

  it("recovers missing IP from the current request and normalizes mapped IPv4", async () => {
    const lead = await makeLead("unknown", { ip: "unknown" });
    await queueLeadGeo(lead, "::ffff:8.8.8.8");
    expect(await prisma.lead.findUnique({ where: { id: lead.id } })).toMatchObject({ ip: IP });
    expect(await prisma.geoIpLookup.findUnique({ where: { ip: IP } })).toMatchObject({ status: "PENDING" });
  });

  it("does not change an IP updated by a newer request or apply an old IP's result", async () => {
    const stale = await makeLead("changed", { ip: "unknown" });
    await prisma.lead.update({ where: { id: stale.id }, data: { ip: "1.1.1.1" } });
    await queueLeadGeo(stale, IP);
    await applyGeoIpResult(IP, GEO);
    expect(await prisma.lead.findUnique({ where: { id: stale.id } })).toMatchObject({ ip: "1.1.1.1", lat: null, lng: null });
    expect(await prisma.geoIpLookup.count()).toBe(0);
  });

  it("holds a negative cache until expiry, then rearms once", async () => {
    const lead = await makeLead("negative");
    await prisma.geoIpLookup.create({ data: {
      ip: IP, status: "FAILED", attempts: 5, lastError: "timeout", expiresAt: new Date(Date.now() + 60_000)
    } });
    await queueLeadGeo(lead);
    expect(await prisma.geoIpLookup.findUnique({ where: { ip: IP } })).toMatchObject({ status: "FAILED", attempts: 5, lastError: "timeout" });
    await prisma.geoIpLookup.update({ where: { ip: IP }, data: { expiresAt: new Date(Date.now() - 1_000) } });
    await Promise.all([queueLeadGeo(lead), queueLeadGeo(lead)]);
    expect(await prisma.geoIpLookup.findUnique({ where: { ip: IP } })).toMatchObject({ status: "PENDING", attempts: 0, lastError: null });
  });

  it("reapplies persisted success after a crash before updating leads", async () => {
    await makeLead("recovered", { lat: 100, lng: 500 });
    await prisma.geoIpLookup.create({ data: { ip: IP, status: "SUCCESS", ...GEO, expiresAt: new Date(Date.now() + 60_000) } });
    await backfillGeoIpBatch();
    expect(await prisma.lead.findUnique({ where: { id: "recovered" } })).toMatchObject(GEO);
  });

  it("advances beyond a full page of unresolvable legacy leads", async () => {
    await prisma.lead.createMany({ data: Array.from({ length: 50 }, (_, i) => ({
      id: `a-${String(i).padStart(3, "0")}`, webinarId, name: "Private", email: `p${i}@example.test`, ip: "192.168.1.1"
    })) });
    await makeLead("z-public");
    const cursor = await backfillGeoIpBatch();
    expect(cursor).toBe("a-049");
    expect(await prisma.geoIpLookup.count()).toBe(0);
    expect(await backfillGeoIpBatch(cursor)).toBeUndefined();
    expect(await prisma.geoIpLookup.findUnique({ where: { ip: IP } })).toMatchObject({ status: "PENDING" });
  });

  it("does not spend quota on inactive history but queues an old registration when it returns", async () => {
    const old = await makeLead("old", { lastSeenAt: new Date(Date.now() - 7 * 86_400_000) });
    await backfillGeoIpBatch();
    expect(await prisma.geoIpLookup.count()).toBe(0);
    await queueLeadGeo(old);
    expect(await prisma.geoIpLookup.findUnique({ where: { ip: IP } })).toMatchObject({ status: "PENDING", priority: 1 });
  });
});
