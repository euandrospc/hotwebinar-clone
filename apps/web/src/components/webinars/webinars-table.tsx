import type { Webinar } from "db";
import Link from "next/link";
import { MonitorPlay } from "@/components/icons";
import { AdminEmptyState } from "@/components/admin/admin-page";
import styles from "./webinars.module.css";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { WebinarSchedule } from "./webinar-schedule";
import { RowActions } from "./row-actions";
import { WebinarOnlineBadge } from "./webinar-online-badge";

type Row = Pick<Webinar, "id" | "name" | "title" | "slug" | "status" | "mode" | "startDate" | "endDate" | "timezone" | "recurring" | "recurringDays">;

const STATUS_LABEL: Record<Row["status"], string> = {
  DRAFT: "Rascunho",
  ACTIVE: "Ativo",
  ARCHIVED: "Arquivado"
};

export function WebinarsTable({ rows, publicBaseUrl }: { rows: Row[]; publicBaseUrl: string }) {
  const now = Date.now();
  if (rows.length === 0) {
    return (
      <AdminEmptyState icon={<MonitorPlay />} title="Nenhum webinar encontrado" description="Ajuste os filtros ou crie seu primeiro webinar para começar." />
    );
  }
  return (
    <Table className={styles.table}>
      <TableHeader>
        <TableRow>
          <TableHead>Nome / Data e hora</TableHead>
          <TableHead>Online</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Tipo</TableHead>
          <TableHead className="w-12" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.id}>
            <TableCell>
              <Link href={`/dashboard/webinars/${r.id}/step-1`} className={styles.webinarTitle}>{r.title || r.name || "Sem título"}</Link>
              <WebinarSchedule
                webinar={{ mode: r.mode, startDate: r.startDate, endDate: r.endDate,
                  recurring: r.recurring, recurringDays: r.recurringDays, timezone: r.timezone }}
                initialNow={now}
              />
            </TableCell>
            <TableCell><WebinarOnlineBadge webinarId={r.id} /></TableCell>
            <TableCell><span className={styles.badge} data-status={r.status}>{STATUS_LABEL[r.status]}</span></TableCell>
            <TableCell><span className={styles.badge} data-kind={r.mode}>{r.mode === "JIT" ? "JIT" : r.recurring ? "Recorrente" : "Único"}</span></TableCell>
            <TableCell>
              <RowActions
                id={r.id}
                title={r.title || r.name}
                slug={r.slug}
                publicBaseUrl={publicBaseUrl}
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
