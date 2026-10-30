import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "db";
import { getOnlineSnapshot } from "@/lib/online";

// Real "online now" count for the admin: leads whose player sent a heartbeat
// (/api/track updates lastSeenAt, throttled to 25s) within the recent window and
// haven't fired the leave event. Scoped to the signed-in owner's webinars.

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const snap = await getOnlineSnapshot();
  // Only the owner's webinars that have people right now.
  const webinars = snap.byWebinar.size
    ? await prisma.webinar.findMany({
        where: { id: { in: [...snap.byWebinar.keys()] }, ownerId: session.user.id },
        select: { id: true, title: true, name: true }
      })
    : [];
  const byWebinar = webinars
    .map((w) => ({ webinarId: w.id, title: w.title || w.name || "Webinar", online: snap.byWebinar.get(w.id) ?? 0 }))
    .sort((a, b) => b.online - a.online);
  const online = byWebinar.reduce((n, w) => n + w.online, 0);

  return NextResponse.json({ online, byWebinar }, { headers: { "cache-control": "no-store" } });
}
