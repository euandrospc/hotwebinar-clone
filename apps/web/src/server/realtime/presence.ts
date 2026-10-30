import { getRedis, realtimePrefix } from "./redis";
import { publishPresenceEvent } from "./bus";

export const PRESENCE_WINDOW_MS = 45_000;
type PresenceMember = { leadId: string; webinarId: string };
export interface PresenceSnapshot { leadIds: Set<string>; byWebinar: Map<string, number> }

export function presenceKeys() {
  const prefix = realtimePrefix();
  return { activity: `${prefix}:presence`, metadata: `${prefix}:presence-metadata` };
}

const TOUCH = `
redis.call('ZADD', KEYS[1], ARGV[1], ARGV[2])
redis.call('HSET', KEYS[2], ARGV[2], ARGV[3])
return 1
`;
const REMOVE = `
local metadata = redis.call('HGET', KEYS[2], ARGV[1])
redis.call('ZREM', KEYS[1], ARGV[1])
redis.call('HDEL', KEYS[2], ARGV[1])
return metadata
`;
const PRUNE = `
local expired = redis.call('ZRANGEBYSCORE', KEYS[1], '-inf', ARGV[1], 'LIMIT', 0, 1000)
local removed = {}
for _, member in ipairs(expired) do
  local metadata = redis.call('HGET', KEYS[2], member)
  if metadata then table.insert(removed, metadata) end
  redis.call('ZREM', KEYS[1], member)
  redis.call('HDEL', KEYS[2], member)
end
return removed
`;
const READ = `
local active = redis.call('ZRANGEBYSCORE', KEYS[1], ARGV[1], '+inf')
local result = {}
for _, member in ipairs(active) do
  local metadata = redis.call('HGET', KEYS[2], member)
  if metadata then table.insert(result, metadata) end
end
return result
`;

function memberKey(leadId: string, connectionId: string) { return JSON.stringify([leadId, connectionId]); }
function decodeMember(value: string): PresenceMember | null {
  try {
    const member = JSON.parse(value) as PresenceMember;
    return typeof member.leadId === "string" && typeof member.webinarId === "string" ? member : null;
  } catch { return null; }
}

export async function touchPresence(leadId: string, webinarId: string, connectionId = "http"): Promise<boolean> {
  const redis = getRedis();
  if (!redis || redis.status !== "ready") return false;
  const keys = presenceKeys();
  try {
    await redis.eval(TOUCH, 2, keys.activity, keys.metadata, Date.now(), memberKey(leadId, connectionId), JSON.stringify({ leadId, webinarId }));
    await publishPresenceEvent(webinarId);
    return true;
  } catch { return false; }
}

export async function removePresence(leadId: string, connectionId = "http"): Promise<void> {
  const redis = getRedis();
  if (!redis || redis.status !== "ready") return;
  const keys = presenceKeys();
  try {
    const raw = await redis.eval(REMOVE, 2, keys.activity, keys.metadata, memberKey(leadId, connectionId)) as string | null;
    const member = raw ? decodeMember(raw) : null;
    if (member) await publishPresenceEvent(member.webinarId);
  } catch { /* Expiry cleans up a lost removal. */ }
}

// Older players keep their HTTP lease. New clients declare their transport, so
// an analytics tick does not create a second lease for a WebSocket-only player.
export function touchLegacyPresence(leadId: string, webinarId: string): Promise<boolean> {
  return touchPresence(leadId, webinarId, "http");
}

export function removeLegacyPresence(leadId: string): Promise<void> {
  return removePresence(leadId, "http");
}

export async function prunePresence(): Promise<void> {
  const redis = getRedis();
  if (!redis || redis.status !== "ready") return;
  const keys = presenceKeys();
  try {
    const expired = await redis.eval(PRUNE, 2, keys.activity, keys.metadata, `(${Date.now() - PRESENCE_WINDOW_MS}`) as string[];
    const webinars = new Set(expired.map(decodeMember).filter((row): row is PresenceMember => !!row).map((row) => row.webinarId));
    await Promise.all([...webinars].map((webinarId) => publishPresenceEvent(webinarId)));
  } catch { /* The next cleanup/read ignores expired entries regardless. */ }
}

export async function readPresenceSnapshot(): Promise<PresenceSnapshot | null> {
  const redis = getRedis();
  if (!redis || redis.status !== "ready") return null;
  const keys = presenceKeys();
  try {
    const rows = await redis.eval(READ, 2, keys.activity, keys.metadata, Date.now() - PRESENCE_WINDOW_MS) as string[];
    const leadIds = new Set<string>();
    const byWebinar = new Map<string, number>();
    for (const raw of rows) {
      const row = decodeMember(raw);
      if (!row || leadIds.has(row.leadId)) continue;
      leadIds.add(row.leadId);
      byWebinar.set(row.webinarId, (byWebinar.get(row.webinarId) ?? 0) + 1);
    }
    return { leadIds, byWebinar };
  } catch { return null; }
}
