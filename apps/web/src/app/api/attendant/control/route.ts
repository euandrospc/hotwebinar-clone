import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "db";
import { requireAttendant } from "@/lib/attendant-session";
import { publishConversationEvent } from "@/server/realtime/bus";

const schema = z.object({ leadId: z.string().min(1), action: z.enum(["takeover", "resume"]) });
export async function POST(request: Request) {
  const session = await requireAttendant();
  if (!session) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  const lead = await prisma.lead.findUnique({ where: { id: parsed.data.leadId }, select: { webinarId: true, webinar: { select: { chatAiEnabled: true } } } });
  if (!lead) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const pause = parsed.data.action === "takeover";
  if (!pause && (!lead.webinar.chatAiEnabled || !process.env.OPENAI_API_KEY)) return NextResponse.json({ error: "ai_not_configured" }, { status: 409 });
  await prisma.$transaction(async tx => {
    await tx.lead.update({
      where: { id: parsed.data.leadId },
      data: { aiPaused: pause, assignedAttendantId: pause ? session.user.id : null,
        chatVersion: { increment: 1 }, aiPendingMessageId: null, aiLeaseToken: null,
        aiLeaseUntil: null, aiError: null, aiAttempts: 0, aiNextAttemptAt: null }
    });
    if (!pause) {
      const last = await tx.leadChatMessage.findFirst({ where: { leadId: parsed.data.leadId }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { id: true, sender: true } });
      if (last?.sender === "lead") await tx.lead.update({ where: { id: parsed.data.leadId }, data: { aiPendingMessageId: last.id } });
    }
  });
  await publishConversationEvent(lead.webinarId, parsed.data.leadId);
  return NextResponse.json({ ok: true });
}
