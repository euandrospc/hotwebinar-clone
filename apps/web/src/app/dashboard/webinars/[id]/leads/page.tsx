import type { Metadata } from "next";
import Link from "next/link";
import Form from "next/form";
import { AdminPage, AdminPageHeader } from "@/components/admin/admin-page";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { Download, Play, Search } from "@/components/icons";
import { auth } from "@/lib/auth";
import { canAccessWebinar } from "@/lib/webinar-access";
import { prisma } from "db";
import { WebinarTabs } from "@/components/webinar/webinar-tabs";

import { DashboardRangePicker } from "@/components/dashboard/dashboard-range-picker";
import { defaultLeadsDateParams, leadsDateRange } from "@/lib/leads-date-range";
import { getLeadsPage, parseLeadsPagination } from "@/lib/leads-pagination";
import { LeadsResults } from "@/components/webinar/leads-results";

export const metadata: Metadata = { title: "Leads do webinar" };

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<Partial<Record<"q" | "page" | "pageSize" | "clicked" | "from" | "to" | "period", string | string[]>>>;
}

const fmtNum = new Intl.NumberFormat("pt-BR");
const fmtDate = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

export default async function LeadsPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const rawParams = await searchParams;
  const sp = Object.fromEntries(Object.entries(rawParams).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]));
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) notFound();
  const w = await prisma.webinar.findUnique({ where: { id }, select: { id: true, ownerId: true, title: true, name: true } });
  if (!canAccessWebinar(session, w)) notFound();

  const q = (sp.q ?? "").trim();
  const clicked = sp.clicked === "1";
  const { page: requestedPage, pageSize } = parseLeadsPagination(sp);

  const selectedDates = leadsDateRange(sp.from, sp.to) ? { from: sp.from!, to: sp.to! } : defaultLeadsDateParams();
  const dateRange = sp.period === "all" ? undefined : leadsDateRange(selectedDates.from, selectedDates.to);
  const dateParams: Record<string, string> = dateRange ? selectedDates : { period: "all" };
  const filters = { ...dateParams, ...(q ? { q } : {}), ...(clicked ? { clicked: "1" } : {}) };

  const where = {
    ...(dateRange && { sessionStart: dateRange }),
    webinarId: id,
    ...(clicked && { ctaClicks: { gt: 0 } }),
    ...(q && {
      OR: [
        { name: { contains: q, mode: "insensitive" as const } },
        { email: { contains: q, mode: "insensitive" as const } },
        { city: { contains: q, mode: "insensitive" as const } }
      ]
    })
  };

  // Resolve the bounds before querying rows, so stale or invalid URLs never
  // trigger an enormous OFFSET or show an empty page beyond the last result.
  const total = await prisma.lead.count({ where });
  const page = getLeadsPage(requestedPage, total, pageSize);
  const rows = total === 0 ? [] : await prisma.lead.findMany({
    where,
    orderBy: [{ sessionStart: "desc" }, { id: "desc" }],
    take: pageSize,
    skip: (page - 1) * pageSize,
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      city: true,
      region: true,
      country: true,
      sessionStart: true,
      pitchFired: true,
      ctaClicks: true
    }
  });

  const baseHref = `/dashboard/webinars/${id}/leads`;
  const filterHref = (offerClicked: boolean) => `${baseHref}?${new URLSearchParams({
    ...dateParams, ...(q ? { q } : {}), ...(offerClicked ? { clicked: "1" } : {}), pageSize: String(pageSize)
  })}`;

  return (
    <AdminPage>
      <WebinarTabs webinarId={id} />

      <AdminPageHeader title="Leads" description={`${fmtNum.format(total)} ${total === 1 ? "registro" : "registros"} · ${w.title || w.name}`} actions={
        <a href={`/api/webinars/${id}/leads/export?${new URLSearchParams(filters)}`} className="inline-flex h-[34px] items-center gap-2 rounded-[10px] border border-[#1E241F] px-3 text-[13px] font-medium text-[#C9D1CA] transition-colors hover:border-palco/40 hover:text-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-palco/60 motion-reduce:transition-none"><Download aria-hidden="true" className="size-3.5 text-neutral-400" />Exportar CSV</a>
      } />
      <section className="min-w-0 overflow-hidden rounded-2xl border border-[#1E241F] bg-[#0C0E0C] font-palco">
        <div className="flex flex-col gap-3.5 px-5 py-[18px]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <DashboardRangePicker
                appearance="v2"
                className="h-[34px] rounded-[10px] border-[#1E241F] bg-transparent text-[#C9D1CA] hover:bg-white/[0.04] [&_span]:text-[13px]"
                key={`${dateParams.from ?? ""}-${dateParams.to ?? ""}`}
                allowAll
                initialFrom={dateRange ? selectedDates.from.slice(0, 10) : ""}
                initialTo={dateRange ? selectedDates.to.slice(0, 10) : ""}
                initialFromTime={dateRange ? selectedDates.from.slice(11, 16) : "00:00"}
                initialToTime={dateRange ? selectedDates.to.slice(11, 16) : "23:59"}
                queryParams={{ ...(q ? { q } : {}), ...(clicked ? { clicked: "1" } : {}), pageSize: String(pageSize) }}
              />
            </div>

            <Form action={baseHref} scroll={false} className="relative w-full sm:w-80">
              <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-neutral-500" />
              <input
                key={q}
                type="search"
                name="q"
                defaultValue={q}
                placeholder="Buscar por nome / email / cidade…"
                aria-label="Buscar leads"
                className="h-9 w-full rounded-[10px] border border-[#1E241F] bg-[#070807] pl-8 pr-3 text-[13px] text-neutral-100 placeholder:text-neutral-500 focus-visible:border-palco/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-palco/20"
              />
              {Object.entries(dateParams).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
              {clicked ? <input type="hidden" name="clicked" value="1" /> : null}
              <input type="hidden" name="pageSize" value={pageSize} />
            </Form>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {[false, true].map((offer) => {
              const current = offer === clicked;
              return (
                <Link
                  key={String(offer)}
                  href={filterHref(offer)} prefetch={false} scroll={false}
                  aria-current={current ? "true" : undefined}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-[7px] text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-palco/60 motion-reduce:transition-none ${current ? "border-palco/25 bg-palco/[0.08] font-semibold text-neutral-100" : "border-transparent text-neutral-400 hover:text-neutral-100"}`}
                >
                  {offer && <Play aria-hidden="true" className="size-3 text-neutral-500" />}
                  {offer ? "Clicaram na oferta" : "Todos"}
                </Link>
              );
            })}
          </div>
        </div>

        <LeadsResults baseHref={baseHref} filters={filters} page={page} pageSize={pageSize} total={total}>
          <div className="overflow-x-auto [scrollbar-width:thin]">
            <table className="w-full min-w-[1080px] border-collapse text-left text-[13px]">
              <thead className="border-y border-[#1A1F1B] bg-[#090B09]">
                <tr className="text-[10px] uppercase tracking-[0.06em] text-neutral-500">
                  <th scope="col" className="w-[220px] py-[11px] pl-5 pr-3 font-semibold">Nome</th>
                  <th scope="col" className="px-3 py-[11px] font-semibold">Email</th>
                  <th scope="col" className="w-[150px] px-3 py-[11px] font-semibold">Telefone</th>
                  <th scope="col" className="w-[250px] px-3 py-[11px] font-semibold">Localização</th>
                  <th scope="col" className="w-20 px-3 py-[11px] font-semibold">Pitch</th>
                  <th scope="col" className="w-[76px] px-3 py-[11px] text-right font-semibold">Cliques</th>
                  <th scope="col" className="w-[150px] py-[11px] pl-3 pr-5 font-semibold">Opt-in</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-sm text-neutral-500">
                      Nenhum lead encontrado para os filtros selecionados.
                    </td>
                  </tr>
                )}
                {rows.map((r) => {
                  const loc = [r.city, r.region, r.country].filter(Boolean).join(", ");
                  return (
                    <tr key={r.id} className="border-b border-[#1A1F1B] transition-colors last:border-b-0 hover:bg-white/[0.02] motion-reduce:transition-none">
                      <td className="py-3 pl-5 pr-3 font-semibold text-neutral-100">{r.name || "—"}</td>
                      <td className="px-3 py-3 text-[#C9D1CA]">
                        {r.email && !r.email.endsWith("@no-email.invalid") ? r.email : <span className="text-[#5A635C]">—</span>}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 tabular-nums text-neutral-500">{r.phone ?? "—"}</td>
                      <td className="px-3 py-3 text-[#C9D1CA]">
                        {loc ? (
                          <span className="inline-flex items-center gap-1.5">
                            <CountryFlag code={r.country} />
                            <span>{loc}</span>
                          </span>
                        ) : (
                          <span className="text-[#5A635C]">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {r.pitchFired
                          ? <span className="inline-flex rounded-full bg-palco px-2.5 py-[3px] text-[11px] font-semibold text-palco-ink">Sim</span>
                          : <span className="text-[#5A635C]">—</span>}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {r.ctaClicks > 0 ? (
                          <span className="inline-flex items-center gap-1.5 font-semibold text-palco" title="Cliques na oferta">
                            <Play aria-hidden="true" className="size-[11px]" />
                            {r.ctaClicks}
                          </span>
                        ) : (
                          <span className="text-neutral-500">0</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap py-3 pl-3 pr-5 tabular-nums text-neutral-500">
                        {fmtDate.format(r.sessionStart)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </LeadsResults>
      </section>
    </AdminPage>
  );
}

const countryNames = new Intl.DisplayNames(["pt-BR"], { type: "region" });

/** Small flag from flagcdn; falls back to the raw code when it isn't an ISO alpha-2. */
function CountryFlag({ code }: { code: string | null }) {
  if (!code) return null;
  if (!/^[a-z]{2}$/i.test(code)) return <span className="text-[9px] font-bold text-neutral-500">{code}</span>;
  let name = code.toUpperCase();
  try { name = countryNames.of(name) ?? name; } catch { /* unknown region keeps the code */ }
  // eslint-disable-next-line @next/next/no-img-element -- tiny external flag; avoids next/image remote config
  return <img src={`https://flagcdn.com/w40/${code.toLowerCase()}.png`} alt={name} title={name} width={20} height={15} loading="lazy" className="h-[15px] w-5 shrink-0 rounded-sm object-cover" />;
}
