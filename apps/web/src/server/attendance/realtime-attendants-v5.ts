import { prisma } from "db";
import { readStaffPresence } from "@/server/realtime/staff-presence-v5";

export interface RealtimeAttendantsSnapshot {
  from: string;
  to: string;
  presenceSource: "local" | "server";
  online: Array<{ id: string; name: string; image: string | null; handledConversations: number }>;
}

export async function getRealtimeAttendants({ webinarId, from, to }: {
  webinarId: string; from: Date; to: Date;
}): Promise<RealtimeAttendantsSnapshot | undefined> {
  const presence = await readStaffPresence(to);
  if (!presence) return;
  const result: RealtimeAttendantsSnapshot = { from: from.toISOString(), to: to.toISOString(), presenceSource: presence.presenceSource, online: [] };
  if (!presence.leases.length) return result;
  // Recheck role and sessions on read, so revoked sessions cannot stay online until TTL.
  const sessions = await prisma.session.findMany({
    where: { id: { in: [...new Set(presence.leases.map(lease => lease.sessionId))] }, expiresAt: { gt: to }, user: { role: { in: ["admin", "attendant"] } } },
    select: { id: true, user: { select: { id: true, name: true, image: true } } },
  });
  const users = new Map(sessions.filter(session => presence.leases.some(lease => lease.sessionId === session.id && lease.userId === session.user.id))
    .map(session => [session.user.id, session.user]));
  if (!users.size) return result;
  const conversations = await prisma.leadChatMessage.groupBy({
    by: ["authorUserId", "leadId"],
    where: { webinarId, sender: "team", aiAgentName: null, authorUserId: { in: [...users.keys()] }, createdAt: { gte: from, lte: to } },
  });
  const counts = new Map<string, number>();
  for (const conversation of conversations) {
    if (conversation.authorUserId) counts.set(conversation.authorUserId, (counts.get(conversation.authorUserId) ?? 0) + 1);
  }
  result.online = [...users.values()].map(user => ({ id: user.id, name: user.name?.trim() || "Unnamed attendant", image: user.image, handledConversations: counts.get(user.id) ?? 0 }));
  return result;
}
