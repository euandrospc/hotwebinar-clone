import type { Metadata } from "next";
import { AdminPage, AdminPageHeader } from "@/components/admin/admin-page";
import { getAudienceSummary } from "@/server/audience-history";
import { AudienceSummary } from "@/components/dashboard/audience-summary";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAccessWebinar } from "@/lib/webinar-access";
import { prisma } from "db";
import { WebinarTabs } from "@/components/webinar/webinar-tabs";
import { DashboardRangePicker } from "@/components/dashboard/dashboard-range-picker";
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

export const metadata: Metadata = { title: "Métricas do webinar" };

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
  if (!canAccessWebinar(session, webinar)) notFound();

  const { rangeStart, rangeEnd } = parseRange(sp.from, sp.to);
  const inRange = { gte: rangeStart, lte: rangeEnd };
  const audience = await getAudienceSummary(id, rangeStart, rangeEnd);

  const [leads, events, chatLeads, salesCount] = await Promise.all([
    prisma.lead.findMany({
      where: { webinarId: id, sessionStart: inRange },
      select: {
        sessionStart: true,
        enterFired: true,
        reachedPitch: true,
        pitchFired: true,
        leaveFired: true,
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
    saiuAntesPitch: leads.filter((l) => l.leaveFired && !l.pitchFired && !l.reachedPitch).length,
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
    <AdminPage>
      <WebinarTabs webinarId={id} />

      <AdminPageHeader title="Métricas" description={webinar.title || "Resultados do período selecionado"} actions={
        <DashboardRangePicker appearance="v2" initialFrom={toIsoDate(rangeStart)} initialTo={toIsoDate(rangeEnd)} initialFromTime={toIsoTime(rangeStart)} initialToTime={toIsoTime(rangeEnd)} />
      } />

      <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_260px] xl:items-start">
        <div className="min-w-0 space-y-4">
          <AudienceSummary data={audience} timezone={webinar.timezone} />
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
          <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2">
            <DashboardParticipantesChart data={participantes} />
            <DashboardDispositivosChart devices={devices} />
          </div>
        </div>

        <div className="min-w-0">
          <MetricsKpiList kpis={kpis} webinarId={id} />
        </div>
      </div>
    </AdminPage>
  );
}
