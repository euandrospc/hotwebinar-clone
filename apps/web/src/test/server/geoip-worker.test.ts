import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { prisma } from "db";
import type { lookupGeoIp } from "@/lib/geoip";
import { buildWebinarRealtimeSnapshot } from "@/lib/webinar-realtime";
import { queueLeadGeo } from "@/server/geoip-queue";
import { processNextGeoIpLookup, startGeoIpWorker } from "@/server/geoip-worker";

const provider = vi.hoisted(() => ({ lookup: vi.fn(), notify: vi.fn(async () => {}) }));
vi.mock("@/lib/geoip", async importOriginal => ({
  ...await importOriginal<typeof import("@/lib/geoip")>(), lookupGeoIp: provider.lookup
}));
vi.mock("@/server/realtime/bus", () => ({ publishPresenceEvent: provider.notify }));

type LookupResult = Awaited<ReturnType<typeof lookupGeoIp>>;
const ownerId = "geo-worker-owner";
const webinarId = "geo-worker-webinar";
const ip = "8.8.8.8";
const otherIp = "1.1.1.1";
const baseTime = new Date("2030-01-01T00:00:00Z").getTime();
const day = 86_400_000;
const geo = { country: "BR", region: "SP", city: "São Paulo", lat: -23.55, lng: -46.63 };
const success: LookupResult = { ok: true, data: geo };

beforeAll(() => {
  const database = new URL(process.env.DATABASE_URL!);
  expect(database.hostname).toBe("localhost");
  expect(database.port).toBe("5452");
  expect(database.pathname).toBe("/hotwebinar_test");
});
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(baseTime);
  vi.stubEnv("GEOIP_MIN_INTERVAL_MS", "1000");
  provider.lookup.mockReset().mockResolvedValue(success);
  provider.notify.mockClear();
  // No real provider calls are permitted even if a future refactor bypasses the mock.
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Unexpected network request in GeoIP worker test"); }));
  await prisma.geoIpLookup.deleteMany();
  await prisma.geoIpProviderState.deleteMany();
  await prisma.user.deleteMany({ where: { id: ownerId } });
  await prisma.user.create({ data: { id: ownerId, email: "geo-worker@example.test", name: "Geo worker" } });
  await prisma.webinar.create({ data: { id: webinarId, ownerId, title: "Geo worker" } });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
afterAll(async () => {
  await prisma.geoIpLookup.deleteMany();
  await prisma.geoIpProviderState.deleteMany();
  await prisma.user.deleteMany({ where: { id: ownerId } });
  await prisma.$disconnect();
});

async function makeLead(id = "geo-worker-lead", address = ip) {
  return prisma.lead.create({ data: { id, webinarId, name: "Viewer", ip: address, email: `${id}@example.test` } });
}
async function enqueue(address = ip) {
  return prisma.geoIpLookup.create({ data: { ip: address, nextAttemptAt: new Date() } });
}
function holdLookup() {
  let release!: (result: LookupResult) => void;
  let signalStarted!: () => void;
  const started = new Promise<void>(resolve => { signalStarted = resolve; });
  provider.lookup.mockImplementationOnce(() => {
    signalStarted();
    return new Promise<LookupResult>(resolve => { release = resolve; });
  });
  return { started, release: (result = success) => release(result) };
}

