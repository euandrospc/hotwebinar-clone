import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { prisma } from "db";
import { auth } from "@/lib/auth";
import { ownerScope } from "@/lib/webinar-access";
import { ADMIN_LOGIN_PATH } from "@/lib/admin-paths";
import { DASHBOARD_TIME_ZONE } from "@/lib/dashboard-overview";
import { createDashboardDemo, isDashboardDemoEnabled } from "@/lib/dashboard-demo";
import { createChatIntelligenceDemo } from "@/lib/dashboard-chat-intelligence-demo";
import { zonedParts, zonedToUtc } from "@/lib/timezones";
import { getDashboardOverview } from "@/server/dashboard/overview";
import { getDashboardInsights } from "@/server/dashboard/insights";
import { getAdminBrandName } from "@/server/admin-brand";
import { DashboardSummary } from "@/components/dashboard/dashboard-summary";
import { DashboardFunnelOverview } from "@/components/dashboard/dashboard-funnel-overview";
import { DashboardMotion } from "@/components/dashboard/dashboard-motion";
import { DashboardWebinarPicker } from "@/components/dashboard/dashboard-webinar-picker";
import { DashboardWatchChart } from "@/components/dashboard/dashboard-watch-chart";
import { DashboardAudienceMap } from "@/components/dashboard/dashboard-audience-map";
import { DashboardSupportOverview } from "@/components/dashboard/dashboard-support-overview";
import { DashboardChatIntelligence } from "@/components/dashboard/dashboard-chat-intelligence";
import { DashboardRangePicker } from "@/components/dashboard/dashboard-range-picker";
import { DashboardLiveStatus } from "@/components/dashboard/dashboard-live-status";
import { ArrowUpRight } from "@/components/icons";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  return { title: { absolute: `Dashboard | ${await getAdminBrandName()}` } };
}

interface PageProps {
  searchParams: Promise<{ from?: string; to?: string; webinarId?: string; demo?: string }>;
}

// Unqualified date/time parameters are dashboard wall-clock time, not the
// server/container timezone. Explicit UTC/offset values remain absolute instants.
function parseParameter(value: string): Date {
  const local = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?)?$/);
  if (!local) return new Date(value);
  const [, year, month, day, hour = "00", minute = "00"] = local;
  const result = zonedToUtc(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), 0, DASHBOARD_TIME_ZONE);
  const parts = zonedParts(result, DASHBOARD_TIME_ZONE);
  return parts.y === Number(year) && parts.mo === Number(month) - 1 && parts.d === Number(day) && parts.h === Number(hour) && parts.mi === Number(minute) ? result : new Date(NaN);
}

