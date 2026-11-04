import { attendanceRange } from "@/lib/attendance-range";
import { NextResponse } from "next/server";
import { prisma } from "db";
import { requireAttendant } from "@/lib/attendant-session";
import { computePhase, withOccurrence } from "@/lib/sync";
import { getOnlineSnapshot } from "@/lib/online";

export async function GET(request: Request) {
  const session = await requireAttendant();
  if (!session) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const params = new URL(request.url).searchParams;
  const webinarId = params.get("webinarId") || undefined;
  const leadId = params.get("leadId") || undefined;
  let range;
  try { range = attendanceRange(params.get("from"), params.get("to"), new Date(), { fromTime: params.get("fromTime"), toTime: params.get("toTime") }); }
  catch { return NextResponse.json({ error: "invalid_range" }, { status: 400 }); }

  const nowDate = new Date();
  const snap = await getOnlineSnapshot();

  const leads = await prisma.lead.findMany({
    where: { ...(webinarId ? { webinarId } : {}), ...(leadId ? { id: leadId } : {}), leadChatMessages: { some: leadId ? {} : { createdAt: { gte: range.gte, lt: range.lt } } } },
    select: {
      aiPaused: true, aiError: true, aiPendingMessageId: true, assignedAttendantId: true, assignedAttendant: { select: { name: true } },
      id: true, name: true, phone: true, webinarId: true,
      webinar: { select: { chatAiEnabled: true, chatAiName: true, title: true, name: true, mode: true, startDate: true, endDate: true, recurring: true, recurringDays: true, timezone: true } },
      leadChatMessages: { orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 1, select: { text: true, sender: true, createdAt: true } }
    }
  });

  const onlineTotal = webinarId
    ? (snap.byWebinar.get(webinarId) ?? 0)
    : [...snap.byWebinar.values()].reduce((n, c) => n + c, 0);

  const conversations = leads
    .map((l) => {
      const last = l.leadChatMessages[0];
      const occ = withOccurrence(l.webinar, nowDate);
      const phase = computePhase(
        { mode: occ.mode, startDate: occ.startDate, endDate: occ.endDate },
        nowDate
      );
      return {
        aiEnabled: l.webinar.chatAiEnabled && !!process.env.OPENAI_API_KEY,
        aiName: l.webinar.chatAiName,
        aiPaused: l.aiPaused,
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
        pending: last?.sender === "lead",
        online: snap.leadIds.has(l.id)
      };
    })
    .sort((a, b) => (b.lastAt ?? "").localeCompare(a.lastAt ?? ""));

  const attendants = await prisma.user.findMany({
    where: { OR: [{ role: { in: ["admin", "attendant"] } }, { teamChatMessages: { some: {} } }] },
    select: { id: true, name: true }, orderBy: { name: "asc" }
  });
  return NextResponse.json({ conversations, onlineTotal, attendants }, { headers: { "cache-control": "no-store" } });
}
