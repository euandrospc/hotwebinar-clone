import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "db";
import { requireAttendant } from "@/lib/attendant-session";
import { attendantReplyLimiter } from "@/lib/rate-limit";
import { tagKirvanoLinks } from "@/lib/kirvano-link";
import { ChatIdempotencyConflict, createChatMessage } from "@/server/chat-message";

const schema = z.object({
  leadId: z.string().min(1),
  text: z.string().trim().min(1).max(500),
  clientMessageId: z.string().uuid().optional()
});

export async function POST(request: Request) {
  const session = await requireAttendant();
  if (!session) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!attendantReplyLimiter.check(session.user.id)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  const lead = await prisma.lead.findUnique({ where: { id: parsed.data.leadId }, select: { id: true, webinarId: true } });
  if (!lead) return NextResponse.json({ error: "not_found" }, { status: 404 });
  try {
    const { message, created } = await createChatMessage({
      leadId: lead.id,
      webinarId: lead.webinarId,
      text: tagKirvanoLinks(parsed.data.text, lead.id),
      sender: "team",
      authorUserId: session.user.id,
      clientMessageId: parsed.data.clientMessageId
    });
    return NextResponse.json(message, { status: created ? 201 : 200 });
  } catch (error) {
    if (error instanceof ChatIdempotencyConflict) {
      return NextResponse.json({ error: "client_message_id_conflict" }, { status: 409 });
    }
    throw error;
  }
}
