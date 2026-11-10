import type { Metadata } from "next";
import Link from "next/link";
import Form from "next/form";
import { AdminPage, AdminPageHeader, AdminSurface } from "@/components/admin/admin-page";
import styles from "@/components/webinar/webinar-operations.module.css";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { MousePointerClick, Download } from "@/components/icons";
import { auth } from "@/lib/auth";
import { prisma } from "db";
import { WebinarTabs } from "@/components/webinar/webinar-tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

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

function flagEmoji(code: string | null): string {
  if (!code || code.length !== 2) return "";
  const A = 127397;
  return String.fromCodePoint(A + code.toUpperCase().charCodeAt(0)) +
         String.fromCodePoint(A + code.toUpperCase().charCodeAt(1));
}

export default async function LeadsPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const rawParams = await searchParams;
  const sp = Object.fromEntries(Object.entries(rawParams).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]));
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) notFound();
  const w = await prisma.webinar.findUnique({ where: { id }, select: { id: true, ownerId: true, title: true, name: true } });
  if (!w || w.ownerId !== session.user.id) notFound();

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
        <a href={`/api/webinars/${id}/leads/export?${new URLSearchParams(filters)}`} className={styles.linkButton}><Download className="h-3.5 w-3.5" />Exportar CSV</a>
      } />
      <AdminSurface padded={false} className={styles.table}>
      <div className={styles.toolbar}>
      <div className="min-w-0">
        <DashboardRangePicker
          appearance="v2"
          key={`${dateParams.from ?? ""}-${dateParams.to ?? ""}`}
          allowAll
          initialFrom={dateRange ? selectedDates.from.slice(0, 10) : ""}
          initialTo={dateRange ? selectedDates.to.slice(0, 10) : ""}
          initialFromTime={dateRange ? selectedDates.from.slice(11, 16) : "00:00"}
          initialToTime={dateRange ? selectedDates.to.slice(11, 16) : "23:59"}
          queryParams={{ ...(q ? { q } : {}), ...(clicked ? { clicked: "1" } : {}), pageSize: String(pageSize) }}
        />
      </div>

      <Form action={baseHref} scroll={false} className="min-w-[min(100%,220px)] flex-1 sm:max-w-sm">
        <input
          key={q}
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Buscar por nome / email / cidade…"
          aria-label="Buscar leads" className={styles.search}
        />
        {Object.entries(dateParams).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
        {clicked ? <input type="hidden" name="clicked" value="1" /> : null}
        <input type="hidden" name="pageSize" value={pageSize} />
      </Form>

      </div>
      <div className="flex flex-wrap items-center gap-2 px-4 pb-3">
        <Link
          href={filterHref(false)} prefetch={false} scroll={false}
          className={styles.filter} aria-current={!clicked ? "true" : undefined}
        >
          Todos
        </Link>
        <Link
          href={filterHref(true)} prefetch={false} scroll={false}
          className={styles.filter} aria-current={clicked ? "true" : undefined}
        >
          <MousePointerClick className="h-3.5 w-3.5" />
          Clicaram na oferta
        </Link>
      </div>

      <LeadsResults baseHref={baseHref} filters={filters} page={page} pageSize={pageSize} total={total}>
      <div className={styles.tableScroll}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Localização</TableHead>
              <TableHead>Pitch</TableHead>
              <TableHead className="text-right">Cliques</TableHead>
              <TableHead>Opt-in</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                  Nenhum lead encontrado para os filtros selecionados.
                </TableCell>
              </TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.name || "—"}</TableCell>
                <TableCell className="text-xs">
                  {r.email && !r.email.endsWith("@no-email.invalid") ? (
                    r.email
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{r.phone ?? "—"}</TableCell>
                <TableCell className="text-xs">
                  {r.country || r.city ? (
                    <span className="inline-flex items-center gap-1.5">
                      <span aria-hidden>{flagEmoji(r.country)}</span>
                      <span>{[r.city, r.region, r.country].filter(Boolean).join(", ") || "—"}</span>
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {r.pitchFired ? <Badge variant="default">Sim</Badge> : <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {r.ctaClicks > 0 ? (
                    <span className="inline-flex items-center gap-1 font-medium text-primary">
                      <MousePointerClick className="h-3.5 w-3.5" />
                      {r.ctaClicks}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">0</span>
                  )}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {fmtDate.format(r.sessionStart)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      </LeadsResults>
      </AdminSurface>
    </AdminPage>
  );
}
