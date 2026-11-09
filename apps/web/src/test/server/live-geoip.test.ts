import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "db";
import { signLeadCookie } from "@/lib/lead-session";

const cookieGetMock = vi.fn();
const fetchMock = vi.fn().mockRejectedValue(new Error("Unexpected external request while rendering the player"));
let requestHeaders = new Headers();

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: cookieGetMock }),
  headers: async () => requestHeaders
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => { throw new Error(`__redirect:${url}`); },
  notFound: () => { throw new Error("__not_found"); }
}));
vi.mock("jobs", () => ({ enqueueDispatchWebhook: vi.fn(async () => ({ id: "unused" })) }));
// Keep the server page/authorization/queue real; the client player is not mounted.
vi.mock("@/app/[slug]/_components/player-shell", () => ({ PlayerShell: "mock-player" }));
vi.mock("@/app/[slug]/_components/countdown-view", () => ({ CountdownView: "mock-countdown" }));
vi.mock("@/app/[slug]/_components/closed-view", () => ({ ClosedView: "mock-closed" }));

const USER = { id: "live-geo-user", email: "live-geo@example.com", name: "Live geo" };

beforeEach(async () => {
  process.env.LEAD_SESSION_SECRET = "test-secret-min-32-chars-aaaaaaaaaa";
  cookieGetMock.mockReset();
  requestHeaders = new Headers({ "x-forwarded-for": "8.8.8.8, 10.0.0.2" });
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
  await prisma.geoIpLookup.deleteMany({});
  await prisma.geoIpProviderState.deleteMany({});
  await prisma.webhookDelivery.deleteMany({});
  await prisma.event.deleteMany({});
  await prisma.lead.deleteMany({});
  await prisma.webinar.deleteMany({});
  await prisma.session.deleteMany({});
  await prisma.account.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.user.create({ data: USER });
});

afterEach(() => {
  expect(fetchMock).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
});
afterAll(async () => prisma.$disconnect());

async function makeViewer(slug = "live-geo") {
  const webinar = await prisma.webinar.create({
    data: { ownerId: USER.id, name: "Geo live", title: "Geo live", slug, status: "ACTIVE", mode: "JIT" }
  });
  const lead = await prisma.lead.create({
    data: { webinarId: webinar.id, name: "Viewer", email: "viewer@example.com", ip: "unknown" }
  });
  cookieGetMock.mockReturnValue({ value: signLeadCookie(lead.id) });
  return { webinar, lead };
}

describe("live page geolocation recovery", () => {
  it("renders the authenticated player and queues an unresolved returning viewer without a provider request", async () => {
    const { lead } = await makeViewer();
    const { default: LivePage } = await import("@/app/[slug]/live/page");
    const result = await LivePage({ params: Promise.resolve({ slug: "live-geo" }) });
    expect(result).toMatchObject({ type: "mock-player", props: { lead: { id: lead.id } } });
    expect(await prisma.lead.findUnique({ where: { id: lead.id } }))
      .toMatchObject({ ip: "8.8.8.8", lat: null, lng: null });
    expect(await prisma.geoIpLookup.findUnique({ where: { ip: "8.8.8.8" } }))
      .toMatchObject({ status: "PENDING", attempts: 0 });
  });

  it("keeps an existing valid location and skips the queue on a return visit", async () => {
    const { lead } = await makeViewer();
    await prisma.lead.update({
      where: { id: lead.id },
      data: { ip: "1.1.1.1", lat: -23.5, lng: -46.6, city: "São Paulo", country: "BR" }
    });
    const { default: LivePage } = await import("@/app/[slug]/live/page");
    expect(await LivePage({ params: Promise.resolve({ slug: "live-geo" }) }))
      .toMatchObject({ type: "mock-player" });
    expect(await prisma.lead.findUnique({ where: { id: lead.id } }))
      .toMatchObject({ ip: "1.1.1.1", lat: -23.5, lng: -46.6, city: "São Paulo", country: "BR" });
    expect(await prisma.geoIpLookup.count()).toBe(0);
  });

  it.each([undefined, "invalid-cookie"])("does not enqueue a viewer without a valid session (%s)", async cookie => {
    await makeViewer();
    cookieGetMock.mockReturnValue(cookie ? { value: cookie } : undefined);
    const { default: LivePage } = await import("@/app/[slug]/live/page");
    await expect(LivePage({ params: Promise.resolve({ slug: "live-geo" }) }))
      .rejects.toThrow("__redirect:/live-geo");
    expect(await prisma.geoIpLookup.count()).toBe(0);
  });

  it("does not change or enqueue a lead whose cookie belongs to another webinar", async () => {
    await makeViewer("live-geo");
    const { lead } = await makeViewer("other-webinar");
    const { default: LivePage } = await import("@/app/[slug]/live/page");
    await expect(LivePage({ params: Promise.resolve({ slug: "live-geo" }) }))
      .rejects.toThrow("__redirect:/live-geo");
    expect(await prisma.lead.findUnique({ where: { id: lead.id } })).toMatchObject({ ip: "unknown" });
    expect(await prisma.geoIpLookup.count()).toBe(0);
  });
});
