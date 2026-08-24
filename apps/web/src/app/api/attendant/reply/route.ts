import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "db";
import { requireAttendant } from "@/lib/attendant-session";

const schema = z.object({ leadId: z.string().min(1), text: z.string().min(1).max(500) });

export async function POST(request: Request) {
  const session = await requireAttendant();
  if (!session) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  const lead = await prisma.lead.findUnique({ where: { id: parsed.data.leadId }, select: { id: true, webinarId: true } });
  if (!lead) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const msg = await prisma.leadChatMessage.create({
    data: { leadId: lead.id, webinarId: lead.webinarId, text: parsed.data.text, sender: "team", authorUserId: session.user.id }
  });
  return NextResponse.json({ id: msg.id }, { status: 201 });
}
