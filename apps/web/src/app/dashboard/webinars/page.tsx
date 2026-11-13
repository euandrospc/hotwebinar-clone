import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "db";
import { AdminPage, AdminPageHeader } from "@/components/admin/admin-page";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/icons";
import { auth } from "@/lib/auth";
import { getOnlineSnapshot } from "@/lib/online";
import { ownerScope } from "@/lib/webinar-access";
import { cn } from "@/lib/utils";
import { WebinarsFilters, type PhaseCounts } from "@/components/webinars/webinars-filters";
import { WebinarsTable, type WebinarRow } from "@/components/webinars/webinars-table";
import { WebinarLiveBanner } from "@/components/webinars/webinar-live-banner";
import { NewWebinarButton } from "@/components/webinars/new-webinar-button";
import { sessionInfo, type WebinarState } from "@/components/webinars/webinar-session";

export const metadata: Metadata = { title: "Webinars" };

const PAGE_SIZE = 20;
const PHASE_STATE: Record<string, WebinarState> = { live: "live", scheduled: "scheduled", paused: "paused" };

export default async function WebinarsPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login?from=/dashboard/webinars");
  const sp = await searchParams;
  const get = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const q = get("q").trim().toLocaleLowerCase("pt-BR");
  const status = get("status");
  const tipo = get("tipo");
  const fase = get("fase");
  const sort = get("sort") || "recent";
  const page = Math.max(1, parseInt(get("page") || "1", 10) || 1);

  // Live/scheduled come from the recurring schedule (computed in JS), so phase filters,
  // counts and the live banner need the owner's whole list rather than one DB page.
  // shortcut: loads every webinar of the owner; move phase math to SQL if lists reach thousands.
  const now = new Date();
  const [all, snap] = await Promise.all([
    prisma.webinar.findMany({
      where: ownerScope(session),
      orderBy: { createdAt: "desc" },
      select: {
        id: true, name: true, title: true, slug: true, status: true, mode: true, startDate: true, endDate: true,
        timezone: true, recurring: true, recurringDays: true, createdAt: true,
        video: { select: { durationSec: true, thumbUrl: true, customThumbUrl: true } }
      }
    }),
    getOnlineSnapshot().catch(() => null)
  ]);

  const rows = all.map((w) => ({ ...w, initialOnline: snap?.byWebinar.get(w.id) ?? 0, state: sessionInfo(w, now).state }));
  const matching = rows.filter((w) =>
    (!q || w.name.toLocaleLowerCase("pt-BR").includes(q) || w.title.toLocaleLowerCase("pt-BR").includes(q)) &&
    (status === "DRAFT" || status === "ACTIVE" || status === "ARCHIVED" ? w.status === status : true) &&
    (tipo === "UNICO" ? w.mode === "UNICO" && !w.recurring :
      tipo === "RECURRING" ? w.mode === "UNICO" && w.recurring :
      tipo === "JIT" ? w.mode === "JIT" : true)
  );
  const counts: PhaseCounts = {
    all: matching.length,
    live: matching.filter((w) => w.state === "live").length,
    scheduled: matching.filter((w) => w.state === "scheduled").length,
    paused: matching.filter((w) => w.state === "paused").length
  };
  const filtered = PHASE_STATE[fase] ? matching.filter((w) => w.state === PHASE_STATE[fase]) : matching;
  const label = (w: { title: string; name: string }) => w.title || w.name;
  if (sort === "az") filtered.sort((a, b) => label(a).localeCompare(label(b), "pt-BR"));
  else if (sort === "za") filtered.sort((a, b) => label(b).localeCompare(label(a), "pt-BR"));
  else if (sort === "oldest") filtered.reverse();

  const total = filtered.length;
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const current = Math.min(page, lastPage);
  const pageRows: WebinarRow[] = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  // Banner: the live session with the most people right now (unaffected by table filters).
  const live = rows.filter((w) => w.state === "live").sort((a, b) => b.initialOnline - a.initialOnline)[0];
  const publicBaseUrl = process.env.NEXT_PUBLIC_BETTER_AUTH_URL ?? "http://localhost:3000";

  function buildHref(p: number) {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) if (typeof v === "string") next.set(k, v);
    next.set("page", String(p));
    return `/dashboard/webinars?${next.toString()}`;
  }
  const pager = "flex size-[30px] items-center justify-center rounded-lg border border-[#1E241F] text-neutral-400";

  return (
    <AdminPage className="gap-7">
      <AdminPageHeader className="!items-end" title="Webinars" description="Organize suas transmissões e acompanhe cada experiência."
        actions={<NewWebinarButton label="Criar webinar" className="h-10 rounded-[10px] px-3.5 text-sm font-semibold" />} />
      {live && <WebinarLiveBanner key={live.id} webinar={live} publicBaseUrl={publicBaseUrl} initialNow={now.getTime()} />}
      <section aria-label="Lista de webinars" className="overflow-hidden rounded-2xl border border-[#1E241F] bg-[#0C0E0C] font-palco">
        <WebinarsFilters counts={counts} />
        <WebinarsTable rows={pageRows} publicBaseUrl={publicBaseUrl} initialNow={now.getTime()} />
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#1E241F] px-5 py-3">
          <span className="text-xs text-neutral-500">
            {total} {total === 1 ? "webinar" : "webinars"} · página {current} de {lastPage}
          </span>
          <nav aria-label="Paginação" className="flex gap-1.5">
            {current > 1
              ? <Link href={buildHref(current - 1)} aria-label="Página anterior" className={cn(pager, "hover:bg-white/5 hover:text-neutral-100")}><ChevronLeftIcon className="size-3.5" /></Link>
              : <span className={cn(pager, "opacity-40")} aria-hidden="true"><ChevronLeftIcon className="size-3.5" /></span>}
            {current < lastPage
              ? <Link href={buildHref(current + 1)} aria-label="Próxima página" className={cn(pager, "hover:bg-white/5 hover:text-neutral-100")}><ChevronRightIcon className="size-3.5" /></Link>
              : <span className={cn(pager, "opacity-40")} aria-hidden="true"><ChevronRightIcon className="size-3.5" /></span>}
          </nav>
        </div>
      </section>
    </AdminPage>
  );
}
