import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { prisma } from "db";
import { signLeadCookie } from "@/lib/lead-session";

const cookieGetMock = vi.fn();
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: cookieGetMock })
}));

const queueAddMock = vi.fn(async () => ({ id: "j" }));
vi.mock("jobs", async () => ({
  getWebhookQueue: () => ({ add: queueAddMock }),
  JOB_DISPATCH_WEBHOOK: "dispatch-webhook"
}));

const TEST_USER = { id: "ct-user", email: "ct@example.com", name: "CT" };

beforeEach(async () => {
  process.env.LEAD_SESSION_SECRET = "test-secret-min-32-chars-aaaaaaaaaa";
  await prisma.ctaView.deleteMany({});
  await prisma.event.deleteMany({});
  await prisma.cta.deleteMany({});
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

async function setup() {
  const w = await prisma.webinar.create({
    data: {
      ownerId: TEST_USER.id, name: "T", title: "T", slug: "ct-" + Math.random().toString(36).slice(2, 8),
      status: "ACTIVE", webhookUrl: "https://x",
      webhookOnCtaClick: true, webhookOnCtaView: true
    }
  });
  const lead = await prisma.lead.create({
    data: { webinarId: w.id, name: "Joe", email: "j@e.com" }
  });
  const cta = await prisma.cta.create({
    data: { webinarId: w.id, label: "Comprar", url: "https://buy.example", showAtSec: 0 }
  });
  cookieGetMock.mockReturnValue({ value: signLeadCookie(lead.id) });
  return { w, lead, cta };
}

describe("POST /api/cta-click", () => {
  it("creates CTA_CLICK event + increments ctaClicks + fires webhook", async () => {
    const { lead, cta } = await setup();
    const { POST } = await import("@/app/api/cta-click/route");
    const req = new Request("http://localhost/api/cta-click", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ ctaId: cta.id })
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const after = await prisma.lead.findUnique({ where: { id: lead.id } });
    expect(after?.ctaClicks).toBe(1);
    const events = await prisma.event.findMany({ where: { kind: "CTA_CLICK" } });
    expect(events).toHaveLength(1);
    expect(events[0].ctaId).toBe(cta.id);
    expect(queueAddMock).toHaveBeenCalled();
  });

  it("rejects when ctaId belongs to other webinar", async () => {
    const { lead } = await setup();
    await prisma.user.create({ data: { id: "other", email: "o@e.com", name: "O" } });
    const otherW = await prisma.webinar.create({
      data: { ownerId: "other", name: "X", title: "X", slug: "ct-other" }
    });
    const otherCta = await prisma.cta.create({
      data: { webinarId: otherW.id, label: "X", url: "https://x", showAtSec: 0 }
    });
    const { POST } = await import("@/app/api/cta-click/route?" + Date.now());
    const req = new Request("http://localhost/api/cta-click", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ ctaId: otherCta.id })
    });
    const res = await POST(req);
    expect(res.status).toBe(404);
  });
});

describe("POST /api/cta-view", () => {
  it("creates CTA_VIEW event once per (lead, cta), idempotent on second call", async () => {
    const { cta } = await setup();
    const { POST } = await import("@/app/api/cta-view/route");
    const make = () =>
      new Request("http://localhost/api/cta-view", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ ctaId: cta.id })
      });
    const r1 = await POST(make());
    expect(r1.status).toBe(200);
    const r2 = await POST(make());
    expect(r2.status).toBe(200);
    const events = await prisma.event.findMany({ where: { kind: "CTA_VIEW" } });
    expect(events).toHaveLength(1);
    expect(queueAddMock).toHaveBeenCalledTimes(1);
  });
});
