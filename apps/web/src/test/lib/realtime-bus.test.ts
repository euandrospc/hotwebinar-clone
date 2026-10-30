import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPresenceEvents, publishChatEvent, publishPresenceEvent } from "@/server/realtime/bus";

const mocks = vi.hoisted(() => ({
  redis: { status: "ready", publish: vi.fn(), sadd: vi.fn(), spop: vi.fn() },
  findMany: vi.fn()
}));
vi.mock("@/server/realtime/redis", () => ({ getRedis: () => mocks.redis, realtimePrefix: () => "test", waitForRedisReady: async () => mocks.redis.status === "ready" }));
vi.mock("db", () => ({ prisma: { webinar: { findMany: mocks.findMany } } }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.redis.status = "ready";
  mocks.redis.publish.mockResolvedValue(1);
  mocks.redis.sadd.mockResolvedValue(1);
  mocks.redis.spop.mockResolvedValue(["w1"]);
  mocks.findMany.mockResolvedValue([{ id: "w1", ownerId: "owner1" }]);
});

describe("realtime publication", () => {
  it("publishes private messages only to their lead and authorized staff", async () => {
    await publishChatEvent({ leadId: "l1", webinarId: "w1", message: { id: "m1", text: "Hello", sender: "lead", teamName: null, videoSec: null, createdAt: new Date().toISOString() } });
    expect(JSON.parse(mocks.redis.publish.mock.calls[0][1]).rooms).toEqual(["lead:l1", "staff"]);
  });

  it("does not fail a persisted send when Redis is unavailable", async () => {
    mocks.redis.publish.mockRejectedValue(new Error("offline"));
    await expect(publishChatEvent({ leadId: "l1", webinarId: "w1", message: { id: "m1", text: "Saved", sender: "team", teamName: null, videoSec: null, createdAt: new Date().toISOString() } })).resolves.toBeUndefined();
  });

  it("queues changes for a shared batch and notifies only the owner metrics channel", async () => {
    await publishPresenceEvent("w1");
    expect(mocks.redis.sadd).toHaveBeenCalledWith("test:presence-dirty", "w1");
    await flushPresenceEvents();
    expect(JSON.parse(mocks.redis.publish.mock.calls[0][1]).rooms).toEqual(["webinar:w1", "dashboard:owner1", "staff"]);
  });

  it("requeues a presence update if publishing failed", async () => {
    mocks.redis.publish.mockRejectedValue(new Error("offline"));
    await flushPresenceEvents();
    expect(mocks.redis.sadd).toHaveBeenCalledWith("test:presence-dirty", "w1");
  });
});
