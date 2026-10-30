import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { prisma } from "db";
import { verifyLeadCookie } from "@/lib/lead-session";
import { leadChatLimiter } from "@/lib/rate-limit";
import { ChatIdempotencyConflict, createChatMessage, getChatMessages } from "@/server/chat-message";

const inputSchema = z.object({
  text: z.string().trim().min(1).max(500),
  videoSec: z.number().int().min(0).optional(),
  clientMessageId: z.string().uuid().optional()
});

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const leadId = verifyLeadCookie(cookieStore.get("hw_lead")?.value);
  if (!leadId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  if (!leadChatLimiter.check(leadId)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const body = (await request.json().catch(() => null)) as unknown;
  const parsed = inputSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid_input" }, { status: 400 });

  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) return NextResponse.json({ error: "not_found" }, { status: 404 });

  try {
    const { message } = await createChatMessage({
      leadId: lead.id,
      webinarId: lead.webinarId,
      text: parsed.data.text,
      sender: "lead",
      videoSec: parsed.data.videoSec,
      clientMessageId: parsed.data.clientMessageId
    });
    return NextResponse.json(message);
  } catch (error) {
    if (error instanceof ChatIdempotencyConflict) {
      return NextResponse.json({ error: "client_message_id_conflict" }, { status: 409 });
    }
    throw error;
  }
}

export async function GET(request: Request) {
  const cookieStore = await cookies();
  const leadId = verifyLeadCookie(cookieStore.get("hw_lead")?.value);
  if (!leadId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  return NextResponse.json(
    { messages: await getChatMessages(leadId, url.searchParams.get("after")) },
    { headers: { "cache-control": "private, no-store" } }
  );
}
