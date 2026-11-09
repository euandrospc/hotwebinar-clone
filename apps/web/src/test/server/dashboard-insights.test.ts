import { beforeEach, describe, expect, it, vi } from "vitest";

const queries = vi.hoisted(() => ({ webinars: vi.fn(), leads: vi.fn(), events: vi.fn(), messages: vi.fn(), sales: vi.fn() }));
vi.mock("db", () => ({ prisma: {
  webinar: { findMany: queries.webinars }, lead: { findMany: queries.leads },
  event: { groupBy: queries.events }, leadChatMessage: { findMany: queries.messages }, sale: { findMany: queries.sales }
} }));

import { getDashboardInsights } from "@/server/dashboard/insights";

const start = new Date("2026-11-01T03:00:00.000Z");
const end = new Date("2026-11-08T02:59:59.999Z");

beforeEach(() => {
  for (const query of Object.values(queries)) query.mockReset().mockResolvedValue([]);
});

describe("dashboard insights query scope", () => {
  it("enforces owner and webinar on every query, selecting the cohort by recorded events", async () => {
    queries.webinars.mockResolvedValue([{ id: "selected", pitchAtSec: 300, video: { durationSec: 600 } }]);
    queries.leads.mockResolvedValue([{ id: "returning", webinarId: "selected", watchedSec: 1800, country: "BR", region: "SP" }]);
    queries.events.mockResolvedValue([{ webinarId: "selected", leadId: "returning", _max: { videoSec: 400 } }]);
    const result = await getDashboardInsights("owner", start, end, "selected");
    const scope = { ownerId: "owner", id: "selected" };
    expect(queries.webinars.mock.calls[0][0].where).toEqual(scope);
    for (const name of ["leads", "events", "messages", "sales"] as const) {
      expect(queries[name].mock.calls[0][0].where.webinar).toEqual(scope);
    }
    expect(queries.leads.mock.calls[0][0].where).toEqual({
      webinar: scope,
      events: { some: { webinar: scope, kind: { in: ["OPTIN", "VIDEO_TICK", "PITCH_REACHED", "OFFER_CLICK"] }, createdAt: { gte: start, lte: end } } }
    });
    expect(queries.events.mock.calls[0][0]).toEqual({
      by: ["webinarId", "leadId"],
      where: { webinar: scope, kind: "VIDEO_TICK", leadId: { not: null }, createdAt: { gte: start, lte: end } },
      _max: { videoSec: true }
    });
    expect(queries.messages.mock.calls[0][0].orderBy).toEqual([{ createdAt: "asc" }, { id: "asc" }]);
    expect(queries.messages.mock.calls[0][0].where.createdAt).toEqual({ gte: start, lte: end });
    expect(queries.sales.mock.calls[0][0].where.createdAt).toEqual({ gte: new Date("2026-10-25T03:00:00.000Z"), lte: end });
    expect(result.watch).toMatchObject({ viewerCount: 1, averageWatchedSeconds: 1800, pitchAtSeconds: 300 });
    expect(result.geography.totalAccesses).toBe(1);
  });

  it("does not broaden foreign or empty selections and defaults to all owned webinars only when omitted", async () => {
    const result = await getDashboardInsights("owner", start, end, "foreign");
    expect(result.geography.totalAccesses).toBe(0);
    expect(queries.webinars.mock.calls[0][0].where).toEqual({ ownerId: "owner", id: "foreign" });
    await getDashboardInsights("owner", start, end, "");
    expect(queries.webinars.mock.calls[1][0].where).toEqual({ ownerId: "owner", id: "" });
    await getDashboardInsights("owner", start, end);
    expect(queries.webinars.mock.calls[2][0].where).toEqual({ ownerId: "owner" });
  });

  it("rejects missing owner and invalid ranges before issuing queries", async () => {
    await expect(getDashboardInsights("", start, end)).rejects.toThrow("Dashboard owner is required");
    await expect(getDashboardInsights("owner", end, start)).rejects.toThrow(RangeError);
    await expect(getDashboardInsights("owner", new Date("invalid"), end)).rejects.toThrow(RangeError);
    for (const query of Object.values(queries)) expect(query).not.toHaveBeenCalled();
  });
});
