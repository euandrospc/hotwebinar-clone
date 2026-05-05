import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { prisma } from "db";
import { signLeadCookie } from "@/lib/lead-session";

const cookieGetMock = vi.fn();
vi.mock("next/headers", () => ({ cookies: async () => ({ get: cookieGetMock }) }));
const queueAddMock = vi.fn(async () => ({ id: "j" }));
vi.mock("jobs", async () => ({
  getWebhookQueue: () => ({ add: queueAddMock }),
  JOB_DISPATCH_WEBHOOK: "dispatch-webhook"
}));

const TEST_USER = { id: "ot-user", email: "ot@example.com", name: "OT" };

beforeEach(async () => {
  process.env.LEAD_SESSION_SECRET = "test-secret-min-32-chars-aaaaaaaaaa";
  await prisma.event.deleteMany({});
  await prisma.lead.deleteMany({});
  await prisma.webhookDelivery.deleteMany({});
  await prisma.webinar.deleteMany({});
  await prisma.session.deleteMany({});
  await prisma.account.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.user.create({ data: TEST_USER });
  cookieGetMock.mockReset();
  queueAddMock.mockClear();
});

afterAll(async () => prisma.$disconnect());

async function setup(extras: any = {}) {
  const w = await prisma.webinar.create({
    data: {
      ownerId: TEST_USER.id, name: "T", title: "T",
      slug: "ot-" + Math.random().toString(36).slice(2, 8),
      status: "ACTIVE", webhookUrl: "https://x",
      webhookOnOfferView: true, webhookOnOfferClick: true, webhookOnRaffleEntry: true,
      ...extras
    }
  });
  const lead = await prisma.lead.create({
    data: { webinarId: w.id, name: "L", email: "l@e.com" }
  });
  cookieGetMock.mockReturnValue({ value: signLeadCookie(lead.id) });
  return { w, lead };
}

describe("POST /api/offer-view", () => {
  it("creates OFFER_VIEW once per (webinar, lead), idempotent on second call", async () => {
    await setup();
    const { POST } = await import("@/app/api/offer-view/route");
    const req = () => new Request("http://localhost/api/offer-view", { method: "POST" });
    const r1 = await POST(req()); expect(r1.status).toBe(200);
    const r2 = await POST(req()); expect(r2.status).toBe(200);
    const events = await prisma.event.findMany({ where: { kind: "OFFER_VIEW" } });
    expect(events).toHaveLength(1);
    expect(queueAddMock).toHaveBeenCalledTimes(1);
  });
});

describe("POST /api/offer-click", () => {
  it("creates OFFER_CLICK + increments ctaClicks + fires webhook", async () => {
    const { lead } = await setup();
    const { POST } = await import("@/app/api/offer-click/route");
    const res = await POST(new Request("http://localhost/api/offer-click", { method: "POST" }));
    expect(res.status).toBe(200);
    const after = await prisma.lead.findUnique({ where: { id: lead.id } });
    expect(after?.ctaClicks).toBe(1);
    const events = await prisma.event.findMany({ where: { kind: "OFFER_CLICK" } });
    expect(events).toHaveLength(1);
    expect(queueAddMock).toHaveBeenCalled();
  });
  it("also emits RAFFLE_ENTRY when offerRaffleEnabled", async () => {
    await setup({ offerRaffleEnabled: true });
    const { POST } = await import("@/app/api/offer-click/route?" + Date.now());
    await POST(new Request("http://localhost/api/offer-click", { method: "POST" }));
    const raffle = await prisma.event.findMany({ where: { kind: "RAFFLE_ENTRY" } });
    expect(raffle).toHaveLength(1);
    expect(queueAddMock).toHaveBeenCalledTimes(2); // offer_click + raffle_entry
  });
});
