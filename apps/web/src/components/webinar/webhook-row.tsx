"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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

  const variant: "default" | "destructive" | "outline" =
    row.status === "SUCCESS" ? "default" : row.status === "FAILED" ? "destructive" : "outline";

  return (
    <>
      <tr className="border-b">
        <td className="px-3 py-2 font-mono text-xs">{row.event}</td>
        <td className="px-3 py-2">{row.leadName ?? "—"}</td>
        <td className="px-3 py-2"><Badge variant={variant}>{row.status}</Badge></td>
        <td className="px-3 py-2 text-right tabular-nums">{row.attempt}</td>
        <td className="px-3 py-2 text-right tabular-nums">{row.responseStatus ?? "—"}</td>
        <td className="px-3 py-2 text-xs text-muted-foreground">{row.createdAt}</td>
        <td className="px-3 py-2 text-right">
          <Button variant="ghost" size="sm" onClick={() => setOpen((v) => !v)}>{open ? "−" : "+"}</Button>
          <Button variant="outline" size="sm" disabled={pending} onClick={onRetry}>Reenviar</Button>
        </td>
      </tr>
      {open ? (
        <tr>
          <td colSpan={7} className="bg-muted/30 px-3 py-3 text-xs">
            <p className="font-semibold">Payload</p>
            <pre className="mt-1 max-h-40 overflow-auto rounded bg-background p-2">{row.payloadJson}</pre>
            {row.responseBody ? (
              <>
                <p className="mt-2 font-semibold">Response</p>
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
