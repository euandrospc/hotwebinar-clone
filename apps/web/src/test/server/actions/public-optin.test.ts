import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { prisma } from "db";

const cookieStore = new Map<string, { value: string; options?: any }>();
const setCookieMock = vi.fn((name: string, value: string, options?: any) => {
  cookieStore.set(name, { value, options });
});
const getCookieMock = vi.fn((name: string) => cookieStore.get(name));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: getCookieMock,
    set: setCookieMock
  }),
  headers: async () =>
    new Headers({
      "x-forwarded-for": "1.2.3.4",
      "user-agent": "TestAgent/1.0"
    })
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const queueAddMock = vi.fn(async () => ({ id: "j1" }));
vi.mock("jobs", async () => ({
  getWebhookQueue: () => ({ add: queueAddMock }),
  JOB_DISPATCH_WEBHOOK: "dispatch-webhook"
}));

const redirectMock = vi.fn((url: string) => {
  throw new Error(`__redirect:${url}`);
});
vi.mock("next/navigation", () => ({ redirect: redirectMock }));

const enrichLeadGeoMock = vi.fn(async (..._args: unknown[]) => undefined);
vi.mock("@/lib/geoip", () => ({
  enrichLeadGeo: (...args: unknown[]) => enrichLeadGeoMock(...args)
}));

const TEST_USER = { id: "po-user", email: "po@example.com", name: "PO" };

beforeEach(async () => {
  process.env.LEAD_SESSION_SECRET = "test-secret-min-32-chars-aaaaaaaaaa";
  cookieStore.clear();
  setCookieMock.mockClear();
  redirectMock.mockClear();
  queueAddMock.mockClear();
  enrichLeadGeoMock.mockClear();
  await prisma.webhookDelivery.deleteMany({});
  await prisma.event.deleteMany({});
  await prisma.lead.deleteMany({});
  await prisma.webinar.deleteMany({});
  await prisma.session.deleteMany({});
  await prisma.account.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.user.create({ data: TEST_USER });
});

afterAll(async () => prisma.$disconnect());

async function makeWebinar(overrides: any = {}) {
  return prisma.webinar.create({
    data: {
      ownerId: TEST_USER.id, name: "T", title: "T",
      slug: overrides.slug ?? "po-" + Math.random().toString(36).slice(2, 8),
      status: "ACTIVE",
      ...overrides
    }
  });
}

describe("submitOptin", () => {
  it("creates new lead, sets cookie, redirects to /<slug>/live", async () => {
    const w = await makeWebinar({ slug: "demo-1", webhookUrl: "https://x", webhookOnOptin: true });
    const { submitOptin } = await import("@/server/actions/public");

    const fd = new FormData();
    fd.set("name", "Joe");
    fd.set("email", "joe@example.com");
    fd.set("phone", "+5511999990000");

    await expect(submitOptin("demo-1", fd)).rejects.toThrow(/__redirect:\/demo-1\/live/);

    const lead = await prisma.lead.findFirst({ where: { email: "joe@example.com" } });
    expect(lead).not.toBeNull();
    expect(lead?.name).toBe("Joe");
    expect(lead?.webinarId).toBe(w.id);
    expect(setCookieMock).toHaveBeenCalledWith(
      "hw_lead",
      expect.stringMatching(/^[a-f0-9]{32}\./),
      expect.objectContaining({ httpOnly: true, sameSite: "lax", path: "/" })
    );
    const events = await prisma.event.findMany({ where: { kind: "OPTIN" } });
    expect(events).toHaveLength(1);
    expect(await prisma.webhookDelivery.count()).toBe(1);
  });

  it("reuses existing lead by email and updates lastSeenAt", async () => {
    const w = await makeWebinar({ slug: "demo-2" });
    const orig = await prisma.lead.create({
      data: {
        webinarId: w.id, name: "Old Name", email: "joe@example.com",
        sessionStart: new Date("2026-05-01T00:00:00Z"),
        lastSeenAt: new Date("2026-05-01T00:00:00Z")
      }
    });
    const { submitOptin } = await import("@/server/actions/public?" + Date.now());

    const fd = new FormData();
    fd.set("name", "New Name");
    fd.set("email", "joe@example.com");
    fd.set("phone", "+5511999990000");

    await expect(submitOptin("demo-2", fd)).rejects.toThrow(/__redirect/);

    const after = await prisma.lead.findUnique({ where: { id: orig.id } });
    expect(after?.name).toBe("New Name");
    expect(after?.lastSeenAt.getTime()).toBeGreaterThan(orig.lastSeenAt.getTime());
    expect(await prisma.lead.count()).toBe(1);
  });

  it("persists UTM fields from FormData on the Lead row", async () => {
    await makeWebinar({ slug: "demo-utm" });
    const { submitOptin } = await import("@/server/actions/public?" + (Date.now() + 5));
    const fd = new FormData();
    fd.set("name", "U"); fd.set("email", "u@e.com"); fd.set("phone", "+5511999990000");
    fd.set("utm_source", "fb");
    fd.set("utm_medium", "cpc");
    fd.set("utm_campaign", "launch");
    await expect(submitOptin("demo-utm", fd)).rejects.toThrow(/__redirect/);
    const lead = await prisma.lead.findFirst({ where: { email: "u@e.com" } });
    expect(lead?.utmSource).toBe("fb");
    expect(lead?.utmMedium).toBe("cpc");
    expect(lead?.utmCampaign).toBe("launch");
    expect(lead?.utmTerm).toBeNull();
    expect(lead?.utmContent).toBeNull();
  });

  it("invokes enrichLeadGeo with lead.id + ip after persisting", async () => {
    await makeWebinar({ slug: "demo-geo" });
    const { submitOptin } = await import("@/server/actions/public?" + (Date.now() + 9));
    const fd = new FormData();
    fd.set("name", "G"); fd.set("email", "g@e.com"); fd.set("phone", "+5511999990000");
    await expect(submitOptin("demo-geo", fd)).rejects.toThrow(/__redirect/);
    const lead = await prisma.lead.findFirst({ where: { email: "g@e.com" } });
    expect(enrichLeadGeoMock).toHaveBeenCalledWith(lead!.id, "1.2.3.4");
  });

  it("returns error when slug not found", async () => {
    const { submitOptin } = await import("@/server/actions/public?" + (Date.now() + 1));
    const fd = new FormData();
    fd.set("name", "Joe"); fd.set("email", "j@e.com"); fd.set("phone", "+5511999990000");
    const r = await submitOptin("nonexistent", fd);
    expect(r).toMatchObject({ error: { message: expect.any(String) } });
  });

  it("returns error when required field missing per webinar flags", async () => {
    await makeWebinar({ slug: "demo-3", phoneRequired: true });
    const { submitOptin } = await import("@/server/actions/public?" + (Date.now() + 2));
    const fd = new FormData();
    fd.set("name", "Joe"); fd.set("email", "j@e.com");
    const r = await submitOptin("demo-3", fd);
    expect(r).toMatchObject({ error: { field: "phone" } });
  });
});
