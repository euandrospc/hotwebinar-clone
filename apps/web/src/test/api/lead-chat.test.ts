import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { prisma } from "db";
import { signLeadCookie } from "@/lib/lead-session";
import { randomUUID } from "node:crypto";

const publishChatEventMock = vi.hoisted(() => vi.fn());
vi.mock("@/server/realtime/bus", () => ({ publishChatEvent: publishChatEventMock }));

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
  publishChatEventMock.mockReset().mockResolvedValue(undefined);
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
    expect(data.sender).toBe("lead");
    expect(data.teamName).toBeNull();
    const all = await prisma.leadChatMessage.findMany({ where: { leadId: lead.id } });
    expect(all).toHaveLength(1);
    expect(all[0].videoSec).toBe(42);
  });

  it("publishes the complete message only after it is persisted", async () => {
    const { lead, w } = await setup();
    let persistedAtPublication = false;
    publishChatEventMock.mockImplementation(async (event) => {
      persistedAtPublication = Boolean(await prisma.leadChatMessage.findUnique({ where: { id: event.message.id } }));
    });
    const { POST } = await import("@/app/api/lead-chat/route");
    const clientMessageId = randomUUID();
    const response = await POST(new Request("http://localhost/api/lead-chat", {
      method: "POST", body: JSON.stringify({ text: "Persistida", videoSec: 10, clientMessageId })
    }));
    const message = await response.json();
    expect(publishChatEventMock).toHaveBeenCalledWith({ leadId: lead.id, webinarId: w.id, message });
    expect(persistedAtPublication).toBe(true);
    expect(message.clientMessageId).toBe(clientMessageId);
    expect(message.createdAt).toEqual(expect.any(String));
  });

  it("returns the same persisted message on retry without duplicates", async () => {
    const { lead } = await setup();
    const { POST } = await import("@/app/api/lead-chat/route");
    const body = JSON.stringify({ text: "Uma intenção", videoSec: 42, clientMessageId: randomUUID() });
    const first = await POST(new Request("http://localhost/api/lead-chat", { method: "POST", body }));
    const retry = await POST(new Request("http://localhost/api/lead-chat", { method: "POST", body }));
    expect(await retry.json()).toEqual(await first.json());
    expect(await prisma.leadChatMessage.count({ where: { leadId: lead.id } })).toBe(1);
    expect(publishChatEventMock).toHaveBeenCalledTimes(1);
  });

  it("deduplicates concurrent retries using the database constraint", async () => {
    const { lead } = await setup();
    const { POST } = await import("@/app/api/lead-chat/route");
    const body = JSON.stringify({ text: "Concorrente", clientMessageId: randomUUID() });
    const responses = await Promise.all([0, 1].map(() => POST(new Request("http://localhost/api/lead-chat", { method: "POST", body }))));
    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    const messages = await Promise.all(responses.map((response) => response.json()));
    expect(messages[0].id).toBe(messages[1].id);
    expect(await prisma.leadChatMessage.count({ where: { leadId: lead.id } })).toBe(1);
    expect(publishChatEventMock).toHaveBeenCalledTimes(1);
  });

  it("keeps different sends with identical text as separate messages", async () => {
    const { lead } = await setup();
    const { POST } = await import("@/app/api/lead-chat/route");
    for (const clientMessageId of [randomUUID(), randomUUID()]) {
      expect((await POST(new Request("http://localhost/api/lead-chat", {
        method: "POST", body: JSON.stringify({ text: "Oi", clientMessageId })
      }))).status).toBe(200);
    }
    expect(await prisma.leadChatMessage.count({ where: { leadId: lead.id } })).toBe(2);
  });

  it("does not expose a team message by reusing its client id", async () => {
    const { lead, w } = await setup();
    const clientMessageId = randomUUID();
    await prisma.leadChatMessage.create({ data: {
      leadId: lead.id, webinarId: w.id, sender: "team", authorUserId: TEST_USER.id,
      text: "Equipe", clientMessageId
    } });
    const { POST } = await import("@/app/api/lead-chat/route");
    const response = await POST(new Request("http://localhost/api/lead-chat", {
      method: "POST", body: JSON.stringify({ text: "Equipe", clientMessageId })
    }));
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "client_message_id_conflict" });
    expect(publishChatEventMock).not.toHaveBeenCalled();
  });

  it("keeps the write successful when realtime delivery fails", async () => {
    const { lead } = await setup();
    publishChatEventMock.mockRejectedValueOnce(new Error("Redis unavailable"));
    const { POST } = await import("@/app/api/lead-chat/route");
    const response = await POST(new Request("http://localhost/api/lead-chat", {
      method: "POST", body: JSON.stringify({ text: "Histórico durável", clientMessageId: randomUUID() })
    }));
    expect(response.status).toBe(200);
    expect(await prisma.leadChatMessage.count({ where: { leadId: lead.id } })).toBe(1);
  });

  it("rejects whitespace-only messages", async () => {
    await setup();
    const { POST } = await import("@/app/api/lead-chat/route");
    const response = await POST(new Request("http://localhost/api/lead-chat", {
      method: "POST", body: JSON.stringify({ text: " \n\t " })
    }));
    expect(response.status).toBe(400);
    expect(publishChatEventMock).not.toHaveBeenCalled();
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
