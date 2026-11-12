import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "db";
import { leadCookieName, signLeadCookie } from "@/lib/lead-session";
import { leadScopedUrl } from "@/lib/lead-request-scope";

const cookies = new Map<string, { value: string }>();
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (key: string) => cookies.get(key) }), headers: async () => new Headers() }));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: async () => null } } }));
vi.mock("@/server/realtime/bus", () => ({ publishFunnelEvent: vi.fn(), publishChatEvent: vi.fn() }));
vi.mock("@/server/realtime/presence", () => ({ touchLegacyPresence: vi.fn(), removeLegacyPresence: vi.fn() }));
vi.mock("@/server/geoip-queue", () => ({ queueLeadGeo: vi.fn() }));
vi.mock("jobs", () => ({ enqueueDispatchWebhook: vi.fn(), JOB_DISPATCH_WEBHOOK: "dispatch-webhook" }));

const ownerId = "public-scope-owner";
let a: { webinarId: string; leadId: string }, b: { webinarId: string; leadId: string };
let videoAId: string, videoBId: string;
const request = (path: string, scope: typeof a, body?: unknown) => new Request(leadScopedUrl(`http://localhost${path}`, scope), {
  method: "POST", headers: { "content-type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) })
});

beforeEach(async () => {
  process.env.LEAD_SESSION_SECRET = "public-scope-test-secret-at-least-32";
  await prisma.webinar.deleteMany({ where: { ownerId } });
  await prisma.video.deleteMany({ where: { ownerId } });
  await prisma.user.upsert({ where: { id: ownerId }, create: { id: ownerId, email: "public-scope@example.test", name: "Scope" }, update: {} });
  cookies.clear();
  const create = async (key: string) => {
    const video = await prisma.video.create({ data: { ownerId, name: key, source: "UPLOAD", status: "READY", originalUrl: "https://example.test/source", encKey: "a".repeat(32), durationSec: 600 } });
    const webinar = await prisma.webinar.create({ data: { ownerId, name: key, title: key, slug: `public-scope-${key}`, mode: "JIT", status: "ACTIVE", videoId: video.id, pitchAtSec: 50 } });
    const lead = await prisma.lead.create({ data: { webinarId: webinar.id, name: key, email: `${key}@example.test`, lastSeenAt: new Date(Date.now() - 60000) } });
    cookies.set(leadCookieName(webinar.id), { value: signLeadCookie(lead.id) });
    return { webinarId: webinar.id, leadId: lead.id, videoId: video.id };
  };
  const left = await create("a"), right = await create("b");
  a = { webinarId: left.webinarId, leadId: left.leadId }; b = { webinarId: right.webinarId, leadId: right.leadId };
  videoAId = left.videoId; videoBId = right.videoId;
  // The second tab signed in last; the legacy/global cookie now points to B.
  cookies.set("hw_lead", { value: signLeadCookie(b.leadId) });
});
afterAll(async () => {
  await prisma.webinar.deleteMany({ where: { ownerId } });
  await prisma.video.deleteMany({ where: { ownerId } });
  await prisma.user.deleteMany({ where: { id: ownerId } });
  await prisma.$disconnect();
});

describe("public identities across webinar tabs", () => {
  it("records A playback/pitch/offer/leave in A even after the other tab replaced the global cookie with B", async () => {
    const track = await import("@/app/api/track/route"), view = await import("@/app/api/offer-view/route"), click = await import("@/app/api/offer-click/route"), leave = await import("@/app/api/track-leave/route");
    expect((await track.POST(request("/api/track", a, { videoSec: 60, watchedSecDelta: 30 }))).status).toBe(200);
    expect((await view.POST(request("/api/offer-view", a))).status).toBe(200);
    expect((await click.POST(request("/api/offer-click", a))).status).toBe(200);
    expect((await leave.POST(request("/api/track-leave", a, { videoSec: 75 }))).status).toBe(204);
    const events = await prisma.event.findMany({ where: { webinarId: { in: [a.webinarId, b.webinarId] } } });
    expect(events.map(event => event.kind).sort()).toEqual(["OFFER_CLICK", "OFFER_VIEW", "PITCH_REACHED", "VIDEO_END", "VIDEO_TICK"]);
    expect(events.every(event => event.webinarId === a.webinarId && event.leadId === a.leadId)).toBe(true);
    expect(await prisma.lead.findUnique({ where: { id: b.leadId } })).toMatchObject({ watchedSec: 0, ctaClicks: 0, pitchFired: false, leaveFired: false });
  });

  it("sends and polls A's chat without exposing or modifying B's conversation", async () => {
    await prisma.leadChatMessage.create({ data: { webinarId: b.webinarId, leadId: b.leadId, text: "Private B", sender: "team" } });
    const chat = await import("@/app/api/lead-chat/route");
    expect((await chat.POST(request("/api/lead-chat", a, { text: "Question A", videoSec: 10 }))).status).toBe(200);
    const response = await chat.GET(new Request(leadScopedUrl("http://localhost/api/lead-chat", a)));
    const body = await response.json();
    expect(body.messages.map((message: { text: string }) => message.text)).toEqual(["Question A"]);
    expect(await prisma.leadChatMessage.count({ where: { leadId: b.leadId } })).toBe(1);
  });

  it("requires the requested lead and webinar to match the signed session, never a client id alone", async () => {
    const click = await import("@/app/api/offer-click/route");
    expect((await click.POST(request("/api/offer-click", { ...a, leadId: b.leadId }))).status).toBe(401);
    cookies.set(leadCookieName(a.webinarId), { value: signLeadCookie(b.leadId) });
    expect((await click.POST(request("/api/offer-click", a))).status).toBe(401);
    cookies.delete(leadCookieName(a.webinarId));
    expect((await click.POST(request("/api/offer-click", a))).status).toBe(401);
    expect((await click.POST(new Request("http://localhost/api/offer-click", { method: "POST" }))).status).toBe(401);
    expect(await prisma.event.count({ where: { webinarId: { in: [a.webinarId, b.webinarId] } } })).toBe(0);
  });

  it("supports legacy HTTP clients only when the exact same-origin live page identifies their webinar", async () => {
    const click = await import("@/app/api/offer-click/route");
    const legacy = (referer: string) => new Request("http://localhost/api/offer-click", { method: "POST", headers: { referer } });
    expect((await click.POST(legacy("http://localhost/public-scope-a/live"))).status).toBe(200);
    expect((await click.POST(legacy("https://evil.test/public-scope-a/live"))).status).toBe(401);
    expect((await click.POST(legacy("http://localhost/dashboard"))).status).toBe(401);
    const events = await prisma.event.findMany({ where: { webinarId: { in: [a.webinarId, b.webinarId] } } });
    expect(events).toHaveLength(1); expect(events[0].leadId).toBe(a.leadId);
    cookies.delete(leadCookieName(a.webinarId));
    // Missing old A session must not fall through to B's newer global cookie.
    expect((await click.POST(legacy("http://localhost/public-scope-a/live"))).status).toBe(401);
  });

  it("preserves a valid legacy cookie only for its own webinar and never overrides an invalid scoped cookie", async () => {
    const click = await import("@/app/api/offer-click/route");
    cookies.delete(leadCookieName(a.webinarId));
    cookies.set("hw_lead", { value: signLeadCookie(a.leadId) });
    expect((await click.POST(request("/api/offer-click", a))).status).toBe(200);
    cookies.set(leadCookieName(a.webinarId), { value: "tampered.session" });
    expect((await click.POST(request("/api/offer-click", a))).status).toBe(401);
    expect(await prisma.event.count({ where: { webinarId: a.webinarId, kind: "OFFER_CLICK" } })).toBe(1);
  });

  it("keeps A's HLS key accessible and rejects a different webinar's video", async () => {
    const { GET } = await import("@/app/api/hls/key/[videoId]/route");
    const media = (id: string) => new Request(`http://localhost/api/hls/key/${id}`, { headers: { referer: "http://localhost/public-scope-a/live" } });
    const response = await GET(media(videoAId), { params: Promise.resolve({ videoId: videoAId }) });
    expect(response.status).toBe(200); expect((await response.arrayBuffer()).byteLength).toBe(16);
    expect((await GET(media(videoBId), { params: Promise.resolve({ videoId: videoBId }) })).status).toBe(403);
  });

  it("binds realtime rooms and presence to each signed tab identity, including after reconnect", async () => {
    const { authenticateRealtime, validRealtimeScope } = await import("@/server/realtime/auth");
    const header = { cookie: [...cookies].map(([name, value]) => `${name}=${value.value}`).join("; ") };
    expect(await authenticateRealtime(header, { kind: "lead", ...a })).toMatchObject({ leadId: a.leadId, webinarId: a.webinarId, rooms: [`lead:${a.leadId}`] });
    expect(await authenticateRealtime(header, { kind: "lead", ...b })).toMatchObject({ leadId: b.leadId, webinarId: b.webinarId, rooms: [`lead:${b.leadId}`] });
    expect(await authenticateRealtime(header, { kind: "lead", ...a, leadId: b.leadId })).toBeNull();
    expect(validRealtimeScope({ kind: "lead" })).toBe(false);
  });
});
