import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { prisma } from "db";
import { verifyLeadCookie } from "@/lib/lead-session";
import { leadChatLimiter } from "@/lib/rate-limit";

const inputSchema = z.object({
  text: z.string().min(1).max(500),
  videoSec: z.number().int().min(0).optional()
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

  const msg = await prisma.leadChatMessage.create({
    data: {
      leadId: lead.id,
      webinarId: lead.webinarId,
      text: parsed.data.text,
      videoSec: parsed.data.videoSec
    }
  });

  return NextResponse.json({
    id: msg.id, text: msg.text, videoSec: msg.videoSec, createdAt: msg.createdAt
  });
}

export async function GET(request: Request) {
  const cookieStore = await cookies();
  const leadId = verifyLeadCookie(cookieStore.get("hw_lead")?.value);
  if (!leadId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const after = url.searchParams.get("after");
  let createdAtGt: Date | undefined;
  if (after) {
    const cursor = await prisma.leadChatMessage.findFirst({ where: { id: after, leadId }, select: { createdAt: true } });
    createdAtGt = cursor?.createdAt;
  }

  const rows = await prisma.leadChatMessage.findMany({
    where: { leadId, ...(createdAtGt ? { createdAt: { gt: createdAtGt } } : {}) },
    orderBy: { createdAt: "asc" },
    select: { id: true, text: true, sender: true, videoSec: true, createdAt: true }
  });

  return NextResponse.json(
    { messages: rows.map((m) => ({ id: m.id, text: m.text, sender: m.sender, videoSec: m.videoSec, createdAt: m.createdAt.toISOString() })) },
    { headers: { "cache-control": "no-store" } }
  );
}
