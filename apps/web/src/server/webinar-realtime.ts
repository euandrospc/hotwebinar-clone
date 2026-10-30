import { prisma } from "db";
import { getOnlineSnapshot } from "@/lib/online";
import { buildWebinarRealtimeSnapshot, type WebinarRealtimeSnapshot } from "@/lib/webinar-realtime";

// Callers must verify ownership before requesting a webinar snapshot.
export async function getWebinarRealtimeSnapshot(webinarId: string): Promise<WebinarRealtimeSnapshot> {
  const online = await getOnlineSnapshot();
  const leads = online.byWebinar.has(webinarId)
    ? await prisma.lead.findMany({
        where: { webinarId, id: { in: [...online.leadIds] } },
        select: { userAgent: true, city: true, region: true, country: true, lat: true, lng: true }
      })
    : [];
  return buildWebinarRealtimeSnapshot(leads);
}
