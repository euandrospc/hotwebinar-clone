import { prisma } from "db";

export async function getAttendanceReport(ownerId: string, start: Date, end: Date) {
  const messages = await prisma.leadChatMessage.findMany({
    where: { webinar: { ownerId }, createdAt: { gte: start, lte: end } },
    select: { leadId: true, sender: true, authorUserId: true, aiAgentName: true, createdAt: true, authorUser: { select: { name: true } } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }]
  });
  const leadIds = [...new Set(messages.map(message => message.leadId))];
  const leads = leadIds.length ? await prisma.lead.findMany({
    where: { id: { in: leadIds } },
    select: { attendanceClosedAt: true, leadChatMessages: { take: 1, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { sender: true } } }
  }) : [];
  const ranking = new Map<string, { name: string; replies: number; leads: Set<string> }>();
  let human = 0;
  let ai = 0;
  const waits = new Map<string, Date>();
  const firstReplies = new Map<string, number>();
  for (const message of messages) {
    if (message.sender === "lead") {
      if (!waits.has(message.leadId)) waits.set(message.leadId, message.createdAt);
      continue;
    }
    if (message.aiAgentName) ai++;
    else human++;
    const waiting = waits.get(message.leadId);
    if (waiting && !firstReplies.has(message.leadId)) firstReplies.set(message.leadId, message.createdAt.getTime() - waiting.getTime());
    if (message.authorUserId) {
      const row = ranking.get(message.authorUserId) ?? { name: message.authorUser?.name ?? "Atendente removido", replies: 0, leads: new Set<string>() };
      row.replies++;
      row.leads.add(message.leadId);
      ranking.set(message.authorUserId, row);
    }
  }
  const total = leadIds.length;
  const pending = leads.filter(lead => !lead.attendanceClosedAt && lead.leadChatMessages[0]?.sender === "lead").length;
  const closed = leads.filter(lead => lead.attendanceClosedAt).length;
  const durations = [...firstReplies.values()];
  return {
    total, pending, closed, answered: total - pending - closed, humanReplies: human, aiReplies: ai,
    averageFirstReplySeconds: durations.length ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length / 1000) : null,
    ranking: [...ranking].map(([id, row]) => ({ id, name: row.name, replies: row.replies, conversations: row.leads.size })).sort((a, b) => b.conversations - a.conversations || b.replies - a.replies)
  };
}
