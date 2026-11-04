import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "db";
import { requireAttendant } from "@/lib/attendant-session";
import { publishConversationEvent } from "@/server/realtime/bus";

const schema = z.discriminatedUnion("action", [
  z.object({ leadId: z.string().min(1), action: z.enum(["takeover", "resume", "close", "reopen"]) }),
  z.object({ leadId: z.string().min(1), action: z.literal("transfer"), attendantId: z.string().min(1) })
]);
class ControlError extends Error {
  constructor(public code: string, public status: number) { super(code); }
}

export async function POST(request: Request) {
  const session = await requireAttendant();
  if (!session) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  const input = parsed.data;
  const result = await prisma.$transaction(async tx => {
    // Serialize controls with incoming messages and in-flight AI responses.
    const locked = await tx.lead.updateMany({ where: { id: input.leadId }, data: { chatVersion: { increment: 1 } } });
    if (!locked.count) throw new ControlError("not_found", 404);
    const lead = await tx.lead.findUniqueOrThrow({ where: { id: input.leadId }, select: { webinarId: true, attendanceClosedAt: true, webinar: { select: { chatAiEnabled: true } } } });
    if (lead.attendanceClosedAt && ["transfer", "resume", "takeover"].includes(input.action)) throw new ControlError("attendance_closed", 409);
    let assignedId = session.user.id;
    if (input.action === "transfer") {
      const target = await tx.user.findUnique({ where: { id: input.attendantId }, select: { id: true, role: true } });
      if (!target || !["admin", "attendant"].includes(target.role)) throw new ControlError("invalid_attendant", 400);
      assignedId = target.id;
    }
    const resume = input.action === "resume";
    if (resume && (!lead.webinar.chatAiEnabled || !process.env.OPENAI_API_KEY)) throw new ControlError("ai_not_configured", 409);
    await tx.lead.update({
      where: { id: input.leadId },
      data: { aiPaused: !resume,
        ...(input.action === "close" ? { attendanceClosedAt: lead.attendanceClosedAt ?? new Date() } : { attendanceClosedAt: null, assignedAttendantId: resume ? null : assignedId }),
        aiPendingMessageId: null, aiLeaseToken: null, aiLeaseUntil: null,
        aiError: null, aiAttempts: 0, aiNextAttemptAt: null }
    });
    if (resume) {
      const last = await tx.leadChatMessage.findFirst({ where: { leadId: input.leadId }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { id: true, sender: true } });
      if (last?.sender === "lead") await tx.lead.update({ where: { id: input.leadId }, data: { aiPendingMessageId: last.id } });
    }
    return { webinarId: lead.webinarId };
  }).catch(error => {
    if (error instanceof ControlError) return { error: error.code, status: error.status };
    throw error;
  });
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  await publishConversationEvent(result.webinarId, input.leadId);
  return NextResponse.json({ ok: true });
}
