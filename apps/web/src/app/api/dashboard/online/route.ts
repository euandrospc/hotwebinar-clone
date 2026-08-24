import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "db";

// Real "online now" count for the admin: leads whose player sent a heartbeat
// (/api/track updates lastSeenAt, throttled to 25s) within the recent window and
// haven't fired the leave event. Scoped to the signed-in owner's webinars.
const ONLINE_WINDOW_MS = 45_000; // ~2 heartbeat intervals of tolerance

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const since = new Date(Date.now() - ONLINE_WINDOW_MS);
  const where = {
    lastSeenAt: { gte: since },
    leaveFired: false,
    webinar: { ownerId: session.user.id }
  } as const;

  const [online, grouped] = await Promise.all([
    prisma.lead.count({ where }),
    prisma.lead.groupBy({ by: ["webinarId"], where, _count: { _all: true } })
  ]);

  // Attach webinar titles for the per-webinar breakdown (only the ones with people).
  const ids = grouped.map((g) => g.webinarId);
  const webinars = ids.length
    ? await prisma.webinar.findMany({
        where: { id: { in: ids } },
        select: { id: true, title: true, name: true }
      })
    : [];
  const titleById = new Map(webinars.map((w) => [w.id, w.title || w.name || "Webinar"]));
  const byWebinar = grouped
    .map((g) => ({ webinarId: g.webinarId, title: titleById.get(g.webinarId) ?? "Webinar", online: g._count._all }))
    .sort((a, b) => b.online - a.online);

  return NextResponse.json({ online, byWebinar }, { headers: { "cache-control": "no-store" } });
}
