import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { resolveLeadRequest } from "@/server/lead-request";
import { leadChatLimiter } from "@/lib/rate-limit";
import { ChatIdempotencyConflict, createChatMessage, getChatMessages } from "@/server/chat-message";

const inputSchema = z.object({
  text: z.string().trim().min(1).max(500),
  videoSec: z.number().int().min(0).optional(),
  clientMessageId: z.string().uuid().optional()
});

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const lead = await resolveLeadRequest(request, cookieStore);
  if (!lead) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  if (!leadChatLimiter.check(lead.id)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const body = (await request.json().catch(() => null)) as unknown;
  const parsed = inputSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid_input" }, { status: 400 });

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
  const lead = await resolveLeadRequest(request, cookieStore);
  if (!lead) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  return NextResponse.json(
    { messages: await getChatMessages(lead.id, url.searchParams.get("after")) },
    { headers: { "cache-control": "private, no-store" } }
  );
}