function parseRange(from?: string, to?: string) {
  const today = zonedParts(new Date(), DASHBOARD_TIME_ZONE);
  const lastWeek = new Date(Date.UTC(today.y, today.mo, today.d - 6));
  const fallbackStart = zonedToUtc(lastWeek.getUTCFullYear(), lastWeek.getUTCMonth(), lastWeek.getUTCDate(), 0, 0, 0, DASHBOARD_TIME_ZONE);
  const fallbackEnd = zonedToUtc(today.y, today.mo, today.d, 23, 59, 59, DASHBOARD_TIME_ZONE);
  fallbackEnd.setUTCMilliseconds(999);
  const rangeStart = from ? parseParameter(from) : fallbackStart;
  const rangeEnd = to ? parseParameter(to) : fallbackEnd;
  if (!Number.isFinite(rangeStart.getTime()) || !Number.isFinite(rangeEnd.getTime()) || rangeStart > rangeEnd) {
    return { rangeStart: fallbackStart, rangeEnd: fallbackEnd };
  }
  // The picker has minute precision: include the complete final minute.
  rangeEnd.setUTCSeconds(59, 999);
  return { rangeStart, rangeEnd };
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect(ADMIN_LOGIN_PATH);
  const sp = await searchParams;
  const { rangeStart, rangeEnd } = parseRange(sp.from, sp.to);
  const demo = isDashboardDemoEnabled(sp.demo, process.env.NODE_ENV)
    ? createDashboardDemo(rangeStart, rangeEnd)
    : null;
  const webinars = demo ? [demo.webinar] : (await prisma.webinar.findMany({
    where: ownerScope(session),
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true, name: true, status: true, slug: true }
  })).map((webinar) => ({ ...webinar, title: webinar.title || webinar.name || "Sem título" }));
  const selectedWebinar = demo?.webinar ?? (sp.webinarId
    ? webinars.find((webinar) => webinar.id === sp.webinarId)
    : webinars.find((webinar) => webinar.status === "ACTIVE") ?? webinars[0]);
  if (sp.webinarId && !selectedWebinar) notFound();
  const [overview, insights] = demo ? [demo.overview, demo.insights] : await Promise.all([
    getDashboardOverview(session.user, rangeStart, rangeEnd, selectedWebinar?.id),
    getDashboardInsights(session.user, rangeStart, rangeEnd, selectedWebinar?.id)
  ]);
  const displayParts = (date: Date) => {
    const p = zonedParts(date, DASHBOARD_TIME_ZONE);
    return {
      date: `${p.y}-${String(p.mo + 1).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`,
      time: `${String(p.h).padStart(2, "0")}:${String(p.mi).padStart(2, "0")}`
    };
  };
  const from = displayParts(rangeStart);
  const to = displayParts(rangeEnd);
  const periodDays = Math.max(1, Math.round((rangeEnd.getTime() - rangeStart.getTime()) / 86_400_000));
  const periodLabel = `${formatPeriod(rangeStart, rangeEnd)} · comparado ${periodDays === 1 ? "ao dia anterior" : `aos ${periodDays} dias anteriores`}`;
  const roomSlug = demo ? undefined : (selectedWebinar as { slug?: string | null } | undefined)?.slug;
  const queryParams: Record<string, string> = {};
  if (process.env.NODE_ENV === "development") queryParams.demo = demo ? "1" : "0";
  const realWebinarId = demo ? sp.webinarId : selectedWebinar?.id;
  if (realWebinarId && realWebinarId !== "demo-webinar") queryParams.webinarId = realWebinarId;

  return (
    <div className="dashboard-v2 dark min-h-full w-full space-y-6 bg-[#0a0c0a] [--background:120_9%_4%] [--border:125_9%_13%] [--card:120_9%_5%] [--foreground:120_14%_96%] [--muted-foreground:133_4%_51%] [--muted:125_9%_11%] px-4 py-6 font-palco text-neutral-100 [color-scheme:dark] sm:px-6 lg:px-10 lg:pb-10 lg:pt-8">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4 pb-2">
        <div className="min-w-0 space-y-2">
          <DashboardLiveStatus webinarId={demo ? undefined : selectedWebinar?.id} demoOnline={demo?.online} />
          <h1 className="truncate font-palco-serif text-4xl leading-tight tracking-tight text-neutral-100 sm:text-[44px]">{selectedWebinar?.title ?? "Dashboard"}</h1>
          <p className="text-sm text-neutral-400">{periodLabel}</p>
        </div>
        <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">
          {webinars.length > 1 && <DashboardWebinarPicker webinars={webinars} selectedId={selectedWebinar?.id ?? ""} compact />}
          <DashboardRangePicker
            initialFrom={from.date}
            initialTo={to.date}
            initialFromTime={from.time}
            initialToTime={to.time}
            timeZone={DASHBOARD_TIME_ZONE}
            queryParams={queryParams}
            appearance="v2"
            className="rounded-[10px] border-[#1e241f] bg-[#0f130f] px-3.5 font-semibold text-neutral-100 hover:bg-[#151a15] [&>span]:text-sm [&_svg]:text-neutral-400"
          />
          {roomSlug && <a href={`/${roomSlug}`} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 rounded-[10px] bg-palco px-3.5 text-sm font-semibold text-palco-ink transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-palco">Abrir sala<ArrowUpRight className="size-4" /></a>}
        </div>
      </header>

      <div className="grid items-stretch gap-6 xl:grid-cols-[400px_minmax(0,1fr)]">
        <DashboardMotion className="min-w-0"><DashboardSummary totals={overview.totals} comparison={insights.comparison} /></DashboardMotion>
        <DashboardMotion className="min-w-0" delay={0.04}><DashboardWatchChart watch={insights.watch} /></DashboardMotion>
      </div>

      <div className="grid items-stretch gap-6 xl:grid-cols-[minmax(0,1fr)_480px]">
        <DashboardMotion className="min-w-0" delay={0.08}><DashboardFunnelOverview stages={overview.funnel} transitions={overview.funnelTransitions} /></DashboardMotion>
        <DashboardMotion className="min-w-0" delay={0.1}><DashboardAudienceMap geography={insights.geography} /></DashboardMotion>
      </div>

      <DashboardMotion className="min-w-0" delay={0.12}><DashboardSupportOverview support={insights.support} webinarId={selectedWebinar?.id} demo={Boolean(demo)} /></DashboardMotion>
      <DashboardMotion className="min-w-0" delay={0.14}>
        <DashboardChatIntelligence
          webinarId={selectedWebinar?.id}
          from={rangeStart.toISOString()}
          to={rangeEnd.toISOString()}
          demoReport={demo ? createChatIntelligenceDemo({
            webinarId: demo.webinar.id,
            totalMessages: demo.insights.support.incomingMessages,
            uniqueConversations: demo.insights.support.uniqueConversations,
            from: rangeStart,
            to: rangeEnd
          }) : undefined}
        />
      </DashboardMotion>
      <p className="text-xs text-neutral-500">
        {demo && "Cenário fictício para avaliação do layout. "}
        Horário de Brasília · Vendas e faturamento em reais, pela data de registro.
        {overview.excludedCurrencySales > 0 && ` ${overview.excludedCurrencySales} venda(s) em outras moedas não entram nos totais financeiros.`}
      </p>
    </div>
  );
}

const dayMonth = new Intl.DateTimeFormat("pt-BR", { timeZone: DASHBOARD_TIME_ZONE, day: "numeric", month: "short" });
const day = new Intl.DateTimeFormat("pt-BR", { timeZone: DASHBOARD_TIME_ZONE, day: "numeric" });
const year = new Intl.DateTimeFormat("pt-BR", { timeZone: DASHBOARD_TIME_ZONE, year: "numeric" });

// "7 – 13 nov, 2026"; the month is repeated only when the range crosses months.
function formatPeriod(start: Date, end: Date): string {
  const short = (date: Date) => dayMonth.format(date).replace(" de ", " ").replace(".", "");
  const sameMonth = short(start).split(" ")[1] === short(end).split(" ")[1] && year.format(start) === year.format(end);
  return `${sameMonth ? day.format(start) : short(start)} – ${short(end)}, ${year.format(end)}`;
}
