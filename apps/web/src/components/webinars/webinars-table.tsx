import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { format } from "date-fns";
import { RowActions } from "./row-actions";

interface Row {
  id: string;
  name: string;
  title: string;
  slug: string | null;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  mode: "UNICO" | "JIT";
  startDate: Date | null;
  endDate: Date | null;
}

const STATUS_LABEL: Record<Row["status"], string> = {
  DRAFT: "Rascunho",
  ACTIVE: "Ativo",
  ARCHIVED: "Arquivado"
};

export function WebinarsTable({ rows, publicBaseUrl }: { rows: Row[]; publicBaseUrl: string }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-md border bg-card p-8 text-center text-sm text-muted-foreground">
        Nenhum webinar — clique em "Criar novo" para começar.
      </div>
    );
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nome / Data e hora</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Tipo</TableHead>
          <TableHead className="w-12" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.id}>
            <TableCell>
              <div className="font-medium">{r.title || r.name || "Sem título"}</div>
              <div className="text-xs text-muted-foreground">
                {r.startDate ? format(r.startDate, "dd/MM/yyyy HH:mm") : "—"}
                {" → "}
                {r.endDate ? format(r.endDate, "dd/MM/yyyy HH:mm") : "—"}
              </div>
            </TableCell>
            <TableCell><Badge variant={r.status === "ACTIVE" ? "default" : "outline"}>{STATUS_LABEL[r.status]}</Badge></TableCell>
            <TableCell><Badge variant="destructive">{r.mode === "UNICO" ? "Único" : "JIT"}</Badge></TableCell>
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
