import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ user: { id: "owner", role: "admin" } as { id: string; role: string } | null }));
const queries = vi.hoisted(() => ({ report: vi.fn(), process: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: async () => state.user ? { user: state.user } : null } } }));
vi.mock("@/server/dashboard/chat-intelligence", async () => {
  const { ChatIntelligenceError } = await import("@/server/dashboard/chat-intelligence-provider");
  return { getChatIntelligenceReport: queries.report, processChatIntelligenceBatch: queries.process, ChatIntelligenceError };
});
import { GET, POST } from "@/app/api/dashboard/chat-intelligence/route";
import { ChatIntelligenceError } from "@/server/dashboard/chat-intelligence-provider";

const scope = { webinarId: "selected", from: "2026-11-01T03:00:00.000Z", to: "2026-11-08T02:59:59.999Z" };
function get(value: Record<string, string> = scope) { return GET(new Request(`https://app.test/api/dashboard/chat-intelligence?${new URLSearchParams(value)}`)); }
function post(value: unknown = scope, origin: string | null = "https://app.test") {
  return POST(new Request("https://app.test/api/dashboard/chat-intelligence", { method: "POST", headers: { "content-type": "application/json", ...(origin ? { origin } : {}) }, body: JSON.stringify(value) }));
}
beforeEach(() => {
  state.user = { id: "owner", role: "admin" };
  vi.stubEnv("BETTER_AUTH_URL", "https://public.test");
  queries.report.mockReset().mockResolvedValue({ totalMessages: 10, analyzedMessages: 6 });
  queries.process.mockReset().mockResolvedValue({ processedMessages: 4, busy: false, report: { totalMessages: 10, analyzedMessages: 10 } });
});
afterEach(() => vi.unstubAllEnvs());

describe("dashboard chat intelligence API", () => {
  it("requires authenticated admins before accessing analysis", async () => {
    state.user = null;
    for (const response of [await get(), await post()]) { expect(response.status).toBe(401); expect(response.headers.get("cache-control")).toBe("private, no-store"); }
    state.user = { id: "owner", role: "attendant" };
    expect((await get()).status).toBe(403); expect((await post()).status).toBe(403);
    expect(queries.report).not.toHaveBeenCalled(); expect(queries.process).not.toHaveBeenCalled();
  });
  it.each([null, "https://attacker.test", "http://app.test", "null", "file://app.test", "https://user:pass@app.test"])("rejects unsafe POST origin %s", async (origin) => {
    expect((await post(scope, origin)).status).toBe(403); expect(queries.process).not.toHaveBeenCalled();
  });
  it("trusts the explicitly configured public origin behind a reverse proxy", async () => {
    expect((await post(scope, "https://public.test")).status).toBe(200);
  });
  it.each([
    { ...scope, webinarId: "" }, { ...scope, webinarId: "x".repeat(129) },
    { ...scope, from: "2026-11-01" }, { ...scope, to: "invalid" },
    { ...scope, from: scope.to, to: scope.from }, { webinarId: "selected", to: scope.to }
  ])("rejects malformed or unqualified date ranges", async (input) => {
    expect((await get(input)).status).toBe(400); expect((await post(input)).status).toBe(400);
    expect(queries.report).not.toHaveBeenCalled(); expect(queries.process).not.toHaveBeenCalled();
  });
  it("passes only the session owner and exact ISO range to the backend", async () => {
    const response = await get();
    expect(response.status).toBe(200); expect(await response.json()).toEqual({ totalMessages: 10, analyzedMessages: 6 });
    expect(queries.report).toHaveBeenCalledWith({ id: "owner", role: "admin" }, { webinarId: "selected", from: new Date(scope.from), to: new Date(scope.to) });
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect((await post({ ...scope, ownerId: "victim" })).status).toBe(400);
    expect(queries.process).not.toHaveBeenCalled();
  });
  it("returns batch progress/busy status and preserves cached reads without calling processing", async () => {
    queries.process.mockResolvedValue({ busy: true, processedMessages: 0, report: { isProcessing: true } });
    expect(await (await post()).json()).toEqual({ busy: true, processedMessages: 0, report: { isProcessing: true } });
    expect(queries.process).toHaveBeenCalledTimes(1);
    await get(); expect(queries.process).toHaveBeenCalledTimes(1);
  });
  it("propagates sanitized domain errors and hides unexpected provider/database details", async () => {
    queries.report.mockRejectedValueOnce(new ChatIntelligenceError("not_found", 404));
    expect((await get()).status).toBe(404);
    queries.process.mockRejectedValueOnce(new ChatIntelligenceError("provider_missing", 409));
    const missing = await post(); expect(missing.status).toBe(409); expect(await missing.json()).toEqual({ error: "provider_missing" });
    queries.process.mockRejectedValueOnce(new Error("database secret credential"));
    const error = await post(); expect(error.status).toBe(500); expect(await error.json()).toEqual({ error: "analysis_unavailable" });
    expect(error.headers.get("cache-control")).toBe("private, no-store");
  });
});