it("recovers a failed lookup and moves the same online viewers onto the map", async () => {
  const first = await makeLead();
  const second = await makeLead("geo-worker-second");
  await Promise.all([queueLeadGeo(first), queueLeadGeo(second)]);
  expect(await prisma.geoIpLookup.count()).toBe(1);
  const before = buildWebinarRealtimeSnapshot([first, second]);
  expect(before).toMatchObject({ online: 2, located: 0, unlocated: 2 });
  provider.lookup.mockResolvedValueOnce({ ok: false, error: "network_error", retryable: true });

  await processNextGeoIpLookup();
  expect(await prisma.geoIpLookup.findUnique({ where: { ip } })).toMatchObject({
    status: "PENDING", attempts: 1, nextAttemptAt: new Date(baseTime + 30_000), leaseToken: null
  });
  vi.setSystemTime(baseTime + 29_999);
  await processNextGeoIpLookup();
  expect(provider.lookup).toHaveBeenCalledTimes(1);
  vi.setSystemTime(baseTime + 30_000);
  await processNextGeoIpLookup();

  const after = buildWebinarRealtimeSnapshot(await prisma.lead.findMany({ where: { webinarId } }));
  expect(after).toMatchObject({ online: 2, located: 2, unlocated: 0 });
  // Shared IP results preserve the same coordinates, with one pin per viewer.
  expect(after.locations).toHaveLength(2);
  expect(after.locations).toEqual(expect.arrayContaining([
    expect.objectContaining({ id: first.id, ...geo, count: 1 }),
    expect.objectContaining({ id: second.id, ...geo, count: 1 })
  ]));
  expect(provider.notify).toHaveBeenCalledWith(webinarId);
  expect(await prisma.geoIpLookup.findUnique({ where: { ip } })).toMatchObject({
    status: "SUCCESS", attempts: 2, lastError: null, expiresAt: new Date(baseTime + 30_000 + day)
  });
});

it("pauses every IP on rate limiting, respects Retry-After, and does not spend an attempt", async () => {
  await enqueue();
  await enqueue(otherIp);
  // Ensure this IP is selected first regardless of same-time lexicographic ordering.
  await prisma.geoIpLookup.update({ where: { ip: otherIp }, data: { nextAttemptAt: new Date(baseTime + 1) } });
  provider.lookup.mockResolvedValueOnce({ ok: false, error: "rate_limited", retryable: true, retryAfterMs: 120_000 });
  await processNextGeoIpLookup();
  expect(await prisma.geoIpProviderState.findUnique({ where: { id: "ipapi" } })).toMatchObject({
    nextRequestAt: new Date(baseTime + 120_000), leaseToken: null
  });
  expect(await prisma.geoIpLookup.findUnique({ where: { ip } })).toMatchObject({
    status: "PENDING", attempts: 0, expiresAt: null
  });
  vi.setSystemTime(baseTime + 119_999);
  await processNextGeoIpLookup();
  expect(provider.lookup).toHaveBeenCalledTimes(1);
  vi.setSystemTime(baseTime + 120_000);
  await processNextGeoIpLookup();
  expect(provider.lookup).toHaveBeenCalledTimes(2);
  expect(provider.lookup).toHaveBeenLastCalledWith(otherIp);
});

it("uses a one-hour default rate-limit pause and resumes when the provider recovers", async () => {
  await enqueue();
  provider.lookup.mockResolvedValue({ ok: false, error: "rate_limited", retryable: true });
  await processNextGeoIpLookup();
  expect(await prisma.geoIpProviderState.findUnique({ where: { id: "ipapi" } })).toMatchObject({
    nextRequestAt: new Date(baseTime + 3_600_000)
  });
  vi.setSystemTime(baseTime + 3_600_000);
  await processNextGeoIpLookup();
  expect(provider.lookup).toHaveBeenCalledTimes(2);
  expect(await prisma.geoIpLookup.findUnique({ where: { ip } })).toMatchObject({
    status: "PENDING", attempts: 0, expiresAt: null
  });
  provider.lookup.mockResolvedValue(success);
  vi.setSystemTime(baseTime + 7_200_000);
  await processNextGeoIpLookup();
  expect(await prisma.geoIpLookup.findUnique({ where: { ip } })).toMatchObject({ status: "SUCCESS", attempts: 1 });
});

