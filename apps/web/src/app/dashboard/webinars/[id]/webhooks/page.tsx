import type { Metadata } from "next";
import { AdminPage, AdminPageHeader } from "@/components/admin/admin-page";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Prisma } from "db";
import { auth } from "@/lib/auth";
import { canAccessWebinar } from "@/lib/webinar-access";
import { prisma } from "db";
import { ArrowLeft, ArrowRight } from "@/components/icons";
import { WebhookRow, type WebhookRowData } from "@/components/webinar/webhook-row";
import { WebinarTabs } from "@/components/webinar/webinar-tabs";

export const metadata: Metadata = { title: "Webhooks do webinar" };

const PAGE_SIZE = 50;
const STATUSES = ["PENDING", "SUCCESS", "FAILED"] as const;

type SP = { status?: string; event?: string; page?: string; retry?: string };

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<SP>;
}

export default async function WebhooksPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const sp = await searchParams;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) notFound();
  const w = await prisma.webinar.findUnique({ where: { id } });
  if (!canAccessWebinar(session, w)) notFound();

  const page = Math.max(1, Math.floor(Number(sp.page ?? "1")) || 1);
  const where: Prisma.WebhookDeliveryWhereInput = { webinarId: id };
  if (STATUSES.includes(sp.status as (typeof STATUSES)[number])) where.status = sp.status as (typeof STATUSES)[number];
  if (sp.event) where.event = sp.event;
  // The dispatcher increments `attempt` on every run, so >1 means the delivery was retried.
  if (sp.retry === "1") where.attempt = { gt: 1 };

  const [total, rows] = await Promise.all([
    prisma.webhookDelivery.count({ where }),
    prisma.webhookDelivery.findMany({
      where,
      include: { lead: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE
    })
  ]);
  const data: WebhookRowData[] = rows.map((r) => ({
    id: r.id,
    event: r.event,
    status: r.status,
    attempt: r.attempt,
    responseStatus: r.responseStatus,
    errorMessage: r.errorMessage,
    responseBody: r.responseBody,
    payloadJson: JSON.stringify(r.payload, null, 2),
    leadName: r.lead?.name ?? null,
    createdAt: r.createdAt.toISOString()
  }));

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const href = (apply: Partial<SP>) => {
    const next: SP = { ...sp, ...apply };
    const qs = new URLSearchParams(
      Object.entries(next).filter((e): e is [string, string] => typeof e[1] === "string" && e[1] !== "")
    ).toString();
    return `/dashboard/webinars/${id}/webhooks${qs ? "?" + qs : ""}`;
  };
  const filters: { label: string; apply: Partial<SP>; active: boolean }[] = [
    { label: "Todos", apply: { status: undefined, retry: undefined }, active: !sp.status && sp.retry !== "1" },
    { label: "Enviados", apply: { status: "SUCCESS", retry: undefined }, active: sp.status === "SUCCESS" && sp.retry !== "1" },
    { label: "Falhados", apply: { status: "FAILED", retry: undefined }, active: sp.status === "FAILED" && sp.retry !== "1" },
    { label: "Pendentes", apply: { status: "PENDING", retry: undefined }, active: sp.status === "PENDING" && sp.retry !== "1" },
    { label: "Retry", apply: { status: undefined, retry: "1" }, active: sp.retry === "1" }
  ];
  const th = "px-3 py-[11px] text-[10px] font-semibold uppercase tracking-[0.06em] text-[#6E776F] first:pl-5 last:pr-5";
  const pageButton =
    "inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#1E241F] px-3 text-xs font-medium text-neutral-100 transition-colors hover:border-palco/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-palco/60 motion-reduce:transition-none";

  return (
    <AdminPage className="font-palco">
      <WebinarTabs webinarId={id} />
      <AdminPageHeader title="Webhooks" description={w.title || w.name} />
      <section className="min-w-0 overflow-hidden rounded-2xl border border-[#1E241F] bg-[#0C0E0C]" aria-label="Disparos de webhook">
        <nav className="flex flex-wrap gap-1.5 px-5 py-4" aria-label="Filtrar disparos">
          {filters.map((f) => (
            <Link
              key={f.label}
              href={href({ ...f.apply, page: undefined })}
              aria-current={f.active ? "true" : undefined}
              className={`rounded-lg border px-3 py-[7px] text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-palco/60 motion-reduce:transition-none ${
                f.active
                  ? "border-palco/25 bg-palco/[0.08] font-semibold text-neutral-100"
                  : "border-transparent text-neutral-400 hover:text-neutral-100"
              }`}
            >
              {f.label}
            </Link>
          ))}
        </nav>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left">
            <thead className="border-y border-[#1A1F1B] bg-[#090B09]">
              <tr>
                <th className={`${th} w-[200px]`}>Evento</th>
                <th className={th}>Lead</th>
                <th className={`${th} w-[110px]`}>Status</th>
                <th className={`${th} w-[90px] text-center`}>Tentativas</th>
                <th className={`${th} w-[70px] text-center`}>HTTP</th>
                <th className={`${th} w-[160px]`}>Quando</th>
                <th className={`${th} w-[150px] text-right`}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {data.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-sm text-neutral-400">Nenhum disparo ainda.</td>
                </tr>
              ) : null}
              {data.map((r) => <WebhookRow key={r.id} row={r} />)}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <span className="text-xs text-[#7C867E]">
            {total.toLocaleString("pt-BR")} evento{total === 1 ? "" : "s"} · página {page}/{totalPages}
          </span>
          <div className="flex gap-2">
            {page > 1 ? (
              <Link href={href({ page: String(page - 1) })} className={pageButton}><ArrowLeft className="h-3.5 w-3.5" />Anterior</Link>
            ) : null}
            {page < totalPages ? (
              <Link href={href({ page: String(page + 1) })} className={pageButton}>Próxima<ArrowRight className="h-3.5 w-3.5" /></Link>
            ) : null}
          </div>
        </div>
      </section>
    </AdminPage>
  );
}
