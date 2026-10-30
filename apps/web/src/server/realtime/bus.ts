import { prisma } from "db";
import type { RealtimeChatMessage, RealtimeEvent } from "../../lib/realtime-protocol";
import { getRedis, realtimePrefix, waitForRedisReady } from "./redis";

export interface RealtimeEnvelope {
  rooms: string[];
  event: RealtimeEvent;
}

export function realtimeChannel(): string { return `${realtimePrefix()}:events`; }

async function publish(envelope: RealtimeEnvelope): Promise<boolean> {
  const redis = getRedis();
  if (!redis || !await waitForRedisReady(redis)) return false;
  try { await redis.publish(realtimeChannel(), JSON.stringify(envelope)); return true; }
  catch { return false; }
}

export async function publishChatEvent(input: {
  leadId: string;
  webinarId: string;
  message: RealtimeChatMessage;
}): Promise<void> {
  await publish({ rooms: [`lead:${input.leadId}`, "staff"], event: { type: "chat", ...input } });
}

export async function publishPresenceEvent(webinarId: string): Promise<void> {
  const redis = getRedis();
  if (!redis || redis.status !== "ready") return;
  try { await redis.sadd(`${realtimePrefix()}:presence-dirty`, webinarId); }
  catch { /* A following heartbeat will enqueue this room again. */ }
}

export async function flushPresenceEvents(): Promise<void> {
  const redis = getRedis();
  if (!redis || redis.status !== "ready") return;
  let webinarIds: string[] = [];
  try {
    // All gateway instances share this work queue. Coalescing never drops a
    // later arrival from the same second; it is included in the next snapshot.
    webinarIds = await redis.spop(`${realtimePrefix()}:presence-dirty`, 100);
    if (!webinarIds.length) return;
    const webinars = await prisma.webinar.findMany({ where: { id: { in: webinarIds } }, select: { id: true, ownerId: true } });
    for (const webinar of webinars) {
      const sent = await publish({
        rooms: [`webinar:${webinar.id}`, `dashboard:${webinar.ownerId}`, "staff"],
        event: { type: "presence", webinarId: webinar.id }
      });
      if (!sent) await redis.sadd(`${realtimePrefix()}:presence-dirty`, webinar.id);
    }
  } catch {
    if (webinarIds.length) try { await redis.sadd(`${realtimePrefix()}:presence-dirty`, ...webinarIds); } catch { /* Retry on heartbeat. */ }
  }
}

export function parseRealtimeEnvelope(raw: string): RealtimeEnvelope | null {
  try {
    const value = JSON.parse(raw) as RealtimeEnvelope;
    if (!Array.isArray(value.rooms) || !value.rooms.length || value.rooms.some((room) => typeof room !== "string")) return null;
    if (!value.event || !["chat", "presence", "resync"].includes(value.event.type)) return null;
    return value;
  } catch { return null; }
}
