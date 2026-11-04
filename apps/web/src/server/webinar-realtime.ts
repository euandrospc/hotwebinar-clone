import { getAudienceSummary } from "./audience-history";
import { zonedParts, zonedToUtc } from "@/lib/timezones";
import { buildSalesKpis } from "@/lib/dashboard-stats";
import { withOccurrence } from "@/lib/sync";
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
  const now = new Date();
  const webinar = await prisma.webinar.findUnique({
    where: { id: webinarId },
    select: { mode: true, startDate: true, endDate: true, recurring: true,
      recurringDays: true, timezone: true, pitchAtSec: true,
      offerShowAtSec: true, offerHideAtSec: true, offerDisabled: true, videoSyncWithStart: true }
  });
  const timezone = !webinar?.timezone || webinar.timezone === "__auto__" ? "America/Sao_Paulo" : webinar.timezone;
  const today = zonedParts(now, timezone);
  const dayRange = {
    gte: zonedToUtc(today.y, today.mo, today.d, 0, 0, 0, timezone),
    lt: zonedToUtc(today.y, today.mo, today.d + 1, 0, 0, 0, timezone)
  };
  const todayLeads = { webinarId, sessionStart: dayRange };
  // Today's sessions and purchases, in the webinar's timezone.

  const [visits, entered, pitch, clicked, sales] = await Promise.all([
    prisma.lead.count({ where: { ...todayLeads } }),
    prisma.lead.count({ where: { ...todayLeads, enterFired: true } }),
    prisma.lead.count({ where: { ...todayLeads, OR: [{ reachedPitch: true }, { pitchFired: true }] } }),
    prisma.lead.count({ where: { ...todayLeads, ctaClicks: { gt: 0 } } }),
    prisma.sale.findMany({ where: { webinarId, createdAt: dayRange }, select: { amount: true, buyerEmail: true, leadId: true } })
  ]);
  const counts = [visits, entered, pitch, clicked, buildSalesKpis(sales).uniqueBuyers];
  const labels = ["Visitas", "Acessou o webinar", "Chegou no pitch", "Clicou na oferta", "Comprou"];
  const audience = await getAudienceSummary(webinarId, dayRange.gte, new Date(Math.min(Date.now(), dayRange.lt.getTime() - 1)));
  const snapshot = {
    audience,
    ...buildWebinarRealtimeSnapshot(leads, new Date()),
    funnel: counts.map((count, index) => ({ label: labels[index], count,
      pct: visits > 0 ? Math.round(count / visits * 10000) / 100 : 0 }))
  };
  if (!webinar) return snapshot;
  const occurrence = withOccurrence(webinar, now);
  return { ...snapshot, schedule: {
    mode: occurrence.mode,
    startDate: occurrence.startDate?.toISOString() ?? null,
    endDate: occurrence.endDate?.toISOString() ?? null,
    pitchAtSec: occurrence.pitchAtSec,
    offerShowAtSec: occurrence.offerShowAtSec,
    offerHideAtSec: occurrence.offerHideAtSec,
    offerDisabled: occurrence.offerDisabled,
    videoSyncWithStart: occurrence.videoSyncWithStart
  } };
}
