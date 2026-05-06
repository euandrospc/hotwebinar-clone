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

const TEST_USER = { id: "tl-user", email: "tl@example.com", name: "TL" };

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

describe("POST /api/track-leave", () => {
  it("fires VIDEO_END + lead_saiu webhook once", async () => {
    const w = await prisma.webinar.create({
      data: {
        ownerId: TEST_USER.id, name: "T", title: "T", slug: "tl-1",
        status: "ACTIVE", webhookUrl: "https://x", webhookOnLeave: true
      }
    });
    const lead = await prisma.lead.create({
      data: { webinarId: w.id, name: "Joe", email: "j@e.com" }
    });
    cookieGetMock.mockReturnValue({ value: signLeadCookie(lead.id) });

    const { POST } = await import("@/app/api/track-leave/route");
    const req = new Request("http://localhost/api/track-leave", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ videoSec: 1234 })
    });
    const res = await POST(req);
    expect(res.status).toBe(204);

    const after = await prisma.lead.findUnique({ where: { id: lead.id } });
    expect(after?.leaveFired).toBe(true);
    const events = await prisma.event.findMany({ where: { kind: "VIDEO_END" } });
    expect(events).toHaveLength(1);
    expect(queueAddMock).toHaveBeenCalledTimes(1);

    const req2 = new Request("http://localhost/api/track-leave", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ videoSec: 1234 })
    });
    const res2 = await POST(req2);
    expect(res2.status).toBe(204);
    expect(queueAddMock).toHaveBeenCalledTimes(1);
  });
});
