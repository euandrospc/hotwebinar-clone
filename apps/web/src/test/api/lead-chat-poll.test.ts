import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { prisma } from "db";
import { signLeadCookie } from "@/lib/lead-session";

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
  it("returns lead+team messages of this lead, after cursor", async () => {
    const a = await prisma.leadChatMessage.create({ data: { leadId, webinarId, text: "oi", sender: "lead" } });
    const b = await prisma.leadChatMessage.create({ data: { leadId, webinarId, text: "resposta", sender: "team", authorUserId: USER.id } });
    const { GET } = await import("@/app/api/lead-chat/route?" + Date.now());
    const res = await GET(new Request(`http://x/api/lead-chat?after=${a.id}`));
    const json = await res.json();
    expect(json.messages.map((m: any) => m.id)).toEqual([b.id]);
    expect(json.messages[0].sender).toBe("team");
  });
});
