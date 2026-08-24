import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { prisma } from "db";

let sessionRole: string | null = "attendant";
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: async () => (sessionRole ? { user: { id: "att-1", role: sessionRole } } : null) } }
}));

const OWNER = { id: "att-owner", email: "o@e.com", name: "O" };
let webinarId = "", leadId = "";
beforeEach(async () => {
  sessionRole = "attendant";
  for (const m of ["leadChatMessage", "lead", "webinar", "user"] as const) {
    // @ts-expect-error dynamic
    await prisma[m].deleteMany({});
  }
  await prisma.user.create({ data: OWNER });
  await prisma.user.create({ data: { id: "att-1", email: "a@e.com", name: "A", role: "attendant" } });
  const w = await prisma.webinar.create({ data: { ownerId: OWNER.id, name: "T", title: "T", slug: "at", status: "ACTIVE", teamChatName: "Suporte" } });
  webinarId = w.id;
  const lead = await prisma.lead.create({ data: { webinarId, name: "L", email: "l@e.com" } });
  leadId = lead.id;
  await prisma.leadChatMessage.create({ data: { leadId, webinarId, text: "preciso de ajuda", sender: "lead" } });
});
afterAll(async () => prisma.$disconnect());

describe("attendant reply", () => {
  it("creates a team message with authorUserId", async () => {
    const { POST } = await import("@/app/api/attendant/reply/route?" + Date.now());
    const res = await POST(new Request("http://x", { method: "POST", body: JSON.stringify({ leadId, text: "claro!" }) }));
    expect(res.status).toBe(201);
    const msg = await prisma.leadChatMessage.findFirst({ where: { sender: "team" } });
    expect(msg?.authorUserId).toBe("att-1");
    expect(msg?.webinarId).toBe(webinarId);
  });
  it("rejects when not attendant", async () => {
    sessionRole = "user";
    const { POST } = await import("@/app/api/attendant/reply/route?u" + Date.now());
    const res = await POST(new Request("http://x", { method: "POST", body: JSON.stringify({ leadId, text: "x" }) }));
    expect(res.status).toBe(403);
  });
  it("404 on unknown lead", async () => {
    const { POST } = await import("@/app/api/attendant/reply/route?n" + Date.now());
    const res = await POST(new Request("http://x", { method: "POST", body: JSON.stringify({ leadId: "nope", text: "x" }) }));
    expect(res.status).toBe(404);
  });
});

describe("attendant conversations", () => {
  it("lists leads with messages, pending true when last is lead", async () => {
    const { GET } = await import("@/app/api/attendant/conversations/route?" + Date.now());
    const res = await GET(new Request("http://x/api/attendant/conversations"));
    const json = await res.json();
    expect(json.conversations[0].leadId).toBe(leadId);
    expect(json.conversations[0].pending).toBe(true);
  });
});
