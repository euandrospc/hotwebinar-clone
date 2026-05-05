import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { prisma } from "db";
import { verifyLeadCookie } from "@/lib/lead-session";
import { enqueueWebhook } from "@/lib/webhook";

const inputSchema = z.object({
  videoSec: z.number().int().min(0),
  watchedSecDelta: z.number().int().min(0).max(60)
});

const THROTTLE_MS = 25_000;

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const leadId = verifyLeadCookie(cookieStore.get("hw_lead")?.value);
  if (!leadId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as unknown;
  const parsed = inputSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid_input" }, { status: 400 });

  const lead = await prisma.lead.findUnique({ where: { id: leadId }, include: { webinar: true } });
  if (!lead) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const now = new Date();
  if (now.getTime() - lead.lastSeenAt.getTime() < THROTTLE_MS) {
    return NextResponse.json({ error: "throttled" }, { status: 429 });
  }

  const newWatched = lead.watchedSec + parsed.data.watchedSecDelta;

  await prisma.event.create({
    data: { webinarId: lead.webinarId, leadId: lead.id, kind: "VIDEO_TICK", videoSec: parsed.data.videoSec }
  });

  // Always update watchedSec + lastSeenAt
  await prisma.lead.update({
    where: { id: lead.id },
    data: { watchedSec: newWatched, lastSeenAt: now }
  });

  const w = lead.webinar;

  // Atomic compare-and-swap for pitchFired
  if (
    w.pitchAtSec != null &&
    parsed.data.videoSec >= w.pitchAtSec &&
    !lead.pitchFired
  ) {
    const r = await prisma.lead.updateMany({
      where: { id: lead.id, pitchFired: false },
      data: { pitchFired: true }
    });
    if (r.count === 1) {
      const updated = await prisma.lead.findUnique({ where: { id: lead.id } });
      if (updated) {
        await prisma.event.create({
          data: { webinarId: w.id, leadId: lead.id, kind: "PITCH_REACHED", videoSec: parsed.data.videoSec }
        });
        await enqueueWebhook(w, "lead_viu_pitch", updated, { videoSec: parsed.data.videoSec });
      }
    }
  }

  // Atomic compare-and-swap for permanenceFired
  if (
    w.permanenceThresholdSec > 0 &&
    newWatched >= w.permanenceThresholdSec &&
    !lead.permanenceFired
  ) {
    const r = await prisma.lead.updateMany({
      where: { id: lead.id, permanenceFired: false },
      data: { permanenceFired: true }
    });
    if (r.count === 1) {
      const updated = await prisma.lead.findUnique({ where: { id: lead.id } });
      if (updated) {
        await enqueueWebhook(w, "lead_permaneceu", updated, { videoSec: parsed.data.videoSec });
      }
    }
  }

  return NextResponse.json({ ok: true });
}
