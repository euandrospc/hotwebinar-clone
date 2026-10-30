import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { closeRedis, getRedis, realtimePrefix } from "@/server/realtime/redis";
import { presenceKeys, prunePresence, readPresenceSnapshot, removeLegacyPresence, removePresence, touchLegacyPresence, touchPresence } from "@/server/realtime/presence";

const notify = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("@/server/realtime/bus", () => ({ publishPresenceEvent: notify }));

// Run with REALTIME_REDIS_TEST_URL=redis://127.0.0.1:6382. Uses an isolated prefix.
describe.skipIf(!process.env.REALTIME_REDIS_TEST_URL)("Redis realtime presence", () => {
  beforeAll(async () => {
    const redis = getRedis()!;
    if (redis.status !== "ready") await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Test Redis did not become ready")), 3_000);
      redis.once("ready", () => { clearTimeout(timer); resolve(); });
    });
  });

  beforeEach(async () => {
    vi.restoreAllMocks();
    notify.mockClear();
    const keys = presenceKeys();
    await getRedis()!.del(keys.activity, keys.metadata, `${realtimePrefix()}:presence-dirty`);
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    const keys = presenceKeys();
    await getRedis()!.del(keys.activity, keys.metadata, `${realtimePrefix()}:presence-dirty`);
    await closeRedis();
  });

  it("deduplicates several tabs and removes only the tab that left", async () => {
    await touchPresence("lead1", "webinar1", "tab1");
    await touchPresence("lead1", "webinar1", "tab2");
    await touchPresence("lead2", "webinar2", "tab3");
    expect((await readPresenceSnapshot())?.leadIds.size).toBe(2);
    expect((await readPresenceSnapshot())?.byWebinar.get("webinar1")).toBe(1);
    await removePresence("lead1", "tab1");
    expect((await readPresenceSnapshot())?.leadIds.has("lead1")).toBe(true);
    await removePresence("lead1", "tab2");
    expect((await readPresenceSnapshot())?.leadIds.has("lead1")).toBe(false);
  });

  it("expires silent viewers and notifies their webinar without another heartbeat", async () => {
    const now = Date.now();
    await touchPresence("lead1", "webinar1", "tab1");
    notify.mockClear();
    vi.spyOn(Date, "now").mockReturnValue(now + 46_000);
    expect((await readPresenceSnapshot())?.leadIds.size).toBe(0);
    await prunePresence();
    expect(notify).toHaveBeenCalledWith("webinar1");
    expect(await getRedis()!.hlen(presenceKeys().metadata)).toBe(0);
  });

  it("keeps legacy HTTP and modern tabs independent while counting the lead once", async () => {
    await touchLegacyPresence("lead1", "webinar1");
    await touchPresence("lead1", "webinar1", "tab1");
    await removePresence("lead1", "tab1");
    expect((await readPresenceSnapshot())?.leadIds.size).toBe(1);
    await touchPresence("lead1", "webinar1", "tab1");
    await removeLegacyPresence("lead1");
    expect((await readPresenceSnapshot())?.leadIds.size).toBe(1);
    await removePresence("lead1", "tab1");
    expect((await readPresenceSnapshot())?.leadIds.size).toBe(0);
  });
});
