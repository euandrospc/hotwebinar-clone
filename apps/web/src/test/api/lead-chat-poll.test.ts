import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { prisma } from "db";
import { signLeadCookie } from "@/lib/lead-session";
vi.mock("@/server/realtime/bus", () => ({ publishChatEvent: vi.fn() }));

let leadCookie = "";
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (n: string) => (n === "hw_lead" ? { value: leadCookie } : undefined) })
}));

const USER = { id: "lc-user", email: "lc@e.com", name: "LC" };
let webinarId = "";
let leadId = "";

beforeEach(async () => {
  process.env.LEAD_SESSION_SECRET = "test-secret-min-32-chars-aaaaaaaaaa";
  for (const m of ["leadChatMessage", "lead", "webinar", "user"] as const) {
    // @ts-expect-error dynamic
    await prisma[m].deleteMany({});
  }
  await prisma.user.create({ data: USER });
  const w = await prisma.webinar.create({ data: { ownerId: USER.id, name: "T", title: "T", slug: "lc", status: "ACTIVE" } });
  webinarId = w.id;
  const lead = await prisma.lead.create({ data: { webinarId, name: "L", email: "l@e.com" } });
  leadId = lead.id;
  leadCookie = signLeadCookie(leadId);
});
afterAll(async () => prisma.$disconnect());

describe("GET /api/lead-chat", () => {
  it("returns lead+team messages with an overlapping cursor for recovery", async () => {
    const a = await prisma.leadChatMessage.create({ data: { leadId, webinarId, text: "oi", sender: "lead" } });
    const b = await prisma.leadChatMessage.create({ data: { leadId, webinarId, text: "resposta", sender: "team", authorUserId: USER.id } });
    const { GET } = await import("@/app/api/lead-chat/route?" + Date.now());
    const res = await GET(new Request(`http://x/api/lead-chat?after=${a.id}`));
    const json = await res.json();
    expect(json.messages.map((m: { id: string }) => m.id)).toEqual([a.id, b.id]);
    expect(json.messages.find((m: { id: string }) => m.id === b.id)).toMatchObject({ sender: "team", teamName: USER.name });
  });

  it("does not lose another message with the exact cursor timestamp", async () => {
    const createdAt = new Date("2026-10-30T20:00:00.000Z");
    await prisma.leadChatMessage.createMany({ data: [
      { id: "same-a", leadId, webinarId, text: "A", createdAt },
      { id: "same-b", leadId, webinarId, text: "B", createdAt },
      { id: "same-c", leadId, webinarId, text: "C", createdAt }
    ] });
    const { GET } = await import("@/app/api/lead-chat/route");
    const body = await (await GET(new Request("http://x/api/lead-chat?after=same-b"))).json();
    expect(body.messages.map((message: { id: string }) => message.id)).toEqual(["same-a", "same-b", "same-c"]);
  });

  it("never returns another lead's messages or uses their cursor to skip history", async () => {
    const other = await prisma.lead.create({ data: { webinarId, name: "Other", email: "other@example.test" } });
    const own = await prisma.leadChatMessage.create({ data: { leadId, webinarId, text: "Own", createdAt: new Date("2026-10-30T19:00:00Z") } });
    const foreign = await prisma.leadChatMessage.create({ data: { leadId: other.id, webinarId, text: "Private other", createdAt: new Date("2026-10-30T20:00:00Z") } });
    const { GET } = await import("@/app/api/lead-chat/route");
    const response = await GET(new Request(`http://x/api/lead-chat?after=${foreign.id}`));
    const body = await response.json();
    expect(body.messages.map((message: { id: string }) => message.id)).toEqual([own.id]);
    expect(JSON.stringify(body)).not.toContain("Private other");
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
});
