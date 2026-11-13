import { NextResponse } from "next/server";
import { prisma } from "db";
import { requireAttendant } from "@/lib/attendant-session";
import { attendanceRange } from "@/lib/attendance-range";

type Metrics = { pending: number; averageFirstReplySeconds: number | null; answeredToday: number };

// Every open inbox polls this; one shared computation per few seconds keeps the load flat.
const SHARE_MS = 5_000;
let shared: { at: number; data: Promise<Metrics> } | null = null;

async function computeTodayMetrics(): Promise<Metrics> {
  const { gte, lt } = attendanceRange(null, null);
  const messages = await prisma.leadChatMessage.findMany({
    where: { createdAt: { gte, lt } },
    select: { leadId: true, sender: true, createdAt: true },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }]
  });
  const waiting = new Map<string, number>();
  const firstReplies = new Map<string, number>();
  const answered = new Set<string>();
  for (const message of messages) {
    if (message.sender === "lead") {
      if (!waiting.has(message.leadId)) waiting.set(message.leadId, message.createdAt.getTime());
      continue;
    }
    answered.add(message.leadId);
    // Same rule as the dashboard report: a pair inside the day, first responder only.
    const since = waiting.get(message.leadId);
    if (since !== undefined && !firstReplies.has(message.leadId)) firstReplies.set(message.leadId, message.createdAt.getTime() - since);
  }
  const ids = [...new Set(messages.map(message => message.leadId))];
  const pendingRows = ids.length
    ? await prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT count(*)::bigint AS count
        FROM lead l
        CROSS JOIN LATERAL (
          SELECT sender FROM lead_chat_message
          WHERE "leadId" = l.id ORDER BY "createdAt" DESC, id DESC LIMIT 1
        ) m
        WHERE l.id = ANY(${ids}::text[]) AND l."attendanceClosedAt" IS NULL AND m.sender = 'lead'`
    : [{ count: 0n }];
  const durations = [...firstReplies.values()];
  return {
    pending: Number(pendingRows[0]?.count ?? 0),
    averageFirstReplySeconds: durations.length ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length / 1000) : null,
    answeredToday: answered.size
  };
}

export async function GET() {
  const session = await requireAttendant();
  if (!session) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const now = Date.now();
  if (!shared || now - shared.at > SHARE_MS) {
    const data = computeTodayMetrics();
    shared = { at: now, data };
    data.catch(() => { if (shared?.data === data) shared = null; });
  }
  return NextResponse.json(await shared.data, { headers: { "cache-control": "no-store" } });
}
