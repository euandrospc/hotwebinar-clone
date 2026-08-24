import { NextResponse } from "next/server";
import { prisma } from "db";
import { requireAttendant } from "@/lib/attendant-session";
import { computePhase } from "@/lib/sync";

const ONLINE_MS = 45_000;

export async function GET(request: Request) {
  const session = await requireAttendant();
  if (!session) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const webinarId = new URL(request.url).searchParams.get("webinarId") || undefined;

  const leads = await prisma.lead.findMany({
    where: { ...(webinarId ? { webinarId } : {}), leadChatMessages: { some: {} } },
    select: {
      id: true, name: true, webinarId: true, lastSeenAt: true, leaveFired: true,
      webinar: { select: { title: true, name: true, mode: true, startDate: true, endDate: true } },
      leadChatMessages: { orderBy: { createdAt: "desc" }, take: 1, select: { text: true, sender: true, createdAt: true } }
    }
  });

  const onlineSince = new Date(Date.now() - ONLINE_MS);
  const onlineTotal = await prisma.lead.count({
    where: { ...(webinarId ? { webinarId } : {}), leaveFired: false, lastSeenAt: { gte: onlineSince } }
  });

  const nowDate = new Date();
  const now = nowDate.getTime();
  const conversations = leads
    .map((l) => {
      const last = l.leadChatMessages[0];
      const phase = computePhase(
        { mode: l.webinar.mode, startDate: l.webinar.startDate, endDate: l.webinar.endDate },
        nowDate
      );
      return {
        leadId: l.id,
        leadName: l.name,
        webinarId: l.webinarId,
        webinarTitle: l.webinar.title || l.webinar.name || "Webinar",
        webinarPhase: phase,
        webinarStartDate: l.webinar.startDate ? l.webinar.startDate.toISOString() : null,
        lastText: last?.text ?? "",
        lastAt: last ? last.createdAt.toISOString() : null,
        pending: last?.sender === "lead",
        online: !l.leaveFired && l.lastSeenAt.getTime() >= now - ONLINE_MS
      };
    })
    .sort((a, b) => (b.lastAt ?? "").localeCompare(a.lastAt ?? ""));

  return NextResponse.json({ conversations, onlineTotal }, { headers: { "cache-control": "no-store" } });
}
