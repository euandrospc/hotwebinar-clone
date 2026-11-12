import { beforeEach, describe, expect, it, vi } from "vitest";

const queries = vi.hoisted(() => ({ webinars: vi.fn(), events: vi.fn(), sales: vi.fn() }));
vi.mock("db", () => ({
  prisma: {
    webinar: { findMany: queries.webinars },
    event: { groupBy: queries.events },
    sale: { findMany: queries.sales }
  }
}));

import { getDashboardOverview } from "@/server/dashboard/overview";

const start = new Date("2026-11-01T03:00:00Z");
const end = new Date("2026-11-08T02:59:59.999Z");

beforeEach(() => {
  for (const query of Object.values(queries)) query.mockReset().mockResolvedValue([]);
});

describe("dashboard overview query scope", () => {
  it("combines the selected webinar and authenticated owner in every query", async () => {
    queries.webinars.mockResolvedValue([{ id: "selected", title: "Selected webinar", name: "", status: "ACTIVE", mode: "UNICO", pitchAtSec: 60 }]);
    queries.events.mockResolvedValue([{
      webinarId: "selected", leadId: "cookie-return", kind: "VIDEO_TICK",
      _min: { createdAt: new Date("2026-11-04T15:00:00Z") }, _max: { videoSec: 120 }
    }]);
    const overview = await getDashboardOverview({ id: "owner" }, start, end, "selected");
    expect(queries.webinars).toHaveBeenCalledWith(expect.objectContaining({ where: { ownerId: "owner", id: "selected" } }));
    expect(queries.events).toHaveBeenCalledWith(expect.objectContaining({
      by: ["webinarId", "leadId", "kind"],
      where: expect.objectContaining({ webinar: { ownerId: "owner", id: "selected" }, createdAt: { gte: start, lte: end } }),
      _min: { createdAt: true }, _max: { videoSec: true }
    }));
    expect(queries.sales).toHaveBeenCalledWith(expect.objectContaining({ where: { webinar: { ownerId: "owner", id: "selected" }, createdAt: { gte: start, lte: end } } }));
    expect(overview.totals).toMatchObject({ registrations: 1, viewers: 1 });
    expect(overview.funnel[2].count).toBe(1);
  });

  it("returns no foreign webinar data and does not drop owner scope when an id is supplied", async () => {
    const overview = await getDashboardOverview({ id: "owner" }, start, end, "foreign-id");
    expect(overview.webinars).toEqual([]);
    expect(queries.events.mock.calls[0][0].where.webinar).toEqual({ ownerId: "owner", id: "foreign-id" });
    expect(queries.sales.mock.calls[0][0].where.webinar).toEqual({ ownerId: "owner", id: "foreign-id" });
  });

  it("defaults to all owned webinars and rejects missing authentication context", async () => {
    await getDashboardOverview({ id: "owner" }, start, end);
    expect(queries.webinars.mock.calls[0][0].where).toEqual({ ownerId: "owner" });
    await expect(getDashboardOverview({ id: "" }, start, end)).rejects.toThrow("Dashboard owner is required");
    expect(queries.webinars).toHaveBeenCalledTimes(1);
  });

  it("lets admins read every webinar while keeping the selected webinar filter", async () => {
    await getDashboardOverview({ id: "admin", role: "admin" }, start, end, "any-owner");
    expect(queries.webinars.mock.calls[0][0].where).toEqual({ id: "any-owner" });
    expect(queries.events.mock.calls[0][0].where.webinar).toEqual({ id: "any-owner" });
    expect(queries.sales.mock.calls[0][0].where.webinar).toEqual({ id: "any-owner" });
    await getDashboardOverview({ id: "attendant", role: "attendant" }, start, end);
    expect(queries.webinars.mock.calls[1][0].where).toEqual({ ownerId: "attendant" });
  });
});
