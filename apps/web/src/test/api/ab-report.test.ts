import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ user: { id: "owner", role: "admin" } as { id: string; role: string } | null }));
const reportQuery = vi.hoisted(() => vi.fn());
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: async () => state.user ? { user: state.user } : null } } }));
vi.mock("@/server/ab-tests/report", () => ({ getAbReport: reportQuery }));
import { GET } from "@/app/api/ab-tests/[id]/report/route";
import { AbTestError } from "@/server/ab-tests/experiments";

function request(query: Record<string, string> = {}, id = "experiment") {
  return GET(new Request(`https://app.test/api/ab-tests/${id}/report?${new URLSearchParams(query)}`), { params: Promise.resolve({ id }) });
}
beforeEach(() => { state.user = { id: "owner", role: "admin" }; reportQuery.mockReset().mockResolvedValue({ variants: [], inference: { state: "COLLECTING" } }); });

describe("A/B report API", () => {
  it("requires an authenticated admin, including on direct API access", async () => {
    state.user = null;
    expect((await request()).status).toBe(401);
    state.user = { id: "owner", role: "attendant" };
    expect((await request()).status).toBe(403);
    state.user.role = "disabled";
    expect((await request()).status).toBe(403);
    expect(reportQuery).not.toHaveBeenCalled();
  });
  it.each([{ ownerId: "victim" }, { from: "2026-11-01" }, { from: "invalid" }, { device: "bot" },
    { from: "2026-11-02T03:00:00Z", to: "2026-11-01T03:00:00Z" }, { source: "x".repeat(501) }] as Record<string, string>[])("rejects invalid or undeclared query parameters", async (query) => {
    expect((await request(query)).status).toBe(400);
    expect(reportQuery).not.toHaveBeenCalled();
  });
  it("passes only session owner and validated filters and disables caching", async () => {
    const filters = { source: "meta", device: "mobile", from: "2026-11-01T03:00:00Z", to: "2026-11-08T02:59:59.999Z" };
    const response = await request(filters);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(reportQuery).toHaveBeenCalledWith("owner", "experiment", filters);
  });
  it("preserves not-found status while hiding unexpected database details", async () => {
    reportQuery.mockRejectedValueOnce(new AbTestError("not_found", 404));
    expect((await request()).status).toBe(404);
    reportQuery.mockRejectedValueOnce(new Error("database password"));
    const response = await request();
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("password");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });
});
