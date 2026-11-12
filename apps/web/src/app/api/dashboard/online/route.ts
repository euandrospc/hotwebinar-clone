import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { ownerScope } from "@/lib/webinar-access";
import { prisma } from "db";
import { getOnlineSnapshot } from "@/lib/online";
import type { RealtimeAudienceHistory } from "@/lib/dashboard-realtime-preview";

const responseHeaders = { "cache-control": "private, no-store" };

// Real "online now" count for the admin: leads whose player sent a heartbeat
// (/api/track updates lastSeenAt, throttled to 25s) within the recent window and
// haven't fired the leave event. Scoped to the signed-in owner's webinars.

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: responseHeaders });

  const webinarId = new URL(request.url).searchParams.get("webinarId");
  try {
    if (webinarId) {
      const webinar = await prisma.webinar.findFirst({
        where: { id: webinarId, ...ownerScope(session) }, select: { id: true }
      });
      if (!webinar) return NextResponse.json({ error: "Not found" }, { status: 404, headers: responseHeaders });
    }
    const to = new Date();
    const from = new Date(to.getTime() - 60 * 60 * 1000);
    const [snap, samples] = await Promise.all([
      getOnlineSnapshot(),
      webinarId ? prisma.audienceSample.findMany({
        where: { webinarId, webinar: ownerScope(session), observedAt: { gte: from, lte: to } },
        orderBy: [{ observedAt: "asc" }, { sampledAt: "asc" }],
        select: { observedAt: true, online: true }
      }) : Promise.resolve([])
    ]);
    // Keep the existing owner-wide live count; only history uses the requested scope.
    const webinars = snap.byWebinar.size
      ? await prisma.webinar.findMany({
          where: { id: { in: [...snap.byWebinar.keys()] }, ...ownerScope(session) },
          select: { id: true, title: true, name: true }
        })
      : [];
    const byWebinar = webinars
      .map((w) => ({ webinarId: w.id, title: w.title || w.name || "Webinar", online: snap.byWebinar.get(w.id) ?? 0 }))
      .sort((a, b) => b.online - a.online);
    const online = byWebinar.reduce((n, w) => n + w.online, 0);
    // Missing observations stay missing, and current presence is not a historical sample.
    const audience: RealtimeAudienceHistory = {
      windowMinutes: 60, from: from.toISOString(), to: to.toISOString(),
      sampleCount: samples.length,
      average: samples.length ? samples.reduce((sum, sample) => sum + sample.online, 0) / samples.length : null,
      peak: samples.length ? Math.max(...samples.map((sample) => sample.online)) : null,
      points: samples.map((sample) => ({ at: sample.observedAt.toISOString(), online: sample.online }))
    };

    return NextResponse.json({ online, byWebinar, audience }, { headers: responseHeaders });
  } catch {
    return NextResponse.json({ error: "Unable to load audience" }, { status: 500, headers: responseHeaders });
  }
}
