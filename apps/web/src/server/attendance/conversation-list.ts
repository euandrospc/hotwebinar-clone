import { prisma } from "db";
import { computePhase, withOccurrence } from "@/lib/sync";
import { getOnlineSnapshot } from "@/lib/online";

type LastMessage = { leadId: string; text: string; sender: string; createdAt: Date };
type ListPayload = Awaited<ReturnType<typeof loadConversations>>;

// Every chat, presence and conversation event makes each open inbox refetch this list, so
// at a live's peak many tabs ask for the same heavy list at once. Identical requests share
// one in-flight load and its result for a short window: database work stays bounded no
// matter how many tabs or agents poll. Payloads do not depend on the attendant.
const LIST_SHARE_MS = 1_500;
const listCache = new Map<string, { data: Promise<ListPayload>; settledAt: number | null }>();

export function sharedConversationList(key: string, load: () => Promise<ListPayload>): Promise<ListPayload> {
  const now = Date.now();
  const hit = listCache.get(key);
  if (hit && (hit.settledAt === null || now - hit.settledAt < LIST_SHARE_MS)) return hit.data;
  for (const [k, entry] of listCache) {
    if (entry.settledAt !== null && now - entry.settledAt >= LIST_SHARE_MS) listCache.delete(k);
  }
  const entry: { data: Promise<ListPayload>; settledAt: number | null } = { data: load(), settledAt: null };
  listCache.set(key, entry);
  entry.data.then(
    () => { entry.settledAt = Date.now(); },
    () => { if (listCache.get(key) === entry) listCache.delete(key); }
  );
  return entry.data;
}

export async function loadConversations(range: { gte: Date; lt: Date }, webinarId?: string, leadId?: string) {
  const nowDate = new Date();
  const snap = await getOnlineSnapshot();

  const leads = await prisma.lead.findMany({
    where: { ...(webinarId ? { webinarId } : {}), ...(leadId ? { id: leadId } : {}), leadChatMessages: { some: leadId ? {} : { createdAt: { gte: range.gte, lt: range.lt } } } },
    select: {
      aiPaused: true, attendanceClosedAt: true, aiError: true, aiPendingMessageId: true, assignedAttendantId: true, assignedAttendant: { select: { name: true } },
      id: true, name: true, phone: true, webinarId: true,
      webinar: { select: { chatAiEnabled: true, chatAiName: true, title: true, name: true, mode: true, startDate: true, endDate: true, recurring: true, recurringDays: true, timezone: true } }
    }
  });

  // Only the newest message per lead, one index probe each. A nested `take: 1` would load
  // every message of every listed lead (all past lives included) and slice in memory.
  const ids = leads.map((l) => l.id);
  const lastRows = ids.length
    ? await prisma.$queryRaw<LastMessage[]>`
        SELECT l.id AS "leadId", m.text, m.sender, m."createdAt"
        FROM unnest(${ids}::text[]) AS l(id)
        CROSS JOIN LATERAL (
          SELECT text, sender, "createdAt" FROM lead_chat_message
          WHERE "leadId" = l.id ORDER BY "createdAt" DESC, id DESC LIMIT 1
        ) m`
    : [];
  const lastByLead = new Map(lastRows.map((row) => [row.leadId, row]));

  const onlineTotal = webinarId
    ? (snap.byWebinar.get(webinarId) ?? 0)
    : [...snap.byWebinar.values()].reduce((n, c) => n + c, 0);

  const conversations = leads
    .map((l) => {
      const last = lastByLead.get(l.id);
      const occ = withOccurrence(l.webinar, nowDate);
      const phase = computePhase(
        { mode: occ.mode, startDate: occ.startDate, endDate: occ.endDate },
        nowDate
      );
      return {
        aiEnabled: l.webinar.chatAiEnabled && !!process.env.OPENAI_API_KEY,
        aiName: l.webinar.chatAiName,
        aiPaused: l.aiPaused,
        closedAt: l.attendanceClosedAt?.toISOString() ?? null,
        aiError: l.aiError,
        aiPending: !!l.aiPendingMessageId,
        assignedAttendantId: l.assignedAttendantId,
        assignedAttendantName: l.assignedAttendant?.name ?? null,
        leadId: l.id,
        leadName: l.name,
        leadPhone: l.phone,
        webinarId: l.webinarId,
        webinarTitle: l.webinar.title || l.webinar.name || "Webinar",
        webinarPhase: phase,
        webinarStartDate: occ.startDate ? occ.startDate.toISOString() : null,
        lastText: last?.text ?? "",
        lastAt: last ? last.createdAt.toISOString() : null,
        pending: !l.attendanceClosedAt && last?.sender === "lead",
        online: snap.leadIds.has(l.id)
      };
    })
    .sort((a, b) => (b.lastAt ?? "").localeCompare(a.lastAt ?? ""));

  const attendants = await prisma.user.findMany({
    where: { role: { in: ["admin", "attendant"] } },
    select: { id: true, name: true }, orderBy: { name: "asc" }
  });
  return { conversations, onlineTotal, attendants };
}

/** Tests call this to observe writes made inside the sharing window. */
export function clearConversationListCache() {
  listCache.clear();
}
