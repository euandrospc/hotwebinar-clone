import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { prisma } from "db";
import { signLeadCookie } from "@/lib/lead-session";

const cookieGetMock = vi.fn();
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: cookieGetMock })
}));

const queueAddMock = vi.fn(async () => ({ id: "j" }));
vi.mock("jobs", async () => ({
  enqueueDispatchWebhook: queueAddMock,
  JOB_DISPATCH_WEBHOOK: "dispatch-webhook"
}));

const TEST_USER = { id: "tk-user", email: "tk@example.com", name: "TK" };

beforeEach(async () => {
  process.env.LEAD_SESSION_SECRET = "test-secret-min-32-chars-aaaaaaaaaa";
  await prisma.event.deleteMany({});
  await prisma.lead.deleteMany({});
  await prisma.webinar.deleteMany({});
  await prisma.webhookDelivery.deleteMany({});
  await prisma.session.deleteMany({});
  await prisma.account.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.user.create({ data: TEST_USER });
  cookieGetMock.mockReset();
  queueAddMock.mockClear();
});

afterAll(async () => prisma.$disconnect());

async function makeWebinarWithLead(overrides: any = {}) {
  const w = await prisma.webinar.create({
    data: {
      ownerId: TEST_USER.id, name: "T", title: "T", slug: "tk-" + Math.random().toString(36).slice(2, 8),
      status: "ACTIVE", pitchAtSec: 600,
      webhookUrl: "https://x", webhookOnPitchReached: true, webhookOnPermanence: true,
      permanenceThresholdSec: 300, ...overrides
    }
  });
  const lead = await prisma.lead.create({
    data: { webinarId: w.id, name: "Joe", email: "j@e.com", lastSeenAt: new Date(Date.now() - 60_000) }
  });
  cookieGetMock.mockReturnValue({ value: signLeadCookie(lead.id) });
  return { w, lead };
}

describe("POST /api/track", () => {
  it("creates VIDEO_TICK event + updates watchedSec", async () => {
    const { lead } = await makeWebinarWithLead();
    const { POST } = await import("@/app/api/track/route");
    const req = new Request("http://localhost/api/track", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ videoSec: 30, watchedSecDelta: 30 })
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const after = await prisma.lead.findUnique({ where: { id: lead.id } });
    expect(after?.watchedSec).toBe(30);
    const events = await prisma.event.findMany({ where: { kind: "VIDEO_TICK" } });
    expect(events).toHaveLength(1);
  });

  it("rejects 429 when last tick < 25s ago", async () => {
    const { lead } = await makeWebinarWithLead();
    await prisma.lead.update({
      where: { id: lead.id },
      data: { lastSeenAt: new Date(Date.now() - 10_000) }
    });
    const { POST } = await import("@/app/api/track/route?" + Date.now());
    const req = new Request("http://localhost/api/track", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ videoSec: 30, watchedSecDelta: 30 })
    });
    const res = await POST(req);
    expect(res.status).toBe(429);
  });

  it("fires PITCH_REACHED + webhook once when crossing pitchAtSec", async () => {
    const { lead, w } = await makeWebinarWithLead();
    const { POST } = await import("@/app/api/track/route?" + (Date.now() + 1));
    const req = new Request("http://localhost/api/track", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ videoSec: 700, watchedSecDelta: 30 })
    });
    await POST(req);
    const after = await prisma.lead.findUnique({ where: { id: lead.id } });
    expect(after?.pitchFired).toBe(true);
    const pitchEvents = await prisma.event.findMany({ where: { kind: "PITCH_REACHED" } });
    expect(pitchEvents).toHaveLength(1);
    expect(queueAddMock).toHaveBeenCalled();
  });

  it("fires permanence webhook when watchedSec crosses threshold", async () => {
    const { lead } = await makeWebinarWithLead();
    await prisma.lead.update({ where: { id: lead.id }, data: { watchedSec: 290 } });
    const { POST } = await import("@/app/api/track/route?" + (Date.now() + 2));
    const req = new Request("http://localhost/api/track", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ videoSec: 30, watchedSecDelta: 30 })
    });
    await POST(req);
    const after = await prisma.lead.findUnique({ where: { id: lead.id } });
    expect(after?.permanenceFired).toBe(true);
  });

  it("returns 401 when no cookie", async () => {
    cookieGetMock.mockReturnValue(undefined);
    const { POST } = await import("@/app/api/track/route?" + (Date.now() + 3));
    const req = new Request("http://localhost/api/track", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ videoSec: 30, watchedSecDelta: 30 })
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });
});
