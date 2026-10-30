import { prisma, type Prisma } from "db";
import { readPresenceSnapshot } from "@/server/realtime/presence";

// A lead is online when its player sent a heartbeat (VIDEO_TICK, every 30s from
// /api/track) within the window. lastSeenAt alone is not enough: opt-in and page
// loads also set it, which counted people still in the waiting room.
export const ONLINE_WINDOW_MS = 45_000;

export function onlineLeadWhere(now = new Date()): Prisma.LeadWhereInput {
  return {
    leaveFired: false,
    events: { some: { kind: "VIDEO_TICK", createdAt: { gte: new Date(now.getTime() - ONLINE_WINDOW_MS) } } }
  };
}

// One shared snapshot for every "online" number (admin dashboard, webinar badge,
// attendant inbox, player chat) so they all show the same value, and so a full
// live room polling it costs one query per refresh instead of one per viewer.
export const ONLINE_REFRESH_MS = 15_000;

export interface OnlineSnapshot {
  byWebinar: Map<string, number>;
  leadIds: Set<string>;
}

let snapshot: { at: number; data: Promise<OnlineSnapshot> } | null = null;

export async function getOnlineSnapshot(): Promise<OnlineSnapshot> {
  const live = await readPresenceSnapshot();
  if (live) return live;
  const now = Date.now();
  if (snapshot && now - snapshot.at < ONLINE_REFRESH_MS) return snapshot.data;
  const data = prisma.lead
    .findMany({ where: onlineLeadWhere(new Date(now)), select: { id: true, webinarId: true } })
    .then((rows) => {
      const byWebinar = new Map<string, number>();
      for (const r of rows) byWebinar.set(r.webinarId, (byWebinar.get(r.webinarId) ?? 0) + 1);
      return { byWebinar, leadIds: new Set(rows.map((r) => r.id)) };
    });
  data.catch(() => { snapshot = null; }); // don't cache a failed query
  snapshot = { at: now, data };
  return data;
}
