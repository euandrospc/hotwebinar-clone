import { NextResponse } from "next/server";
import { prisma } from "db";
import { requireAttendant } from "@/lib/attendant-session";

const ANONYMOUS_EMAIL = /@no-email\.invalid$/;

/** Contact details, room journey, AI activity and internal notes for one inbox conversation. */
export async function GET(request: Request) {
  const session = await requireAttendant();
  if (!session) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const leadId = new URL(request.url).searchParams.get("leadId");
  if (!leadId) return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: {
      id: true, email: true, phone: true, sessionStart: true, watchedSec: true, reachedPitch: true, pitchFired: true,
      webinar: { select: { pitchAtSec: true, video: { select: { durationSec: true } } } }
    }
  });
  if (!lead) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // The same person registers once per webinar; email (or phone for anonymous rooms) links the visits.
  // shortcut: email/phone are not indexed alone, so this scans lead; add an index if the table grows large.
  const identity = [
    ...(!ANONYMOUS_EMAIL.test(lead.email) && lead.email ? [{ email: lead.email }] : []),
    ...(lead.phone ? [{ phone: lead.phone }] : [])
  ];
  const related = identity.length
    ? await prisma.lead.findMany({ where: { OR: identity }, select: { id: true, sessionStart: true, _count: { select: { leadChatMessages: true } } } })
    : [];
  const relatedIds = related.length ? related.map(row => row.id) : [lead.id];

  const firstEvent = (kind: "VIDEO_TICK" | "PITCH_REACHED" | "OFFER_CLICK", after?: Date) => prisma.event.findFirst({
    where: { leadId: lead.id, kind, ...(after ? { createdAt: { gte: after } } : {}) },
    orderBy: { createdAt: "asc" }, select: { createdAt: true }
  });
  const [firstOptin, entered, pitch, offerClick, sale, aiReplies, notes] = await Promise.all([
    prisma.event.findFirst({ where: { leadId: { in: relatedIds }, kind: "OPTIN" }, orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
    firstEvent("VIDEO_TICK", lead.sessionStart),
    firstEvent("PITCH_REACHED"),
    firstEvent("OFFER_CLICK"),
    prisma.sale.findFirst({ where: { leadId: lead.id }, orderBy: { createdAt: "asc" }, select: { createdAt: true, amount: true, currency: true } }),
    prisma.leadChatMessage.count({ where: { leadId: lead.id, aiAgentName: { not: null } } }),
    prisma.leadNote.findMany({
      where: { leadId: lead.id }, orderBy: { createdAt: "desc" }, take: 20,
      select: { id: true, text: true, createdAt: true, authorUser: { select: { name: true } } }
    })
  ]);
  const earliestSession = related.reduce<Date>((min, row) => row.sessionStart < min ? row.sessionStart : min, lead.sessionStart);

  return NextResponse.json({
    phone: lead.phone,
    firstAccessAt: (firstOptin?.createdAt ?? earliestSession).toISOString(),
    conversations: Math.max(1, related.filter(row => row._count.leadChatMessages > 0).length),
    journey: {
      enteredAt: entered?.createdAt.toISOString() ?? null,
      watchedSec: lead.watchedSec,
      videoDurationSec: lead.webinar.video?.durationSec ?? null,
      reachedPitch: lead.pitchFired || lead.reachedPitch,
      pitchAt: pitch?.createdAt.toISOString() ?? null,
      pitchAtSec: lead.webinar.pitchAtSec,
      offerClickAt: offerClick?.createdAt.toISOString() ?? null,
      purchasedAt: sale?.createdAt.toISOString() ?? null,
      purchaseAmount: sale ? { cents: sale.amount, currency: sale.currency } : null
    },
    aiReplies,
    notes: notes.map(note => ({ id: note.id, text: note.text, createdAt: note.createdAt.toISOString(), authorName: note.authorUser?.name ?? null }))
  }, { headers: { "cache-control": "private, no-store" } });
}
