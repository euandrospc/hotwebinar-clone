import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ADMIN_LOGIN_PATH } from "@/lib/admin-paths";
import { prisma } from "db";
import {
  buildFunnel,
  buildDailyParticipants,
  buildDeviceBreakdown,
  buildSalesKpis,
  avgWatchedMinutes
} from "@/lib/dashboard-stats";
import { DashboardKpis } from "@/components/dashboard/dashboard-kpis";
import { DashboardFunnel } from "@/components/dashboard/dashboard-funnel";
import { DashboardParticipantesChart } from "@/components/dashboard/dashboard-participantes-chart";
import { DashboardDispositivosChart } from "@/components/dashboard/dashboard-dispositivos-chart";
import { DashboardRegionCard } from "@/components/dashboard/dashboard-region-card";
import { DashboardCalendar } from "@/components/dashboard/dashboard-calendar";
import { DashboardRangePicker } from "@/components/dashboard/dashboard-range-picker";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ from?: string; to?: string }>;
}

function parseRange(from: string | undefined, to: string | undefined): { rangeStart: Date; rangeEnd: Date } {
  const now = new Date();
  const fallbackEnd = new Date(now);
  fallbackEnd.setHours(23, 59, 0, 0);
  const fallbackStart = new Date(now);
  fallbackStart.setDate(fallbackStart.getDate() - 5);
  fallbackStart.setHours(0, 0, 0, 0);

  const rangeStart = from ? new Date(from) : fallbackStart;
  const rangeEnd = to ? new Date(to) : fallbackEnd;
  if (Number.isNaN(rangeStart.getTime()) || Number.isNaN(rangeEnd.getTime())) {
    return { rangeStart: fallbackStart, rangeEnd: fallbackEnd };
  }
  return { rangeStart, rangeEnd };
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect(ADMIN_LOGIN_PATH);

  const sp = await searchParams;
  const { rangeStart, rangeEnd } = parseRange(sp.from, sp.to);

  const [leads, webinars, firstWebinar, sales] = await Promise.all([
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
    }),
    prisma.sale.findMany({
      where: {
        webinar: { ownerId: session.user.id },
        createdAt: { gte: rangeStart, lte: rangeEnd }
      },
      select: { amount: true, buyerEmail: true, leadId: true }
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
  const salesKpis = buildSalesKpis(sales);
  const scheduledIso = webinars
    .map((w) => w.startDate?.toISOString())
    .filter((s): s is string => Boolean(s));

  const toIsoDate = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const toIsoTime = (d: Date) =>
    `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold">Dashboard geral</h1>
        <DashboardRangePicker
          initialFrom={toIsoDate(rangeStart)}
          initialTo={toIsoDate(rangeEnd)}
          initialFromTime={toIsoTime(rangeStart)}
          initialToTime={toIsoTime(rangeEnd)}
        />
      </div>

      <div className="mt-6 space-y-4">
        <DashboardKpis avgMinutes={avgMin} sales={salesKpis} />

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
