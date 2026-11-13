import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "db";
import { requireAttendant } from "@/lib/attendant-session";

const schema = z.object({ leadId: z.string().min(1), text: z.string().trim().min(1).max(1000) });

/** Adds an internal note to a conversation. Notes are staff-only and never reach the lead. */
export async function POST(request: Request) {
  const session = await requireAttendant();
  if (!session) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  const lead = await prisma.lead.findUnique({ where: { id: parsed.data.leadId }, select: { id: true } });
  if (!lead) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const note = await prisma.leadNote.create({
    data: { leadId: lead.id, authorUserId: session.user.id, text: parsed.data.text },
    select: { id: true, text: true, createdAt: true, authorUser: { select: { name: true } } }
  });
  return NextResponse.json(
    { id: note.id, text: note.text, createdAt: note.createdAt.toISOString(), authorName: note.authorUser?.name ?? null },
    { status: 201 }
  );
}
