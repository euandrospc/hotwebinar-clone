import type { Prisma } from "db";

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
