import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ADMIN_LOGIN_PATH } from "@/lib/admin-paths";
import { prisma } from "db";
import {
  buildFunnel,
  buildDailyParticipants,
  buildDeviceBreakdown,
  avgWatchedMinutes
} from "@/lib/dashboard-stats";
import { DashboardKpis } from "@/components/dashboard/dashboard-kpis";
import { DashboardFunnel } from "@/components/dashboard/dashboard-funnel";
import { DashboardParticipantesChart } from "@/components/dashboard/dashboard-participantes-chart";
import { DashboardDispositivosChart } from "@/components/dashboard/dashboard-dispositivos-chart";
import { DashboardRegionCard } from "@/components/dashboard/dashboard-region-card";
import { DashboardCalendar } from "@/components/dashboard/dashboard-calendar";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect(ADMIN_LOGIN_PATH);

  const rangeEnd = new Date();
  const rangeStart = new Date();
  rangeStart.setDate(rangeStart.getDate() - 5);
  rangeStart.setHours(0, 0, 0, 0);

  const [leads, webinars, firstWebinar] = await Promise.all([
    prisma.lead.findMany({
      where: {
        webinar: { ownerId: session.user.id },
        sessionStart: { gte: rangeStart, lte: rangeEnd }
      },
      select: {
        sessionStart: true,
        enterFired: true,
        reachedPitch: true,
        ctaClicks: true,
        userAgent: true,
        watchedSec: true
      }
    }),
    prisma.webinar.findMany({
      where: { ownerId: session.user.id, startDate: { not: null } },
      select: { startDate: true }
    }),
    prisma.webinar.findFirst({
      where: { ownerId: session.user.id },
      orderBy: { createdAt: "desc" },
      select: { id: true }
    })
  ]);

  const input = {
    leads: leads.map((l) => ({
      sessionStart: l.sessionStart,
      enterFired: l.enterFired,
      reachedPitch: l.reachedPitch,
      ctaClicks: l.ctaClicks,
      userAgent: l.userAgent
    })),
    rangeStart,
    rangeEnd,
    scheduledDates: webinars.map((w) => w.startDate!).filter(Boolean)
  };

  const funnel = buildFunnel(input);
  const participantes = buildDailyParticipants(input);
  const devices = buildDeviceBreakdown(input);
  const avgMin = avgWatchedMinutes(leads);
  const scheduledIso = webinars
    .map((w) => w.startDate?.toISOString())
    .filter((s): s is string => Boolean(s));

  const fmtRange = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold">Dashboard geral</h1>
        <div className="flex items-center gap-2 rounded-md border bg-card px-3 py-1.5 text-xs text-muted-foreground">
          <span aria-hidden>👁</span>
          <span>{fmtRange.format(rangeStart)} ~ {fmtRange.format(rangeEnd)}</span>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        <DashboardKpis avgMinutes={avgMin} />

        <DashboardFunnel stages={funnel} />

        <div className="grid gap-4 lg:grid-cols-[1fr_minmax(0,400px)]">
          <DashboardParticipantesChart data={participantes} />
          <DashboardDispositivosChart devices={devices} />
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_minmax(0,360px)]">
          <DashboardRegionCard firstWebinarId={firstWebinar?.id ?? null} />
          <DashboardCalendar scheduledDates={scheduledIso} />
        </div>
      </div>
    </div>
  );
}
