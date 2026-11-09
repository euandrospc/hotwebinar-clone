import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ userId: "owner" as string | null }));
const queries = vi.hoisted(() => ({ owner: vi.fn(), webinars: vi.fn(), samples: vi.fn(), snapshot: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: async () => state.userId ? { user: { id: state.userId } } : null } } }));
vi.mock("db", () => ({ prisma: {
  webinar: { findFirst: queries.owner, findMany: queries.webinars },
  audienceSample: { findMany: queries.samples }
} }));
vi.mock("@/lib/online", () => ({ getOnlineSnapshot: queries.snapshot }));

import { GET } from "@/app/api/dashboard/online/route";

const now = new Date("2026-11-05T18:00:00.000Z");
const from = new Date("2026-11-05T17:00:00.000Z");
function request(webinarId?: string) {
  const url = new URL("http://localhost/api/dashboard/online");
  if (webinarId !== undefined) url.searchParams.set("webinarId", webinarId);
  return GET(new Request(url));
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(now);
  state.userId = "owner";
  for (const query of Object.values(queries)) query.mockReset();
  queries.owner.mockResolvedValue({ id: "selected" });
  queries.webinars.mockResolvedValue([
    { id: "selected", title: "Selected", name: null },
    { id: "sibling", title: null, name: "Sibling" }
  ]);
  queries.samples.mockResolvedValue([]);
  queries.snapshot.mockResolvedValue({
    byWebinar: new Map([["selected", 12], ["sibling", 18], ["foreign", 300]]), leadIds: new Set()
  });
});
afterEach(() => vi.useRealTimers());

describe("GET /api/dashboard/online", () => {
  it("requires authentication before reading presence or history", async () => {
    state.userId = null;
    const response = await request("selected");
    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toContain("no-store");
    for (const query of Object.values(queries)) expect(query).not.toHaveBeenCalled();
  });

  it.each(["foreign", "missing"])("rejects %s webinars before reading history or presence", async (id) => {
    queries.owner.mockResolvedValue(null);
    const response = await request(id);
    expect(response.status).toBe(404);
    expect(queries.owner).toHaveBeenCalledWith({ where: { id, ownerId: "owner" }, select: { id: true } });
    expect(queries.samples).not.toHaveBeenCalled();
    expect(queries.snapshot).not.toHaveBeenCalled();
  });

  it("keeps the owner-wide legacy response without manufacturing combined history", async () => {
    const response = await request();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual({
      online: 30,
      byWebinar: [
        { webinarId: "sibling", title: "Sibling", online: 18 },
        { webinarId: "selected", title: "Selected", online: 12 }
      ],
      audience: { windowMinutes: 60, from: from.toISOString(), to: now.toISOString(), average: null, peak: null, sampleCount: 0, points: [] }
    });
    expect(queries.webinars).toHaveBeenCalledWith({
      where: { id: { in: ["selected", "sibling", "foreign"] }, ownerId: "owner" },
      select: { id: true, title: true, name: true }
    });
    expect(queries.owner).not.toHaveBeenCalled();
    expect(queries.samples).not.toHaveBeenCalled();
  });

  it("does not turn missing historical observations into zero or append current presence", async () => {
    const body = await (await request("selected")).json();
    expect(body.online).toBe(30);
    expect(body.audience).toMatchObject({ average: null, peak: null, sampleCount: 0, points: [] });
  });

  it("uses the same ordered observations for the curve, average and peak within the rolling hour", async () => {
    const middle = new Date("2026-11-05T17:25:00.000Z");
    queries.samples.mockResolvedValue([
      { observedAt: from, online: 0 },
      { observedAt: middle, online: 6 },
      { observedAt: now, online: 3 }
    ]);
    const body = await (await request("selected")).json();
    expect(queries.samples).toHaveBeenCalledWith({
      where: { webinarId: "selected", webinar: { ownerId: "owner" }, observedAt: { gte: from, lte: now } },
      orderBy: [{ observedAt: "asc" }, { sampledAt: "asc" }],
      select: { observedAt: true, online: true }
    });
    expect(body.audience).toEqual({
      windowMinutes: 60, from: from.toISOString(), to: now.toISOString(), average: 3, peak: 6, sampleCount: 3,
      points: [{ at: from.toISOString(), online: 0 }, { at: middle.toISOString(), online: 6 }, { at: now.toISOString(), online: 3 }]
    });
    expect(body.online).toBe(30); // Current presence remains separate and owner-wide.
  });

  it("distinguishes an observed zero audience from an absent measurement", async () => {
    queries.samples.mockResolvedValue([{ observedAt: now, online: 0 }]);
    expect((await (await request("selected")).json()).audience).toMatchObject({ average: 0, peak: 0, sampleCount: 1, points: [{ at: now.toISOString(), online: 0 }] });
  });

  it.each(["samples", "snapshot"] as const)("returns an error instead of zero when %s fails", async (source) => {
    queries[source].mockRejectedValue(new Error("Unavailable"));
    const response = await request("selected");
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Unable to load audience" });
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
});
