import type { Metadata } from "next";
import { AdminPage, AdminPageHeader, AdminSurface } from "@/components/admin/admin-page";
import styles from "@/components/webinar/webinar-operations.module.css";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "db";
import { WebhookRow, type WebhookRowData } from "@/components/webinar/webhook-row";
import { WebinarTabs } from "@/components/webinar/webinar-tabs";

export const metadata: Metadata = { title: "Webhooks do webinar" };

const PAGE_SIZE = 50;

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ status?: string; event?: string; page?: string }>;
}

export default async function WebhooksPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const sp = await searchParams;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) notFound();
  const w = await prisma.webinar.findUnique({ where: { id } });
  if (!w || w.ownerId !== session.user.id) notFound();

  const page = Math.max(1, Number(sp.page ?? "1"));
  const where: any = { webinarId: id };
  if (sp.status) where.status = sp.status;
  if (sp.event) where.event = sp.event;

  const [total, rows] = await Promise.all([
    prisma.webhookDelivery.count({ where }),
    prisma.webhookDelivery.findMany({
      where,
      include: { lead: true },
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

  return (
    <AdminPage>
      <WebinarTabs webinarId={id} />
      <AdminPageHeader title="Webhooks" description={w.title || w.name} />
      <AdminSurface padded={false} className={styles.table}>
      <div className={styles.toolbar}><div className={styles.controls}>
        <FilterLink id={id} label="Todos" sp={sp} apply={{ status: undefined }} />
        <FilterLink id={id} label="Pendentes" sp={sp} apply={{ status: "PENDING" }} />
        <FilterLink id={id} label="Enviados" sp={sp} apply={{ status: "SUCCESS" }} />
        <FilterLink id={id} label="Falhas" sp={sp} apply={{ status: "FAILED" }} />
      </div>
      </div>
      <div className={styles.tableScroll}><table className="w-full text-xs">
        <thead>
          <tr className="border-b text-left">
            <th className="px-3 py-2">Evento</th>
            <th className="px-3 py-2">Lead</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2 text-right">Tentativas</th>
            <th className="px-3 py-2 text-right">HTTP</th>
            <th className="px-3 py-2">Quando</th>
            <th className="px-3 py-2 text-right">Ações</th>
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">Nenhum disparo ainda.</td></tr>
          ) : null}
          {data.map((r) => <WebhookRow key={r.id} row={r} />)}
        </tbody>
      </table></div>
      <div className={styles.pagination}>
        <span className="text-muted-foreground">
          {total} entrada{total === 1 ? "" : "s"}, página {page}/{totalPages}
        </span>
        <div className="flex gap-2">
          {page > 1 ? <Link href={`?page=${page - 1}`} className={styles.linkButton}>Anterior</Link> : null}
          {page < totalPages ? <Link href={`?page=${page + 1}`} className={styles.linkButton}>Próximo</Link> : null}
        </div>
      </div>
      </AdminSurface>
    </AdminPage>
  );
}

function FilterLink({
  id, label, sp, apply
}: {
  id: string;
  label: string;
  sp: { status?: string; event?: string };
  apply: { status?: string };
}) {
  const next = { ...sp, ...apply };
  if (apply.status === undefined) delete next.status;
  const qs = new URLSearchParams(next as Record<string, string>).toString();
  const href = `/dashboard/webinars/${id}/webhooks${qs ? "?" + qs : ""}`;
  return <Link href={href} aria-current={sp.status === apply.status ? "true" : undefined} className={styles.filter}>{label}</Link>;
}
