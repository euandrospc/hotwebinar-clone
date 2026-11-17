import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { CircleCheck, Clock, Hourglass, LoaderCircle, TriangleAlert, Webhook } from "@/components/icons";
import type { AppIcon } from "@/components/icons";
import { AdminEmptyState, AdminPage, AdminPageHeader, AdminSurface } from "@/components/admin/admin-page";
import operations from "@/components/webinar/webinar-operations.module.css";
import { QueueControls } from "@/components/queues/queue-controls";
import { QueueJobRow } from "@/components/queues/queue-job-row";
import styles from "@/components/queues/queues.module.css";
import { auth } from "@/lib/auth";
import { ADMIN_LOGIN_PATH } from "@/lib/admin-paths";
import { ADMIN_ROLES, hasRole } from "@/lib/roles";
import { getWebhookDeliveryTotals, getWebhookQueueOverview, QUEUE_STATES, type QueueState } from "@/server/queue-admin";

export const metadata: Metadata = { title: "Filas" };

export const dynamic = "force-dynamic";

const STATES: Record<QueueState, { label: string; icon: AppIcon; hint: string; empty: string; moment: string }> = {
  failed: { label: "Falhas", icon: TriangleAlert, hint: "Esgotaram as tentativas automáticas.", empty: "Nenhum job com falha.", moment: "Falhou em" },
  waiting: { label: "Aguardando", icon: Hourglass, hint: "Na fila, prontos para envio.", empty: "Nenhum job aguardando.", moment: "Entrou em" },
  active: { label: "Em processamento", icon: LoaderCircle, hint: "Sendo enviados agora.", empty: "Nenhum job em processamento.", moment: "Iniciou em" },
  delayed: { label: "Nova tentativa", icon: Clock, hint: "Falharam e aguardam a próxima tentativa automática.", empty: "Nenhum job aguardando nova tentativa.", moment: "Próxima tentativa" },
  completed: { label: "Concluídos", icon: CircleCheck, hint: "O número é o total de webhooks enviados. A lista mostra só os mais recentes: até 1.000, das últimas 24 horas.", empty: "Nenhum job concluído nas últimas 24 horas.", moment: "Concluído em" }
};

const num = new Intl.NumberFormat("pt-BR");

interface PageProps {
  searchParams: Promise<{ state?: string; page?: string }>;
}

