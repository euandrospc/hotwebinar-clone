import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "db";
import { WebinarTabs } from "@/components/webinar/webinar-tabs";
import { DashboardRangePicker } from "@/components/dashboard/dashboard-range-picker";
import { OnlineNowCard } from "@/components/dashboard/online-now-card";
import { DashboardParticipantesChart } from "@/components/dashboard/dashboard-participantes-chart";
import { DashboardDispositivosChart } from "@/components/dashboard/dashboard-dispositivos-chart";
import { MetricsVideoRetention } from "@/components/dashboard/metrics-video-retention";
import { MetricsConversionFunnel } from "@/components/dashboard/metrics-conversion-funnel";
import { MetricsKpiList } from "@/components/dashboard/metrics-kpi-list";
import {
  buildDailyParticipants,
  buildDeviceBreakdown,
  buildRetention,
  type WebinarKpis
} from "@/lib/dashboard-stats";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}

function parseRange(from: string | undefined, to: string | undefined): { rangeStart: Date; rangeEnd: Date } {
  const now = new Date();
  const fallbackEnd = new Date(now);
  fallbackEnd.setHours(23, 59, 0, 0);
  const fallbackStart = new Date(now);
  fallbackStart.setDate(fallbackStart.getDate() - 30);
  fallbackStart.setHours(0, 0, 0, 0);
  const rangeStart = from ? new Date(from) : fallbackStart;
  const rangeEnd = to ? new Date(to) : fallbackEnd;
  if (Number.isNaN(rangeStart.getTime()) || Number.isNaN(rangeEnd.getTime())) {
    return { rangeStart: fallbackStart, rangeEnd: fallbackEnd };
  }
  return { rangeStart, rangeEnd };
}

const toIsoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const toIsoTime = (d: Date) =>
  `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

export default async function MetricsPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const sp = await searchParams;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) notFound();

  const webinar = await prisma.webinar.findUnique({
    where: { id },
    include: { video: { select: { durationSec: true } } }
  });
  if (!webinar || webinar.ownerId !== session.user.id) notFound();

  const { rangeStart, rangeEnd } = parseRange(sp.from, sp.to);
  const inRange = { gte: rangeStart, lte: rangeEnd };

  const [leads, events, chatLeads, salesCount] = await Promise.all([
    prisma.lead.findMany({
      where: { webinarId: id, sessionStart: inRange },
      select: {
        sessionStart: true,
        enterFired: true,
        reachedPitch: true,
        pitchFired: true,
        ctaClicks: true,
        watchedSec: true,
        userAgent: true
      }
    }),
    prisma.event.findMany({
      where: {
        webinarId: id,
        kind: { in: ["VIDEO_START", "OFFER_VIEW", "OFFER_CLICK"] },
        leadId: { not: null },
        createdAt: inRange
      },
      select: { kind: true, leadId: true }
    }),
    prisma.leadChatMessage.findMany({
      where: { webinarId: id, sender: "lead" },
      select: { leadId: true },
      distinct: ["leadId"]
    }),
    prisma.sale.count({ where: { webinarId: id, createdAt: inRange } })
  ]);

  const distinctLeadsFor = (kind: string) =>
    new Set(events.filter((e) => e.kind === kind && e.leadId).map((e) => e.leadId)).size;

  const watchedSecs = leads.map((l) => l.watchedSec);
  const watchedAtLeast = (min: number) => leads.filter((l) => l.watchedSec >= min).length;

  const offerShowSec = webinar.offerShowAtSec ?? null;
  const kpis: WebinarKpis = {
    visitas: leads.length,
    acessou: leads.filter((l) => l.enterFired).length,
    clicouVideo: distinctLeadsFor("VIDEO_START") || leads.filter((l) => l.watchedSec > 0).length,
    min15: watchedAtLeast(900),
    min30: watchedAtLeast(1800),
    min45: watchedAtLeast(2700),
    min60: watchedAtLeast(3600),
    pitch: leads.filter((l) => l.reachedPitch || l.pitchFired).length,
    oferta:
      distinctLeadsFor("OFFER_VIEW") ||
      (offerShowSec != null ? leads.filter((l) => l.watchedSec >= offerShowSec).length : 0),
    cliqueOferta: Math.max(distinctLeadsFor("OFFER_CLICK"), leads.filter((l) => l.ctaClicks > 0).length),
    chat: chatLeads.length,
    comprou: salesCount
  };

  const durationSec = webinar.video?.durationSec ?? Math.max(60, ...watchedSecs, 0);
  const retention = buildRetention(watchedSecs, durationSec);
  const participantes = buildDailyParticipants({
    leads: leads.map((l) => ({
      sessionStart: l.sessionStart,
      enterFired: l.enterFired,
      reachedPitch: l.reachedPitch,
      ctaClicks: l.ctaClicks,
      userAgent: l.userAgent
    })),
    rangeStart,
    rangeEnd,
    scheduledDates: []
  });
  const devices = buildDeviceBreakdown({
    leads: leads.map((l) => ({
      sessionStart: l.sessionStart,
      enterFired: l.enterFired,
      reachedPitch: l.reachedPitch,
      ctaClicks: l.ctaClicks,
      userAgent: l.userAgent
    })),
    rangeStart,
    rangeEnd,
    scheduledDates: []
  });

  return (
    <div className="container mx-auto py-6">
      <WebinarTabs webinarId={id} />

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{webinar.title || "Métricas"}</h1>
        <DashboardRangePicker
          initialFrom={toIsoDate(rangeStart)}
          initialTo={toIsoDate(rangeEnd)}
          initialFromTime={toIsoTime(rangeStart)}
          initialToTime={toIsoTime(rangeEnd)}
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_minmax(0,340px)]">
        <div className="space-y-4">
          <MetricsVideoRetention data={retention} />
          <MetricsConversionFunnel
            data={{
              visitantes: kpis.visitas,
              participantes: kpis.acessou,
              assistiuVivo: kpis.acessou,
              assistiuReplay: 0,
              clicouVivo: kpis.cliqueOferta,
              clicouReplay: 0,
              comprou: kpis.comprou
            }}
          />
          <div className="grid gap-4 md:grid-cols-2">
            <DashboardParticipantesChart data={participantes} />
            <DashboardDispositivosChart devices={devices} />
          </div>
        </div>

        <div className="space-y-2.5">
          <OnlineNowCard webinarId={id} />
          <MetricsKpiList kpis={kpis} webinarId={id} />
        </div>
      </div>
    </div>
  );
}
