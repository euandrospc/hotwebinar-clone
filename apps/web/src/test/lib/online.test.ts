import { describe, it, expect, vi } from "vitest";

const findMany = vi.fn(async () => [
  { id: "a", webinarId: "w1" },
  { id: "b", webinarId: "w1" },
  { id: "c", webinarId: "w2" }
]);
vi.mock("db", () => ({ prisma: { lead: { findMany } } }));

describe("getOnlineSnapshot", () => {
  it("counts per webinar and reuses one query within the refresh window", async () => {
    const { getOnlineSnapshot } = await import("@/lib/online");
    const s1 = await getOnlineSnapshot();
    const s2 = await getOnlineSnapshot();
    expect(s1.byWebinar.get("w1")).toBe(2);
    expect(s1.byWebinar.get("w2")).toBe(1);
    expect(s1.leadIds.has("c")).toBe(true);
    expect(s2).toBe(s1);
    expect(findMany).toHaveBeenCalledTimes(1);
  });
});
