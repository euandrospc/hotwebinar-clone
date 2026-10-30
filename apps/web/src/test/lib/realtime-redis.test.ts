import { EventEmitter } from "node:events";
import type Redis from "ioredis";
import { afterEach, describe, expect, it, vi } from "vitest";
import { waitForRedisReady } from "@/server/realtime/redis";

function connectingRedis() {
  return Object.assign(new EventEmitter(), { status: "connecting" });
}

afterEach(() => vi.useRealTimers());

describe("Redis publisher readiness", () => {
  it("waits for a cold connection and shares that wait between simultaneous sends", async () => {
    const client = connectingRedis();
    const first = waitForRedisReady(client as unknown as Redis);
    const second = waitForRedisReady(client as unknown as Redis);
    expect(first).toBe(second);
    client.status = "ready";
    client.emit("ready");
    expect(await first).toBe(true);
    expect(client.listenerCount("ready")).toBe(0);
    expect(client.listenerCount("error")).toBe(0);
  });

  it("bounds an unreachable connection to 750 ms without leaving listeners", async () => {
    vi.useFakeTimers();
    const client = connectingRedis();
    const waiting = waitForRedisReady(client as unknown as Redis);
    await vi.advanceTimersByTimeAsync(750);
    expect(await waiting).toBe(false);
    expect(client.eventNames()).toEqual([]);
  });

  it("fails promptly on connection error and permits a later healthy retry", async () => {
    const client = connectingRedis();
    const waiting = waitForRedisReady(client as unknown as Redis);
    client.emit("error", new Error("connection refused"));
    expect(await waiting).toBe(false);
    const retry = waitForRedisReady(client as unknown as Redis);
    client.status = "ready";
    client.emit("ready");
    expect(await retry).toBe(true);
  });
});
