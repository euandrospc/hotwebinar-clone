import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("db", () => ({
  prisma: { $queryRaw: vi.fn().mockRejectedValue(new Error("ECONNREFUSED")) }
}));

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("/api/health (degraded)", () => {
  it("returns 503 when DB is unreachable", async () => {
    const { GET } = await import("@/app/api/health/route");
    const res = await GET();
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ status: "degraded", db: "error" });
  });
});
