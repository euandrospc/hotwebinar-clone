import { createHash } from "node:crypto";
import { hostname } from "node:os";
import { getRedis, realtimePrefix, waitForRedisReady } from "./redis";

// Allow ordinary background timer throttling; suspended/disconnected tabs still expire.
export const STAFF_PRESENCE_WINDOW_MS = 90_000;
export type StaffPresenceLease = { userId: string; sessionId: string; tabId: string };
export type StaffPresenceSnapshot = { presenceSource: "local" | "server"; leases: StaffPresenceLease[] };

/** A local preview must never write staff leases into the deployed instance. */
export function staffPresenceKeys() {
  const local = process.env.NODE_ENV !== "production";
  const instance = local ? `local:${createHash("sha256").update(`${hostname()}:${process.cwd()}`).digest("hex").slice(0, 16)}` : "server";
  const prefix = `${realtimePrefix()}:staff-v5:${instance}`;
  return { activity: `${prefix}:activity`, observed: `${prefix}:observed`, presenceSource: local ? "local" as const : "server" as const };
}

const TOUCH = `
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', ARGV[3])
redis.call('ZADD', KEYS[1], ARGV[1], ARGV[2])
redis.call('EXPIRE', KEYS[1], 180)
redis.call('SET', KEYS[2], ARGV[1], 'EX', 86400)
return 1
`;
const READ = `
if not redis.call('GET', KEYS[2]) then return nil end
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', ARGV[1])
return redis.call('ZRANGEBYSCORE', KEYS[1], ARGV[2], '+inf')
`;

const memberKey = (lease: StaffPresenceLease) => JSON.stringify([lease.userId, lease.sessionId, lease.tabId]);

export async function updateStaffPresence(lease: StaffPresenceLease, active: boolean): Promise<boolean> {
  const redis = getRedis();
  if (!redis || !await waitForRedisReady(redis)) return false;
  const keys = staffPresenceKeys();
  try {
    if (active) {
      const now = Date.now();
      await redis.eval(TOUCH, 2, keys.activity, keys.observed, now, memberKey(lease), `(${now - STAFF_PRESENCE_WINDOW_MS}`);
    } else {
      await redis.zrem(keys.activity, memberKey(lease));
    }
    return true;
  } catch { return false; }
}

export async function readStaffPresence(now = new Date()): Promise<StaffPresenceSnapshot | undefined> {
  const redis = getRedis();
  if (!redis || !await waitForRedisReady(redis)) return;
  const keys = staffPresenceKeys();
  try {
    const cutoff = now.getTime() - STAFF_PRESENCE_WINDOW_MS;
    const rows = await redis.eval(READ, 2, keys.activity, keys.observed, `(${cutoff}`, cutoff) as string[] | null;
    // No heartbeat has ever established coverage in this instance, or coverage expired.
    if (!Array.isArray(rows)) return;
    const leases: StaffPresenceLease[] = [];
    for (const raw of rows) {
      try {
        const ids: unknown = JSON.parse(raw);
        if (Array.isArray(ids) && ids.length === 3 && ids.every(id => typeof id === "string" && id.length > 0 && id.length <= 128)) {
          leases.push({ userId: ids[0], sessionId: ids[1], tabId: ids[2] });
        }
      } catch { /* Ignore malformed cache records; never invent an identity. */ }
    }
    return { presenceSource: keys.presenceSource, leases };
  } catch { return; }
}
