"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown, RefreshCw } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { retryWebhook } from "@/server/actions/public";

export interface WebhookRowData {
  id: string;
  event: string;
  status: "PENDING" | "SUCCESS" | "FAILED";
  attempt: number;
  responseStatus: number | null;
  errorMessage: string | null;
  responseBody: string | null;
  payloadJson: string;
  leadName: string | null;
  createdAt: string;
}

export function WebhookRow({ row }: { row: WebhookRowData }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function onRetry() {
    startTransition(async () => {
      const r = await retryWebhook(row.id);
      if ("ok" in r) {
        toast.success("Reenviado");
        router.refresh();
      } else {
        toast.error(r.error.message);
      }
    });
  }

  const statusLabels = { PENDING: "Pendente", SUCCESS: "Enviado", FAILED: "Falha" };
  const variant: "default" | "destructive" | "outline" =
    row.status === "SUCCESS" ? "default" : row.status === "FAILED" ? "destructive" : "outline";

  return (
    <>
      <tr className="border-b">
        <td className="px-3 py-2 font-mono text-xs">{row.event}</td>
        <td className="px-3 py-2">{row.leadName ?? "—"}</td>
        <td className="px-3 py-2"><Badge variant={variant} className="rounded-md px-1.5 py-0.5 text-[10px] font-medium">{statusLabels[row.status]}</Badge></td>
        <td className="px-3 py-2 text-right tabular-nums">{row.attempt}</td>
        <td className="px-3 py-2 text-right tabular-nums">{row.responseStatus ?? "—"}</td>
        <td className="px-3 py-2 text-xs text-muted-foreground"><time dateTime={row.createdAt} title={row.createdAt}>{new Date(row.createdAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" })}</time></td>
        <td className="px-3 py-2 text-right">
          <Button variant="ghost" size="sm" className="mr-1 h-7 w-7 p-0" aria-label={open ? "Ocultar detalhes do disparo" : "Ver detalhes do disparo"} aria-expanded={open} onClick={() => setOpen((v) => !v)}><ChevronDown className={`h-3.5 w-3.5 transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`} /></Button>
          <Button variant="outline" size="sm" className="h-7 rounded-lg px-2 text-[11px]" disabled={pending} onClick={onRetry}><RefreshCw className="h-3 w-3" />Reenviar</Button>
        </td>
      </tr>
      {open ? (
        <tr>
          <td colSpan={7} className="bg-muted/30 px-3 py-3 text-xs">
            <p className="font-semibold">Payload</p>
            <pre className="mt-1 max-h-40 overflow-auto rounded bg-background p-2">{row.payloadJson}</pre>
            {row.responseBody ? (
              <>
                <p className="mt-2 font-semibold">Resposta</p>
                <pre className="mt-1 max-h-40 overflow-auto rounded bg-background p-2">{row.responseBody}</pre>
              </>
            ) : null}
            {row.errorMessage ? (
              <>
                <p className="mt-2 font-semibold text-destructive">Erro</p>
                <pre className="mt-1 rounded bg-background p-2">{row.errorMessage}</pre>
              </>
            ) : null}
          </td>
        </tr>
      ) : null}
    </>
  );
}
