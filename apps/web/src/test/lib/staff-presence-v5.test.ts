import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readStaffPresence, staffPresenceKeys, updateStaffPresence } from "@/server/realtime/staff-presence-v5";

const state = vi.hoisted(() => ({ eval: vi.fn(), zrem: vi.fn(), ready: vi.fn(), present: true }));
vi.mock("@/server/realtime/redis", () => ({
  getRedis: () => state.present ? { eval: state.eval, zrem: state.zrem } : null,
  waitForRedisReady: state.ready, realtimePrefix: () => "isolated-test",
}));
beforeEach(() => { vi.clearAllMocks(); state.present = true; state.ready.mockResolvedValue(true); state.eval.mockResolvedValue(null); state.zrem.mockResolvedValue(1); });
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe("staff lease storage", () => {
  it("uses a V5-only namespace for deployed presence", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(staffPresenceKeys()).toEqual({
      activity: "isolated-test:staff-v5:server:activity",
      observed: "isolated-test:staff-v5:server:observed",
      presenceSource: "server",
    });
  });

  it("keeps local presence separate from production and distinguishes no coverage from zero", async () => {
    expect(staffPresenceKeys().activity).toMatch(/^isolated-test:staff-v5:local:[a-f0-9]+:activity$/);
    expect(await readStaffPresence()).toBeUndefined();
    state.eval.mockResolvedValue([]);
    expect(await readStaffPresence()).toEqual({ presenceSource: "local", leases: [] });
  });

  it("reads only fresh leases and ignores malformed cached identities", async () => {
    state.eval.mockResolvedValue([JSON.stringify(["u1", "s1", "t1"]), "invalid", JSON.stringify(["u1", "s1"]) ]);
    const now = new Date("2026-11-17T18:00:00Z");
    expect((await readStaffPresence(now))?.leases).toEqual([{ userId: "u1", sessionId: "s1", tabId: "t1" }]);
    expect(state.eval.mock.calls[0].slice(-2)).toEqual([`(${now.getTime() - 90_000}`, now.getTime() - 90_000]);
  });

  it("retains a background heartbeat at 60 seconds but expires it after 90 seconds", async () => {
    const observedAt = Date.parse("2026-11-18T18:00:00Z");
    state.eval.mockImplementation(async (_script, _keyCount, _activity, _observed, _prune, cutoff) =>
      observedAt >= cutoff ? [JSON.stringify(["u1", "s1", "t1"])] : []);
    const lease = { userId: "u1", sessionId: "s1", tabId: "t1" };
    expect((await readStaffPresence(new Date(observedAt + 60_000)))?.leases).toEqual([lease]);
    expect((await readStaffPresence(new Date(observedAt + 90_000)))?.leases).toEqual([lease]);
    expect((await readStaffPresence(new Date(observedAt + 90_001)))?.leases).toEqual([]);
  });

  it("renews the 90-second lease with a 180-second cache TTL and preserves daily coverage", async () => {
    const now = Date.parse("2026-11-18T18:00:00Z");
    vi.spyOn(Date, "now").mockReturnValue(now);
    const lease = { userId: "u1", sessionId: "s1", tabId: "t1" };
    expect(await updateStaffPresence(lease, true)).toBe(true);
    const [script, ...args] = state.eval.mock.calls[0];
    expect(script).toContain("redis.call('EXPIRE', KEYS[1], 180)");
    expect(script).toContain("redis.call('SET', KEYS[2], ARGV[1], 'EX', 86400)");
    expect(args).toEqual([2, staffPresenceKeys().activity, staffPresenceKeys().observed,
      now, JSON.stringify(["u1", "s1", "t1"]), `(${now - 90_000}`]);
  });

  it("removes only the named user/session/tab lease and fails closed on Redis errors", async () => {
    const lease = { userId: "u1", sessionId: "s1", tabId: "t1" };
    expect(await updateStaffPresence(lease, false)).toBe(true);
    expect(state.zrem).toHaveBeenCalledWith(staffPresenceKeys().activity, JSON.stringify(["u1", "s1", "t1"]));
    state.eval.mockRejectedValue(new Error("unavailable"));
    expect(await updateStaffPresence(lease, true)).toBe(false);
    expect(await readStaffPresence()).toBeUndefined();
    state.ready.mockResolvedValue(false);
    expect(await updateStaffPresence(lease, true)).toBe(false);
  });
});