it("applies a server-directed pause for transient errors while retaining the retry attempt", async () => {
  await enqueue();
  provider.lookup.mockResolvedValueOnce({ ok: false, error: "http_503", retryable: true, retryAfterMs: 600_000 });
  await processNextGeoIpLookup();
  expect(await prisma.geoIpProviderState.findUnique({ where: { id: "ipapi" } })).toMatchObject({
    nextRequestAt: new Date(baseTime + 600_000)
  });
  expect(await prisma.geoIpLookup.findUnique({ where: { ip } })).toMatchObject({
    status: "PENDING", attempts: 1, nextAttemptAt: new Date(baseTime + 600_000)
  });
});

it("allows only one replica to call the provider and never configures less than one second between requests", async () => {
  vi.stubEnv("GEOIP_MIN_INTERVAL_MS", "1");
  await enqueue();
  await enqueue(otherIp);
  const held = holdLookup();
  const first = processNextGeoIpLookup();
  await held.started;
  await Promise.all([processNextGeoIpLookup(), processNextGeoIpLookup()]);
  expect(provider.lookup).toHaveBeenCalledTimes(1);
  expect(await prisma.geoIpProviderState.findUnique({ where: { id: "ipapi" } })).toMatchObject({
    leaseToken: expect.any(String), leaseUntil: new Date(baseTime + 30_000)
  });
  held.release();
  await first;
  vi.setSystemTime(baseTime + 999);
  await processNextGeoIpLookup();
  expect(provider.lookup).toHaveBeenCalledTimes(1);
  vi.setSystemTime(baseTime + 1_000);
  await processNextGeoIpLookup();
  expect(provider.lookup).toHaveBeenCalledTimes(2);
});

it("recovers an expired job and provider lease after a process restart", async () => {
  const expired = new Date(baseTime - 1);
  await prisma.geoIpLookup.create({ data: {
    ip, attempts: 1, nextAttemptAt: expired, leaseToken: "dead-process", leaseUntil: expired
  } });
  await prisma.geoIpProviderState.create({ data: {
    id: "ipapi", nextRequestAt: expired, leaseToken: "dead-process", leaseUntil: expired
  } });
  await processNextGeoIpLookup();
  expect(provider.lookup).toHaveBeenCalledTimes(1);
  expect(await prisma.geoIpLookup.findUnique({ where: { ip } })).toMatchObject({
    status: "SUCCESS", attempts: 2, leaseToken: null, leaseUntil: null
  });
});

it("prioritizes a current viewer over the older historical backlog", async () => {
  await prisma.geoIpLookup.create({ data: { ip, priority: 0, nextAttemptAt: new Date(baseTime - day) } });
  await prisma.geoIpLookup.create({ data: { ip: otherIp, priority: 1, nextAttemptAt: new Date(baseTime) } });
  await processNextGeoIpLookup();
  expect(provider.lookup).toHaveBeenCalledOnce();
  expect(provider.lookup).toHaveBeenCalledWith(otherIp);
  expect(await prisma.geoIpLookup.findUnique({ where: { ip } })).toMatchObject({ status: "PENDING", attempts: 0 });
});

it("keeps the provider lease until the saved location has been applied and published", async () => {
  await makeLead();
  await enqueue();
  let finishPublication!: () => void;
  let notifyStarted!: () => void;
  const publishing = new Promise<void>(resolve => { notifyStarted = resolve; });
  provider.notify.mockImplementationOnce(() => {
    notifyStarted();
    return new Promise<void>(resolve => { finishPublication = resolve; });
  });
  const processing = processNextGeoIpLookup();
  await publishing;
  expect(await prisma.geoIpLookup.findUnique({ where: { ip } })).toMatchObject({ status: "SUCCESS" });
  expect(await prisma.geoIpProviderState.findUnique({ where: { id: "ipapi" } })).toMatchObject({ leaseToken: expect.any(String) });
  vi.setSystemTime(baseTime + 1_001);
  await enqueue(otherIp);
  await processNextGeoIpLookup();
  expect(provider.lookup).toHaveBeenCalledTimes(1);
  finishPublication();
  await processing;
  expect(await prisma.geoIpProviderState.findUnique({ where: { id: "ipapi" } })).toMatchObject({ leaseToken: null });
});

