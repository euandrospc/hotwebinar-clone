import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "db";
import { resolveLeadRequest } from "@/server/lead-request";
import { enqueueWebhook } from "@/lib/webhook";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const lead = await resolveLeadRequest(request, cookieStore);
  if (!lead) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

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
