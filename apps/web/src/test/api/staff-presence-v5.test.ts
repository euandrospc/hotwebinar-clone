import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/attendant/presence-v5/route";

const state = vi.hoisted(() => ({ auth: vi.fn(), session: vi.fn(), update: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: state.auth } } }));
vi.mock("db", () => ({ prisma: { session: { findFirst: state.session } } }));
vi.mock("@/server/realtime/staff-presence-v5", () => ({ updateStaffPresence: state.update }));
const tabId = "430535fe-8c0b-4c6b-a039-e98da1c03e71";
const request = (body: unknown = { tabId, active: true }, origin = "http://localhost:3010") => new Request("http://localhost:3010/api/attendant/presence-v5", {
  method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body),
});
beforeEach(() => {
  vi.clearAllMocks();
  state.auth.mockResolvedValue({ user: { id: "u1", role: "admin" }, session: { id: "s1" } });
  state.session.mockResolvedValue({ id: "s1", userId: "u1" });
  state.update.mockResolvedValue(true);
});

describe("authenticated staff heartbeat", () => {
  it("derives identity from the valid database session, including release", async () => {
    expect((await POST(request())).status).toBe(200);
    expect(state.update).toHaveBeenCalledWith({ userId: "u1", sessionId: "s1", tabId }, true);
    expect(state.session.mock.calls[0][0].where).toMatchObject({ id: "s1", userId: "u1", user: { role: { in: ["admin", "attendant"] } } });
    expect((await POST(request({ tabId, active: false }))).status).toBe(200);
    expect(state.update).toHaveBeenLastCalledWith({ userId: "u1", sessionId: "s1", tabId }, false);
  });

  it("rejects cross-origin requests and identity injection", async () => {
    expect((await POST(request(undefined, "https://untrusted.example"))).status).toBe(403);
    expect(state.auth).not.toHaveBeenCalled();
    expect((await POST(request({ tabId, active: true, userId: "someone-else" }))).status).toBe(400);
    expect(state.update).not.toHaveBeenCalled();
  });

  it("rejects missing, revoked or role-disabled sessions even if the cookie said admin", async () => {
    state.auth.mockResolvedValueOnce(null);
    expect((await POST(request())).status).toBe(401);
    state.session.mockResolvedValueOnce(null);
    expect((await POST(request())).status).toBe(403);
    expect(state.update).not.toHaveBeenCalled();
  });

  it("reports unavailable storage rather than claiming a heartbeat succeeded", async () => {
    state.update.mockResolvedValue(false);
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ available: false });
  });
});
