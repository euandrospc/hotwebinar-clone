import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { prisma } from "db";

let sessionRole: string | null = "attendant";
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: async () => (sessionRole ? { user: { id: "att-1", role: sessionRole } } : null) } }
}));
const onlineMock = vi.hoisted(() => ({ value: { byWebinar: new Map<string, number>(), leadIds: new Set<string>() } }));
vi.mock("@/lib/online", () => ({ getOnlineSnapshot: async () => onlineMock.value }));

// 2026-11-16 in America/Sao_Paulo is [03:00Z, next day 03:00Z).
const DAY = "2026-11-16";
const AT_LIVE = new Date("2026-11-16T18:10:00Z");
const YESTERDAY = new Date("2026-11-15T18:10:00Z");
let webinarId = "", otherWebinarId = "";

async function lead(name: string, email: string, ticks: number, at = AT_LIVE, webinar = webinarId, extra: Record<string, unknown> = {}) {
  const l = await prisma.lead.create({ data: { webinarId: webinar, name, email, lastSeenAt: at, ...extra } });
  if (ticks) {
    await prisma.event.createMany({ data: Array.from({ length: ticks }, (_, i) => ({
      webinarId: webinar, leadId: l.id, kind: "VIDEO_TICK" as const, videoSec: i * 30,
      createdAt: new Date(at.getTime() + i * 30_000)
    })) });
  }
  return l;
}

async function get(query: string) {
  const { GET } = await import("@/app/api/attendant/participants-without-chat/route");
  const res = await GET(new Request(`http://x/api/attendant/participants-without-chat?${query}`));
  return { status: res.status, body: await res.json() };
}

beforeEach(async () => {
  vi.resetModules(); // fresh 5 s result cache per test
  sessionRole = "attendant";
  onlineMock.value = { byWebinar: new Map(), leadIds: new Set() };
  for (const m of ["event", "leadChatMessage", "lead", "webinar", "user"] as const) {
    // @ts-expect-error dynamic
    await prisma[m].deleteMany({});
  }
  await prisma.user.create({ data: { id: "owner", email: "o@e.com", name: "O" } });
  await prisma.user.create({ data: { id: "att-1", email: "a@e.com", name: "A", role: "attendant" } });
  webinarId = (await prisma.webinar.create({ data: { ownerId: "owner", name: "15h", title: "15h", slug: "p15", status: "ACTIVE", permanenceThresholdSec: 300 } })).id;
  otherWebinarId = (await prisma.webinar.create({ data: { ownerId: "owner", name: "20h", title: "20h", slug: "p20", status: "ACTIVE" } })).id;
});
afterAll(async () => prisma.$disconnect());

describe("GET /api/attendant/participants-without-chat", () => {
  it("lists only leads who watched the threshold in the live and never chatted", async () => {
    const ok = await lead("KARINA souza", "k@e.com", 10);
    await lead("Pouco", "p@e.com", 9);
    const chatted = await lead("Falou", "f@e.com", 12);
    await prisma.leadChatMessage.create({ data: { leadId: chatted.id, webinarId, text: "oi", sender: "lead" } });
    const teamOnly = await lead("Equipe", "t@e.com", 12);
    await prisma.leadChatMessage.create({ data: { leadId: teamOnly.id, webinarId, text: "oi", sender: "team" } });
    await lead("Encerrado", "c@e.com", 12, AT_LIVE, webinarId, { attendanceClosedAt: AT_LIVE });
    await lead("Ontem", "y@e.com", 20, YESTERDAY);
    await lead("Outra live", "k@e.com", 20, AT_LIVE, otherWebinarId);

    const { status, body } = await get(`webinarId=${webinarId}&from=${DAY}`);
    expect(status).toBe(200);
    expect(body).toMatchObject({ webinarId, minWatchedSec: 300, total: 1, page: 1, pageSize: 25 });
    expect(body.leads).toEqual([expect.objectContaining({
      leadId: ok.id, name: "KARINA souza", firstName: "Karina", email: "k@e.com", watchedSecInRange: 300, online: false
    })]);
  });

  it("counts a returning lead by today's ticks, ignoring permanenceFired from another day", async () => {
    const back = await lead("Volta", "v@e.com", 3, YESTERDAY, webinarId, { permanenceFired: true });
    await prisma.event.createMany({ data: Array.from({ length: 10 }, (_, i) => ({
      webinarId, leadId: back.id, kind: "VIDEO_TICK" as const, createdAt: new Date(AT_LIVE.getTime() + i * 30_000)
    })) });
    const { body } = await get(`webinarId=${webinarId}&from=${DAY}`);
    expect(body.leads.map((l: { leadId: string }) => l.leadId)).toEqual([back.id]);
    expect(body.leads[0].watchedSecInRange).toBe(300);
  });

  it("honours minWatchedSec, onlineOnly and pagination", async () => {
    const a = await lead("A", "a1@e.com", 2, new Date("2026-11-16T18:00:00Z"));
    const b = await lead("B", "b1@e.com", 2, new Date("2026-11-16T18:05:00Z"));
    expect((await get(`webinarId=${webinarId}&from=${DAY}`)).body.total).toBe(0);

    const all = await get(`webinarId=${webinarId}&from=${DAY}&minWatchedSec=60`);
    expect(all.body.leads.map((l: { leadId: string }) => l.leadId)).toEqual([b.id, a.id]);

    onlineMock.value = { byWebinar: new Map([[webinarId, 1]]), leadIds: new Set([a.id]) };
    const online = await get(`webinarId=${webinarId}&from=${DAY}&minWatchedSec=60&onlineOnly=1`);
    expect(online.body).toMatchObject({ total: 1, leads: [{ leadId: a.id, online: true }] });

    const past = await get(`webinarId=${webinarId}&from=${DAY}&minWatchedSec=60&page=9&pageSize=25`);
    expect(past.body).toMatchObject({ total: 2, page: 9, leads: [] });
  });

  it("hides placeholder emails and names without letters", async () => {
    await lead("12345", "x@no-email.invalid", 10);
    const { body } = await get(`webinarId=${webinarId}&from=${DAY}`);
    expect(body.leads[0]).toMatchObject({ firstName: null, email: null });
  });

  it("validates access and input", async () => {
    sessionRole = "user";
    expect((await get(`webinarId=${webinarId}`)).status).toBe(403);
    sessionRole = "attendant";
    expect((await get("")).status).toBe(400);
    expect((await get(`webinarId=${webinarId}&minWatchedSec=-1`)).status).toBe(400);
    expect((await get(`webinarId=${webinarId}&from=2026-13-01`)).body).toEqual({ error: "invalid_range" });
    expect((await get("webinarId=nope")).status).toBe(404);
  });
});
