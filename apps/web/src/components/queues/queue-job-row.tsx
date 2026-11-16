"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown, RotateCcw, X } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { removeQueueJob, retryQueueJob } from "@/server/actions/queues";
import type { QueueJobRow as QueueJob } from "@/server/queue-admin";
import styles from "./queues.module.css";

const COLUMNS = 6;

function when(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "medium" });
}

function host(url: string) {
  try { return new URL(url).host; } catch { return url; }
}

export function QueueJobRow({ job }: { job: QueueJob }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const d = job.delivery;

  function run(action: (id: string) => Promise<{ ok: true } | { error: { message: string } }>, success: string) {
    startTransition(async () => {
      const result = await action(job.id);
      if ("ok" in result) toast.success(success);
      else toast.error(result.error.message);
      router.refresh();
    });
  }

  const moment = job.state === "delayed" ? job.nextAttemptAt
    : job.state === "failed" || job.state === "completed" ? job.finishedAt
    : job.state === "active" ? job.processedAt
    : job.createdAt;

  return (
    <>
      <tr className="border-b">
        <td>
          <span className={styles.event}>{d?.event ?? "—"}</span>
          {d?.leadName && <span className={styles.sub}>{d.leadName}</span>}
        </td>
        <td>
          {d ? <Link href={`/dashboard/webinars/${d.webinarId}/webhooks`} className="hover:underline">{d.webinarName}</Link> : "Disparo removido"}
          {d && <span className={styles.sub} title={d.url}>{host(d.url)}</span>}
        </td>
        <td className="text-right tabular-nums">{job.attemptsMade}/{job.maxAttempts}</td>
        <td>{job.failedReason ? <span className={styles.error} title={job.failedReason}>{job.failedReason}</span> : <span className="text-muted-foreground">—</span>}</td>
        <td className="whitespace-nowrap text-muted-foreground"><time dateTime={moment ?? undefined}>{when(moment)}</time></td>
        <td>
          <div className={styles.rowActions}>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" aria-expanded={open}
              aria-label={open ? "Ocultar detalhes do job" : "Ver detalhes do job"} onClick={() => setOpen((v) => !v)}>
              <ChevronDown className={`h-3.5 w-3.5 transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`} />
            </Button>
            {job.state === "failed" && (
              <Button variant="outline" size="sm" className="h-7 rounded-lg px-2 text-[11px]" disabled={pending}
                onClick={() => run(retryQueueJob, "Job reenviado para a fila")}>
                <RotateCcw className="h-3 w-3" />Reprocessar
              </Button>
            )}
            {job.state !== "active" && (
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={pending} aria-label="Remover job da fila" title="Remover da fila"
                onClick={() => run(removeQueueJob, "Job removido da fila")}>
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={COLUMNS} className={styles.detail}>
            <dl className={styles.detailGrid}>
              <dt>Job</dt><dd className={styles.event}>{job.id}</dd>
              <dt>Destino</dt><dd>{d?.url ?? "—"}</dd>
              <dt>Resposta HTTP</dt><dd>{d?.responseStatus ?? "—"}</dd>
              <dt>Entrou na fila</dt><dd>{when(job.createdAt)}</dd>
              <dt>Última execução</dt><dd>{when(job.processedAt)}</dd>
              {job.state === "delayed" && <><dt>Próxima tentativa</dt><dd>{when(job.nextAttemptAt)}</dd></>}
              {job.finishedAt && <><dt>Finalizado</dt><dd>{when(job.finishedAt)}</dd></>}
            </dl>
            {job.failedReason && <pre className={styles.detailError}>{job.failedReason}</pre>}
          </td>
        </tr>
      )}
    </>
  );
}
