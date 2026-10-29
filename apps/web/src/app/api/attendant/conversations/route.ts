import { NextResponse } from "next/server";
import { prisma } from "db";
import { requireAttendant } from "@/lib/attendant-session";
import { computePhase, withOccurrence } from "@/lib/sync";
import { onlineLeadWhere } from "@/lib/online";

export async function GET(request: Request) {
  const session = await requireAttendant();
  if (!session) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const webinarId = new URL(request.url).searchParams.get("webinarId") || undefined;

  const nowDate = new Date();
  const online = onlineLeadWhere(nowDate);
  const onlineIds = new Set(
    (await prisma.lead.findMany({ where: { ...(webinarId ? { webinarId } : {}), ...online }, select: { id: true } })).map((l) => l.id)
  );

  const leads = await prisma.lead.findMany({
    where: { ...(webinarId ? { webinarId } : {}), leadChatMessages: { some: {} } },
    select: {
      id: true, name: true, phone: true, webinarId: true,
      webinar: { select: { title: true, name: true, mode: true, startDate: true, endDate: true, recurring: true, recurringDays: true, timezone: true } },
      leadChatMessages: { orderBy: { createdAt: "desc" }, take: 1, select: { text: true, sender: true, createdAt: true } }
    }
  });

  const onlineTotal = onlineIds.size;

  const conversations = leads
    .map((l) => {
      const last = l.leadChatMessages[0];
      const occ = withOccurrence(l.webinar, nowDate);
      const phase = computePhase(
        { mode: occ.mode, startDate: occ.startDate, endDate: occ.endDate },
        nowDate
      );
      return {
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
        online: onlineIds.has(l.id)
      };
    })
    .sort((a, b) => (b.lastAt ?? "").localeCompare(a.lastAt ?? ""));

  return NextResponse.json({ conversations, onlineTotal }, { headers: { "cache-control": "no-store" } });
}