it("discards a late result after another worker takes over its expired lease", async () => {
  await makeLead();
  await enqueue();
  const held = holdLookup();
  const oldWorker = processNextGeoIpLookup();
  await held.started;
  vi.setSystemTime(baseTime + 30_001);
  const newerGeo = { ...geo, city: "Rio de Janeiro", lat: -22.9, lng: -43.17 };
  provider.lookup.mockResolvedValueOnce({ ok: true, data: newerGeo });
  await processNextGeoIpLookup();
  held.release();
  await oldWorker;
  expect(await prisma.geoIpLookup.findUnique({ where: { ip } })).toMatchObject({ status: "SUCCESS", city: "Rio de Janeiro" });
  expect(await prisma.lead.findUnique({ where: { id: "geo-worker-lead" } })).toMatchObject({ city: "Rio de Janeiro" });
  expect(provider.notify).toHaveBeenCalledTimes(1);
});

it("exhausts five transient attempts with backoff and honors the negative cache", async () => {
  const lead = await makeLead();
  await queueLeadGeo(lead);
  provider.lookup.mockResolvedValue({ ok: false, error: "network_error", retryable: true });
  const waits = [30_000, 120_000, 600_000, 3_600_000];
  let now = baseTime;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    await processNextGeoIpLookup();
    const job = await prisma.geoIpLookup.findUniqueOrThrow({ where: { ip } });
    expect(job.attempts).toBe(attempt);
    if (attempt < 5) {
      now += waits[attempt - 1];
      expect(job.nextAttemptAt.getTime()).toBe(now);
      vi.setSystemTime(now);
    } else {
      expect(job).toMatchObject({ status: "FAILED", expiresAt: new Date(now + day), leaseToken: null });
    }
  }
  await queueLeadGeo(lead);
  vi.setSystemTime(now + 5_000);
  await processNextGeoIpLookup();
  expect(provider.lookup).toHaveBeenCalledTimes(5);
  vi.setSystemTime(now + day);
  await queueLeadGeo(lead);
  expect(await prisma.geoIpLookup.findUnique({ where: { ip } })).toMatchObject({ status: "PENDING", attempts: 0 });
});

it("finalizes a crashed fifth attempt instead of stranding an exhausted pending row", async () => {
  await prisma.geoIpLookup.create({ data: {
    ip, attempts: 5, nextAttemptAt: new Date(baseTime - 1),
    leaseToken: "crashed-fifth-attempt", leaseUntil: new Date(baseTime - 1)
  } });
  await processNextGeoIpLookup();
  expect(provider.lookup).not.toHaveBeenCalled();
  expect(await prisma.geoIpLookup.findUnique({ where: { ip } })).toMatchObject({
    status: "FAILED", lastError: "attempts_exhausted", expiresAt: new Date(baseTime + day), leaseToken: null
  });
});

it("stores a non-retryable failure in the negative cache immediately", async () => {
  await enqueue();
  provider.lookup.mockResolvedValueOnce({ ok: false, error: "reserved_ip", retryable: false });
  await processNextGeoIpLookup();
  expect(await prisma.geoIpLookup.findUnique({ where: { ip } })).toMatchObject({
    status: "FAILED", attempts: 1, lastError: "reserved_ip", expiresAt: new Date(baseTime + day)
  });
});

it("waits for the active lookup before worker shutdown resolves", async () => {
  await enqueue();
  const held = holdLookup();
  const stop = startGeoIpWorker();
  await held.started;
  let stopped = false;
  const stopping = stop().then(() => { stopped = true; });
  await Promise.resolve();
  expect(stopped).toBe(false);
  held.release();
  await stopping;
  expect(stopped).toBe(true);
  expect(await prisma.geoIpLookup.findUnique({ where: { ip } })).toMatchObject({ status: "SUCCESS" });
});
