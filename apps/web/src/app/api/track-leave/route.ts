import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { prisma } from "db";
import { verifyLeadCookie } from "@/lib/lead-session";
import { enqueueWebhook } from "@/lib/webhook";

const inputSchema = z.object({ videoSec: z.number().int().min(0).optional() });

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const leadId = verifyLeadCookie(cookieStore.get("hw_lead")?.value);
  if (!leadId) return new NextResponse(null, { status: 204 });

  const body = (await request.json().catch(() => null)) as unknown;
  const parsed = inputSchema.safeParse(body);
  const videoSec = parsed.success ? parsed.data.videoSec : undefined;

  const lead = await prisma.lead.findUnique({ where: { id: leadId }, include: { webinar: true } });
  if (!lead) return new NextResponse(null, { status: 204 });

  await prisma.event.create({
    data: { webinarId: lead.webinarId, leadId: lead.id, kind: "VIDEO_END", videoSec }
  });

  // Atomic compare-and-swap for leaveFired
  if (!lead.leaveFired) {
    const r = await prisma.lead.updateMany({
      where: { id: lead.id, leaveFired: false },
      data: { leaveFired: true, lastSeenAt: new Date() }
    });
    if (r.count === 1) {
      const updated = await prisma.lead.findUnique({ where: { id: lead.id } });
      if (updated) {
        await enqueueWebhook(lead.webinar, "lead_saiu", updated, { videoSec });
      }
    }
  }

  return new NextResponse(null, { status: 204 });
}
