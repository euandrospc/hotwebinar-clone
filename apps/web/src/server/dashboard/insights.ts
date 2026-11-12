import { prisma } from "db";
import { ownerScope, type AccessUser } from "@/lib/webinar-access";
import { DASHBOARD_EVENT_KINDS } from "@/lib/dashboard-overview";
import { buildDashboardInsights, dashboardComparisonRange, type DashboardInsights } from "@/lib/dashboard-insights";

/** Every query is scoped to the webinars the user may access (all for admins) and, optionally, the selected webinar. */
export async function getDashboardInsights(viewer: AccessUser, rangeStart: Date, rangeEnd: Date, webinarId?: string): Promise<DashboardInsights> {
  if (!viewer?.id) throw new Error("Dashboard owner is required");
  const previous = dashboardComparisonRange(rangeStart, rangeEnd);
  const webinarWhere = { ...ownerScope(viewer), ...(webinarId === undefined ? {} : { id: webinarId }) };
  const createdAt = { gte: rangeStart, lte: rangeEnd };
  const [webinars, leads, viewerGroups, messages, sales] = await Promise.all([
    prisma.webinar.findMany({
      where: webinarWhere,
      select: { id: true, pitchAtSec: true, video: { select: { durationSec: true } } }
    }),
    prisma.lead.findMany({
      where: {
        webinar: webinarWhere,
        events: { some: { webinar: webinarWhere, kind: { in: [...DASHBOARD_EVENT_KINDS] }, createdAt } }
      },
      select: { id: true, webinarId: true, watchedSec: true, country: true, region: true }
    }),
    prisma.event.groupBy({
      by: ["webinarId", "leadId"],
      where: { webinar: webinarWhere, kind: "VIDEO_TICK", leadId: { not: null }, createdAt },
      _max: { videoSec: true }
    }),
    prisma.leadChatMessage.findMany({
      where: { webinar: webinarWhere, sender: { in: ["lead", "team"] }, createdAt },
      select: {
        id: true, webinarId: true, leadId: true, sender: true, aiAgentName: true, createdAt: true,
        authorUserId: true, authorUser: { select: { name: true, image: true } }
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }]
    }),
    prisma.sale.findMany({
      where: { webinar: webinarWhere, createdAt: { gte: previous.start, lte: rangeEnd } },
      select: { id: true, webinarId: true, amount: true, currency: true, createdAt: true }
    })
  ]);
  return buildDashboardInsights({
    webinars: webinars.map((webinar) => ({ id: webinar.id, pitchAtSec: webinar.pitchAtSec, videoDurationSec: webinar.video?.durationSec ?? null })),
    leads,
    viewers: viewerGroups.map((group) => ({ webinarId: group.webinarId, leadId: group.leadId, maxVideoSec: group._max.videoSec })),
    messages, sales, rangeStart, rangeEnd
  });
}
