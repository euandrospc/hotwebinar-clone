import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeRedis, createRedisSubscriber, getRedis, waitForRedisReady } from "@/server/realtime/redis";
import { publishChatEvent, realtimeChannel } from "@/server/realtime/bus";
import type Redis from "ioredis";

describe.skipIf(!process.env.REALTIME_REDIS_TEST_URL)("first chat publish with real Redis", () => {
  let subscriber: Redis;

  beforeAll(async () => {
    subscriber = createRedisSubscriber()!;
    expect(await waitForRedisReady(subscriber)).toBe(true);
    await subscriber.subscribe(realtimeChannel());
    await closeRedis();
  });
  afterAll(async () => {
    subscriber.disconnect();
    await closeRedis();
  });

  it("delivers the first persisted message while the publisher starts disconnected", async () => {
    // getRedis creates a brand-new socket, just as a cold Next API route does.
    expect(getRedis()!.status).not.toBe("ready");
    const received = new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Cold publisher dropped the first chat event")), 2_000);
      subscriber.once("message", (_channel, payload) => { clearTimeout(timeout); resolve(payload); });
    });
    await publishChatEvent({
      leadId: "cold-lead", webinarId: "cold-webinar",
      message: { id: "cold-message", text: "First send", sender: "lead", teamName: null, videoSec: null, createdAt: new Date().toISOString() }
    });
    expect(JSON.parse(await received)).toMatchObject({
      rooms: ["lead:cold-lead", "staff"], event: { type: "chat", message: { id: "cold-message" } }
    });
  });
});
