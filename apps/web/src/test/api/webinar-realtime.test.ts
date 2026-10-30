import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma, type Prisma } from "db";

const state = vi.hoisted(() => ({ userId: "realtime-owner" as string | null }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: async () => state.userId ? { user: { id: state.userId } } : null } }
}));

const OWNER = "realtime-owner";
const OTHER = "realtime-other";
const WEBINAR = "realtime-webinar";
const SIBLING = "realtime-sibling";
const FOREIGN = "realtime-foreign";

beforeAll(() => {
  const database = new URL(process.env.DATABASE_URL!);
  expect(database.hostname).toBe("localhost");
  expect(database.port).toBe("5452");
  expect(database.pathname).toBe("/hotwebinar_test");
});

beforeEach(async () => {
  vi.resetModules();
  state.userId = OWNER;
  await prisma.user.deleteMany({ where: { id: { in: [OWNER, OTHER] } } });
  await prisma.user.createMany({ data: [
    { id: OWNER, name: "Realtime owner", email: "realtime-owner@example.test" },
    { id: OTHER, name: "Other owner", email: "realtime-other@example.test" }
  ] });
  await prisma.webinar.createMany({ data: [
    { id: WEBINAR, name: "Realtime", ownerId: OWNER },
    { id: SIBLING, name: "Sibling", ownerId: OWNER },
    { id: FOREIGN, name: "Foreign", ownerId: OTHER }
  ] });
});

afterEach(() => vi.restoreAllMocks());
afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: [OWNER, OTHER] } } });
  await prisma.$disconnect();
});

async function addLead(id: string, options: Partial<Prisma.LeadCreateManyInput> = {}, heartbeatAge?: number) {
  const lead = await prisma.lead.create({ data: {
    id,
    webinarId: WEBINAR,
    name: `Private ${id}`,
    email: `${id}@example.test`,
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    country: "BR", region: "SP", city: "São Paulo", lat: -23.55, lng: -46.63,
    ...options
  } });
  if (heartbeatAge !== undefined) await prisma.event.create({ data: {
    webinarId: lead.webinarId, leadId: lead.id, kind: "VIDEO_TICK",
    createdAt: new Date(Date.now() - heartbeatAge)
  } });
  return lead;
}

async function request(id = WEBINAR) {
  const { GET } = await import("@/app/api/webinars/[id]/realtime/route");
  return GET(new Request(`http://localhost/api/webinars/${id}/realtime`), { params: Promise.resolve({ id }) });
}

describe("GET /api/webinars/[id]/realtime", () => {
  it("requires authentication and never caches the response", async () => {
    state.userId = null;
    const response = await request();
    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("returns 404 for another owner's webinar and unknown webinars", async () => {
    expect((await request(FOREIGN)).status).toBe(404);
    expect((await request("missing-webinar")).status).toBe(404);
  });

  it("returns only this webinar's active players and aggregates without exposing viewer PII", async () => {
    await addLead("realtime-desktop", {}, 5_000);
    await addLead("realtime-mobile", { userAgent: "iPhone Mobile" }, 10_000);
    await addLead("realtime-tablet", { userAgent: "iPad Mobile", lat: null, lng: null }, 4_000);
    await addLead("realtime-waiting");
    await addLead("realtime-expired", {}, 46_000);
    await addLead("realtime-left", { leaveFired: true }, 5_000);
    await addLead("realtime-sibling-viewer", { webinarId: SIBLING }, 5_000);
    await addLead("realtime-foreign-viewer", { webinarId: FOREIGN }, 5_000);

    const response = await request();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    const body = await response.json();
    expect(body.online).toBe(3);
    expect(body.devices).toEqual({ desktop: 1, mobile: 1, tablet: 1, unknown: 0 });
    expect(body.located).toBe(2);
    expect(body.unlocated).toBe(1);
    expect(body.locations).toHaveLength(1);
    expect(body.locations[0].count).toBe(2);
    expect(body.topCountries).toEqual([{ code: "BR", count: 3 }]);
    expect(JSON.stringify(body)).not.toMatch(/example\.test|Private |realtime-desktop/);
  });

  it("drops expired heartbeats on refresh rather than accumulating viewers", async () => {
    await addLead("realtime-expiring", {}, 2_000);
    expect((await (await request()).json()).online).toBe(1);
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 60_000);
    expect((await (await request()).json()).online).toBe(0);
  });

  it("returns empty panels when no one is watching", async () => {
    const body = await (await request()).json();
    expect(body).toMatchObject({ online: 0, located: 0, unlocated: 0, locations: [], topCities: [], topCountries: [] });
  });
});
