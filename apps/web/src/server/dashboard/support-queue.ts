import { prisma } from "db";
import { ownerScope, type AccessUser } from "@/lib/webinar-access";
import { dashboardComparisonRange } from "@/lib/dashboard-insights";

export interface DashboardSupportQueueItem {
  leadId: string;
  leadName: string;
  text: string;
  /** ISO time of the lead's last, still unanswered message. */
  createdAt: string;
}

export interface DashboardSupportQueue {
  /** Conversations open right now whose newest message is from the lead (same rule as the /atendimento inbox). */
  waitingTotal: number;
  waiting: DashboardSupportQueueItem[];
  /** Distinct conversations with lead or team messages in the previous, equally long period. */
  previousConversations: number;
}

const QUEUE_LIMIT = 3;

/**
 * Current queue, limited to conversations whose last message falls in the selected period, so a
 * dashboard filtered to an old range does not list months-old chats. Scoped to accessible webinars.
 */
export async function getDashboardSupportQueue(viewer: AccessUser, rangeStart: Date, rangeEnd: Date, webinarId?: string): Promise<DashboardSupportQueue> {
  if (!viewer?.id) throw new Error("Dashboard owner is required");
  const ids = (await prisma.webinar.findMany({
    where: { ...ownerScope(viewer), ...(webinarId === undefined ? {} : { id: webinarId }) },
    select: { id: true }
  })).map((webinar) => webinar.id);
  if (!ids.length) return { waitingTotal: 0, waiting: [], previousConversations: 0 };
  const previous = dashboardComparisonRange(rangeStart, rangeEnd);
  const [waiting, [prev]] = await Promise.all([
    prisma.$queryRaw<{ leadId: string; leadName: string; text: string; createdAt: Date }[]>`
      SELECT l.id AS "leadId", l.name AS "leadName", m.text, m."createdAt"
      FROM (
        SELECT DISTINCT "leadId" FROM lead_chat_message
        WHERE "webinarId" = ANY(${ids}::text[]) AND "createdAt" >= ${rangeStart} AND "createdAt" <= ${rangeEnd}
      ) c
      JOIN lead l ON l.id = c."leadId" AND l."attendanceClosedAt" IS NULL
      CROSS JOIN LATERAL (
        SELECT text, sender, "createdAt" FROM lead_chat_message
        WHERE "leadId" = l.id ORDER BY "createdAt" DESC, id DESC LIMIT 1
      ) m
      WHERE m.sender = 'lead' AND m."createdAt" <= ${rangeEnd}
      ORDER BY m."createdAt" DESC`,
    prisma.$queryRaw<{ count: number }[]>`
      SELECT COUNT(DISTINCT "leadId")::int AS count FROM lead_chat_message
      WHERE "webinarId" = ANY(${ids}::text[]) AND sender IN ('lead', 'team')
        AND "createdAt" >= ${previous.start} AND "createdAt" <= ${previous.end}`
  ]);
  return {
    waitingTotal: waiting.length,
    waiting: waiting.slice(0, QUEUE_LIMIT).map((row) => ({ ...row, createdAt: row.createdAt.toISOString() })),
    previousConversations: prev?.count ?? 0
  };
}
