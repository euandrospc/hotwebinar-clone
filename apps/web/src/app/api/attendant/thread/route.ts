import { NextResponse } from "next/server";
import { prisma } from "db";
import { requireAttendant } from "@/lib/attendant-session";

export async function GET(request: Request) {
  const session = await requireAttendant();
  if (!session) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const url = new URL(request.url);
  const leadId = url.searchParams.get("leadId");
  if (!leadId) return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  const after = url.searchParams.get("after");
  let gt: Date | undefined;
  if (after) {
    const c = await prisma.leadChatMessage.findUnique({ where: { id: after }, select: { createdAt: true } });
    gt = c?.createdAt;
  }
  const rows = await prisma.leadChatMessage.findMany({
    where: { leadId, ...(gt ? { createdAt: { gt } } : {}) },
    orderBy: { createdAt: "asc" },
    select: { id: true, text: true, sender: true, createdAt: true }
  });
  return NextResponse.json(
    { messages: rows.map((m) => ({ id: m.id, text: m.text, sender: m.sender, createdAt: m.createdAt.toISOString() })) },
    { headers: { "cache-control": "no-store" } }
  );
}
