import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "db";
import { requireAttendant } from "@/lib/attendant-session";
import { createLimiter } from "@/lib/rate-limit";
import { generateAnswer, webinarAiInstructions } from "@/server/attendance/ai";

const schema = z.object({ leadId: z.string().min(1) });
// Each suggestion is a paid model call; the inbox asks at most once per new lead message.
const suggestLimiter = createLimiter({ max: 30, windowMs: 60_000 });

/** Drafts a reply with the webinar's AI agent for a human to review. Nothing is sent or saved. */
export async function POST(request: Request) {
  const session = await requireAttendant();
  if (!session) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!suggestLimiter.check(session.user.id)) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  const lead = await prisma.lead.findUnique({
    where: { id: parsed.data.leadId },
    select: { webinar: { select: { chatAiEnabled: true, chatAiModel: true, chatAiInstructions: true, title: true, offerTitle: true, offerPriceFinal: true, offerDisabled: true, offerLink: true } } }
  });
  if (!lead) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!lead.webinar.chatAiEnabled || !process.env.OPENAI_API_KEY) return NextResponse.json({ error: "ai_not_configured" }, { status: 409 });
  const history = await prisma.leadChatMessage.findMany({
    where: { leadId: parsed.data.leadId }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 20, select: { sender: true, text: true }
  });
  if (history[0]?.sender !== "lead") return NextResponse.json({ error: "nothing_to_answer" }, { status: 409 });
  try {
    const text = await generateAnswer(lead.webinar.chatAiModel, webinarAiInstructions(lead.webinar), history.reverse());
    return NextResponse.json({ text }, { headers: { "cache-control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "ai_unavailable" }, { status: 502 });
  }
}
