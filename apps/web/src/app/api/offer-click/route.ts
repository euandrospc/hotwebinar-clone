import { publishFunnelEvent } from "@/server/realtime/bus";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "db";
import { resolveLeadRequest } from "@/server/lead-request";
import { enqueueWebhook } from "@/lib/webhook";
import { offerClickLimiter } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const lead = await resolveLeadRequest(request, cookieStore);
  if (!lead) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Throttle per lead: without this, a loop of POSTs inflates ctaClicks/metrics,
  // spams webhooks, and stuffs raffle entries (unbounded Event writes = DoS).
  if (!offerClickLimiter.check(lead.id)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  await prisma.event.create({
    data: { webinarId: lead.webinarId, leadId: lead.id, kind: "OFFER_CLICK" }
  });
  const updated = await prisma.lead.update({
    where: { id: lead.id },
    data: { ctaClicks: { increment: 1 }, lastSeenAt: new Date() }
  });
  if (lead.ctaClicks === 0) await publishFunnelEvent(lead.webinarId);
  await enqueueWebhook(lead.webinar, "lead_clicou_oferta", updated);

  if (lead.webinar.offerRaffleEnabled) {
    // One raffle entry per lead: skip if this lead already entered.
    const already = await prisma.event.findFirst({
      where: { leadId: lead.id, webinarId: lead.webinarId, kind: "RAFFLE_ENTRY" },
      select: { id: true }
    });
    if (!already) {
      await prisma.event.create({
        data: { webinarId: lead.webinarId, leadId: lead.id, kind: "RAFFLE_ENTRY" }
      });
      await enqueueWebhook(lead.webinar, "lead_entrou_sorteio", updated);
    }
  }

  return NextResponse.json({ ok: true });
}
