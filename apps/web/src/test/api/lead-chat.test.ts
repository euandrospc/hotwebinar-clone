import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { prisma } from "db";
import { signLeadCookie } from "@/lib/lead-session";

const cookieGetMock = vi.fn();
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: cookieGetMock })
}));

const TEST_USER = { id: "lc-user", email: "lc@example.com", name: "LC" };

beforeEach(async () => {
  process.env.LEAD_SESSION_SECRET = "test-secret-min-32-chars-aaaaaaaaaa";
  await prisma.leadChatMessage.deleteMany({});
  await prisma.lead.deleteMany({});
  await prisma.webinar.deleteMany({});
  await prisma.session.deleteMany({});
  await prisma.account.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.user.create({ data: TEST_USER });
  cookieGetMock.mockReset();
});

afterAll(async () => prisma.$disconnect());

async function setup() {
  const w = await prisma.webinar.create({
    data: { ownerId: TEST_USER.id, name: "T", title: "T", slug: "lc-1", status: "ACTIVE" }
  });
  const lead = await prisma.lead.create({
    data: { webinarId: w.id, name: "Joe", email: "j@e.com" }
  });
  cookieGetMock.mockReturnValue({ value: signLeadCookie(lead.id) });
  return { w, lead };
}

describe("POST /api/lead-chat", () => {
  it("persists message scoped to leadId", async () => {
    const { lead } = await setup();
    const { POST } = await import("@/app/api/lead-chat/route");
    const req = new Request("http://localhost/api/lead-chat", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Olá!", videoSec: 42 })
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.id).toBeDefined();
    expect(data.text).toBe("Olá!");
    const all = await prisma.leadChatMessage.findMany({ where: { leadId: lead.id } });
    expect(all).toHaveLength(1);
    expect(all[0].videoSec).toBe(42);
  });

  it("rejects empty text 400", async () => {
    await setup();
    const { POST } = await import("@/app/api/lead-chat/route?" + Date.now());
    const req = new Request("http://localhost/api/lead-chat", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "", videoSec: 0 })
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("rejects 401 without cookie", async () => {
    cookieGetMock.mockReturnValue(undefined);
    const { POST } = await import("@/app/api/lead-chat/route?" + (Date.now() + 1));
    const req = new Request("http://localhost/api/lead-chat", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "x", videoSec: 0 })
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });
});