export default async function QueuesPage({ searchParams }: PageProps) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect(`${ADMIN_LOGIN_PATH}?from=/dashboard/filas`);
  if (!hasRole((session.user as { role?: string }).role, ADMIN_ROLES)) redirect("/dashboard");

  const sp = await searchParams;
  const state = QUEUE_STATES.find((s) => s === sp.state) ?? "failed";
  const [overview, totals] = await Promise.all([
    getWebhookQueueOverview(state, Number(sp.page) || 1),
    getWebhookDeliveryTotals()
  ]);
  const current = STATES[state];

  return (
    <AdminPage>
      <AdminPageHeader
        title="Filas"
        description="Acompanhe o envio dos webhooks, veja os erros e reprocesse o que falhou."
        actions={<QueueControls available={overview.available} paused={overview.available && overview.paused} failed={overview.available ? overview.counts.failed : 0} />}
      />

      {!overview.available ? (
        <AdminSurface padded={false}>
          <AdminEmptyState
            icon={<Webhook />}
            title={overview.reason === "not_configured" ? "Fila não configurada" : "Não foi possível acessar a fila"}
            description={overview.reason === "not_configured"
              ? "Defina REDIS_URL nas variáveis do app para enfileirar e enviar os webhooks."
              : "O Redis não respondeu. Os disparos continuam registrados como pendentes e podem ser reenviados na aba Webhooks de cada webinar."}
          />
        </AdminSurface>
      ) : (
        <>
          <div className={styles.status} role="status">
            <span className={styles.statusItem}><Webhook aria-hidden="true" className="h-3.5 w-3.5" />Webhooks</span>
            <span className={styles.statusItem}>
              <span aria-hidden="true" className={styles.dot} data-tone={overview.paused ? "warn" : undefined} />
              {overview.paused ? "Fila pausada — novos envios aguardam" : "Fila ativa"}
            </span>
            <span className={styles.statusItem}>
              <span aria-hidden="true" className={styles.dot} data-tone={overview.workers > 0 ? undefined : "off"} />
              {overview.workers > 0
                ? `${overview.workers} processador${overview.workers === 1 ? "" : "es"} conectado${overview.workers === 1 ? "" : "s"}`
                : "Nenhum processador conectado"}
            </span>
          </div>

          <nav aria-label="Estados da fila" className={styles.states}>
            {QUEUE_STATES.map((key) => {
              const { label, icon: Icon } = STATES[key];
              // The queue keeps only its latest finished jobs; the sent total comes from the history.
              const count = key === "completed" ? totals.sent : overview.counts[key];
              return (
                <Link key={key} href={`/dashboard/filas?state=${key}`} aria-current={key === state ? "page" : undefined}
                  data-alert={key === "failed" && count > 0} className={styles.state}>
                  <span className={styles.stateLabel}><Icon aria-hidden="true" />{label}</span>
                  <span className={styles.stateValue}>{num.format(count)}</span>
                </Link>
              );
            })}
          </nav>

          <AdminSurface padded={false} className={operations.table}>
            <div className={operations.toolbar}>
              <div>
                <h2 className={styles.tableTitle}>{current.label}</h2>
                <p className={styles.tableHint}>{current.hint}</p>
              </div>
            </div>
            {overview.jobs.length === 0 ? (
              <AdminEmptyState icon={<current.icon />} title={current.empty} />
            ) : (
              <div className={operations.tableScroll}>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b text-left">
                      <th>Evento</th>
                      <th>Webinar</th>
                      <th className="text-right">Tentativas</th>
                      <th>Erro</th>
                      <th>{current.moment}</th>
                      <th className="text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody>{overview.jobs.map((job) => <QueueJobRow key={job.id} job={job} />)}</tbody>
                </table>
              </div>
            )}
            <div className={operations.pagination}>
              <span>{num.format(overview.total)} job{overview.total === 1 ? "" : "s"}{state === "completed" ? " na lista" : ""}, página {overview.page}/{overview.totalPages}</span>
              <div className="flex gap-2">
                {overview.page > 1 && <Link href={`/dashboard/filas?state=${state}&page=${overview.page - 1}`} className={operations.linkButton}>Anterior</Link>}
                {overview.page < overview.totalPages && <Link href={`/dashboard/filas?state=${state}&page=${overview.page + 1}`} className={operations.linkButton}>Próximo</Link>}
              </div>
            </div>
          </AdminSurface>
        </>
      )}

      <AdminSurface padded={false} className={operations.table}>
        <div className={operations.toolbar}>
          <div>
            <h2 className={styles.tableTitle}>Total por webinar</h2>
            <p className={styles.tableHint}>Todos os webhooks registrados desde o início, pelo histórico de disparos.</p>
          </div>
        </div>
        {totals.webinars.length === 0 ? (
          <AdminEmptyState icon={<Webhook />} title="Nenhum webhook registrado ainda." />
        ) : (
          <div className={operations.tableScroll}>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-left">
                  <th>Webinar</th>
                  <th className="text-right">Enviados</th>
                  <th className="text-right">Falhas</th>
                  <th className="text-right">Pendentes</th>
                  <th className="text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {totals.webinars.map((w) => (
                  <tr key={w.webinarId} className="border-b">
                    <td><Link href={`/dashboard/webinars/${w.webinarId}/webhooks`} className="hover:underline">{w.webinarName}</Link></td>
                    <td className="text-right tabular-nums">{num.format(w.sent)}</td>
                    <td className={`text-right tabular-nums ${w.failed > 0 ? styles.failedCount : ""}`}>{num.format(w.failed)}</td>
                    <td className="text-right tabular-nums">{num.format(w.pending)}</td>
                    <td className="text-right font-medium tabular-nums">{num.format(w.total)}</td>
                  </tr>
                ))}
              </tbody>
              {totals.webinars.length > 1 && (
                <tfoot>
                  <tr className="font-medium">
                    <td>Todos os webinars</td>
                    <td className="text-right tabular-nums">{num.format(totals.sent)}</td>
                    <td className="text-right tabular-nums">{num.format(totals.failed)}</td>
                    <td className="text-right tabular-nums">{num.format(totals.pending)}</td>
                    <td className="text-right tabular-nums">{num.format(totals.total)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </AdminSurface>
    </AdminPage>
  );
}
