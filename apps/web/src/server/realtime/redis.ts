import Redis from "ioredis";

let client: Redis | null = null;
let clientUrl: string | undefined;
const readiness = new WeakMap<Redis, Promise<boolean>>();

// Next route bundles create their own first connection. Wait briefly for that
// connection instead of discarding the first event while status is connecting.
// The offline queue stays disabled: an outage must not hold persisted HTTP sends.
export function waitForRedisReady(redis: Redis, timeoutMs = 750): Promise<boolean> {
  if (redis.status === "ready") return Promise.resolve(true);
  if (redis.status === "end") return Promise.resolve(false);
  const pending = readiness.get(redis);
  if (pending) return pending;

  const wait = new Promise<boolean>((resolve) => {
    const finish = (ready: boolean) => {
      clearTimeout(timer);
      redis.off("ready", onReady);
      redis.off("error", onUnavailable);
      redis.off("close", onUnavailable);
      redis.off("end", onUnavailable);
      resolve(ready);
    };
    const onReady = () => finish(true);
    const onUnavailable = () => finish(false);
    const timer = setTimeout(() => finish(false), timeoutMs);
    redis.once("ready", onReady);
    redis.once("error", onUnavailable);
    redis.once("close", onUnavailable);
    redis.once("end", onUnavailable);
  });
  readiness.set(redis, wait);
  void wait.then(() => readiness.delete(redis));
  return wait;
}

export function realtimeRedisUrl(): string | undefined {
  // Tests must explicitly opt into their own Redis; never inherit the dev store.
  return process.env.NODE_ENV === "test"
    ? process.env.REALTIME_REDIS_TEST_URL
    : process.env.REDIS_URL;
}

export function realtimePrefix(): string {
  return process.env.NODE_ENV === "test" ? "hotwebinar:realtime:test:v1" : "hotwebinar:realtime:v1";
}

function createClient(url: string): Redis {
  const redis = new Redis(url, {
    connectTimeout: 2_000,
    commandTimeout: 2_000,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    retryStrategy: (attempt) => Math.min(attempt * 200, 2_000)
  });
  // Availability is reported by the gateway. Never print connection URLs/secrets.
  redis.on("error", () => {});
  return redis;
}

export function getRedis(): Redis | null {
  const url = realtimeRedisUrl();
  if (!url) return null;
  if (!client || clientUrl !== url) {
    client?.disconnect();
    clientUrl = url;
    client = createClient(url);
  }
  return client;
}

export function createRedisSubscriber(): Redis | null {
  const url = realtimeRedisUrl();
  return url ? createClient(url) : null;
}

export async function closeRedis(): Promise<void> {
  const current = client;
  client = null;
  clientUrl = undefined;
  if (!current) return;
  try { await current.quit(); } catch { current.disconnect(); }
}
