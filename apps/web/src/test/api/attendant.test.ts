import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { prisma } from "db";
import { randomUUID } from "node:crypto";

const publishChatEventMock = vi.hoisted(() => vi.fn());
vi.mock("@/server/realtime/bus", () => ({ publishChatEvent: publishChatEventMock }));

let sessionRole: string | null = "attendant";
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: async () => (sessionRole ? { user: { id: "att-1", role: sessionRole } } : null) } }
}));

const OWNER = { id: "att-owner", email: "o@e.com", name: "O" };
let webinarId = "", leadId = "";
beforeEach(async () => {
  sessionRole = "attendant";
  publishChatEventMock.mockReset().mockResolvedValue(undefined);
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
    expect(await res.json()).toMatchObject({ id: msg?.id, text: "claro!", sender: "team", teamName: "A", videoSec: null });
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

  it("retries a team send safely and preserves tagged checkout links", async () => {
    const { POST } = await import("@/app/api/attendant/reply/route");
    const body = JSON.stringify({ leadId, text: "Veja https://pay.kirvano.com/abc", clientMessageId: randomUUID() });
    const first = await POST(new Request("http://x", { method: "POST", body }));
    const retry = await POST(new Request("http://x", { method: "POST", body }));
    const firstMessage = await first.json();
    expect(first.status).toBe(201);
    expect(retry.status).toBe(200);
    expect(await retry.json()).toEqual(firstMessage);
    expect(firstMessage.text).toContain(leadId);
    expect(await prisma.leadChatMessage.count({ where: { leadId, sender: "team" } })).toBe(1);
    expect(publishChatEventMock).toHaveBeenCalledTimes(1);
  });

  it("does not allow the same client id to change the message text", async () => {
    const { POST } = await import("@/app/api/attendant/reply/route");
    const clientMessageId = randomUUID();
    const first = await POST(new Request("http://x", { method: "POST", body: JSON.stringify({ leadId, text: "Original", clientMessageId }) }));
    const changed = await POST(new Request("http://x", { method: "POST", body: JSON.stringify({ leadId, text: "Edited", clientMessageId }) }));
    expect(first.status).toBe(201);
    expect(changed.status).toBe(409);
    expect(await prisma.leadChatMessage.count({ where: { leadId, sender: "team" } })).toBe(1);
  });

  it("rejects blank text and invalid client ids", async () => {
    const { POST } = await import("@/app/api/attendant/reply/route");
    for (const input of [{ text: "   " }, { text: "Okay", clientMessageId: "bad" }]) {
      expect((await POST(new Request("http://x", { method: "POST", body: JSON.stringify({ leadId, ...input }) }))).status).toBe(400);
    }
    expect(publishChatEventMock).not.toHaveBeenCalled();
  });
});

describe("attendant thread recovery", () => {
  it("keeps simultaneous messages and restricts cursors to their thread", async () => {
    const other = await prisma.lead.create({ data: { webinarId, name: "Other", email: "other@example.test" } });
    const createdAt = new Date("2030-01-01T00:00:00Z");
    await prisma.leadChatMessage.createMany({ data: [
      { id: "thread-a", leadId, webinarId, text: "A", createdAt },
      { id: "thread-b", leadId, webinarId, text: "B", sender: "team", createdAt },
      { id: "foreign-cursor", leadId: other.id, webinarId, text: "Other", createdAt: new Date("2031-01-01T00:00:00Z") }
    ] });
    const { GET } = await import("@/app/api/attendant/thread/route");
    const sameTime = await (await GET(new Request(`http://x?leadId=${leadId}&after=thread-b`))).json();
    expect(sameTime.messages.map((m: { id: string }) => m.id)).toEqual(["thread-a", "thread-b"]);
    const foreignCursor = await (await GET(new Request(`http://x?leadId=${leadId}&after=foreign-cursor`))).json();
    expect(foreignCursor.messages).toHaveLength(3);
    expect(foreignCursor.messages.some((m: { id: string }) => m.id === "foreign-cursor")).toBe(false);
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
