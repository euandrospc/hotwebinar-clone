import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { prisma } from "db";
import { verifyLeadCookie } from "@/lib/lead-session";
import { enqueueWebhook } from "@/lib/webhook";

const inputSchema = z.object({ ctaId: z.string().min(1) });

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const leadId = verifyLeadCookie(cookieStore.get("hw_lead")?.value);
  if (!leadId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as unknown;
  const parsed = inputSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid_input" }, { status: 400 });

  const lead = await prisma.lead.findUnique({ where: { id: leadId }, include: { webinar: true } });
  if (!lead) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const cta = await prisma.cta.findUnique({ where: { id: parsed.data.ctaId } });
  if (!cta || cta.webinarId !== lead.webinarId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  await prisma.event.create({
    data: { webinarId: lead.webinarId, leadId: lead.id, kind: "CTA_CLICK", ctaId: cta.id }
  });
  const updated = await prisma.lead.update({
    where: { id: lead.id },
    data: { ctaClicks: { increment: 1 }, lastSeenAt: new Date() }
  });
  await enqueueWebhook(lead.webinar, "lead_clicou_oferta", updated, { ctaId: cta.id });

  return NextResponse.json({ ok: true });
}
