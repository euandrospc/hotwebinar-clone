import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "db";
import { verifyLeadCookie } from "@/lib/lead-session";
import { enqueueWebhook } from "@/lib/webhook";

export async function POST() {
  const cookieStore = await cookies();
  const leadId = verifyLeadCookie(cookieStore.get("hw_lead")?.value);
  if (!leadId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const lead = await prisma.lead.findUnique({ where: { id: leadId }, include: { webinar: true } });
  if (!lead) return NextResponse.json({ error: "not_found" }, { status: 404 });

  await prisma.event.create({
    data: { webinarId: lead.webinarId, leadId: lead.id, kind: "OFFER_CLICK" }
  });
  const updated = await prisma.lead.update({
    where: { id: lead.id },
    data: { ctaClicks: { increment: 1 }, lastSeenAt: new Date() }
  });
  await enqueueWebhook(lead.webinar, "lead_clicou_oferta", updated);

  if (lead.webinar.offerRaffleEnabled) {
    await prisma.event.create({
      data: { webinarId: lead.webinarId, leadId: lead.id, kind: "RAFFLE_ENTRY" }
    });
    await enqueueWebhook(lead.webinar, "lead_entrou_sorteio", updated);
  }

  return NextResponse.json({ ok: true });
}
