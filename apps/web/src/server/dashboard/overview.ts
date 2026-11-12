import { prisma } from "db";
import { ownerScope, type AccessUser } from "@/lib/webinar-access";
import {
  buildDashboardOverview,
  DASHBOARD_EVENT_KINDS,
  type DashboardOverview,
  type DashboardOverviewEvent
} from "@/lib/dashboard-overview";

/** Caller supplies the authenticated user. Non-admins are limited to their own webinars in every query; admins see all. */
export async function getDashboardOverview(viewer: AccessUser, rangeStart: Date, rangeEnd: Date, webinarId?: string): Promise<DashboardOverview> {
  if (!viewer?.id) throw new Error("Dashboard owner is required");
  if (!Number.isFinite(rangeStart.getTime()) || !Number.isFinite(rangeEnd.getTime()) || rangeStart > rangeEnd) {
    throw new RangeError("Invalid dashboard date range");
  }
  const createdAt = { gte: rangeStart, lte: rangeEnd };
  const webinarWhere = { ...ownerScope(viewer), ...(webinarId === undefined ? {} : { id: webinarId }) };
  const [webinars, eventGroups, sales] = await Promise.all([
    prisma.webinar.findMany({
      where: webinarWhere,
      select: { id: true, title: true, name: true, status: true, mode: true, pitchAtSec: true }
    }),
    prisma.event.groupBy({
      by: ["webinarId", "leadId", "kind"],
      where: {
        webinar: webinarWhere,
        leadId: { not: null },
        kind: { in: [...DASHBOARD_EVENT_KINDS] },
        createdAt
      },
      _min: { createdAt: true },
      _max: { videoSec: true }
    }),
    prisma.sale.findMany({
      where: { webinar: webinarWhere, createdAt },
      select: { id: true, webinarId: true, leadId: true, amount: true, currency: true, createdAt: true }
    })
  ]);
  const events: DashboardOverviewEvent[] = [];
  for (const group of eventGroups) {
    if (!group.leadId || !group._min.createdAt) continue;
    if (group.kind !== "OPTIN" && group.kind !== "VIDEO_TICK" && group.kind !== "PITCH_REACHED" && group.kind !== "OFFER_CLICK") continue;
    events.push({
      webinarId: group.webinarId, leadId: group.leadId, kind: group.kind,
      firstOccurredAt: group._min.createdAt, maxVideoSec: group._max.videoSec
    });
  }
  return buildDashboardOverview({ webinars, events, sales, rangeStart, rangeEnd });
}
