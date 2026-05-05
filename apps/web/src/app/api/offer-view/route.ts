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

  const existing = await prisma.event.findFirst({
    where: { webinarId: lead.webinarId, leadId: lead.id, kind: "OFFER_VIEW" }
  });
  if (existing) return NextResponse.json({ ok: true });

  await prisma.event.create({
    data: { webinarId: lead.webinarId, leadId: lead.id, kind: "OFFER_VIEW" }
  });
  await enqueueWebhook(lead.webinar, "lead_viu_oferta", lead);
  return NextResponse.json({ ok: true });
}
