"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown, RefreshCw } from "@/components/icons";
import { retryWebhook } from "@/server/actions/public";
import { JsonCode } from "./json-code";

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

const statusLabels = { PENDING: "Pendente", SUCCESS: "Enviado", FAILED: "Falha" };
const statusStyles = {
  PENDING: "border border-[#F5B742]/40 bg-[#F5B742]/10 text-[#F5B742]",
  SUCCESS: "bg-palco text-palco-ink",
  FAILED: "border border-red-500/40 bg-red-500/10 text-red-400"
};

function isJson(text: string) {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
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

  const cell = "px-3 py-[11px] first:pl-5 last:pr-5";

  return (
    <>
      <tr className={`border-b border-[#1A1F1B] ${open ? "border-b-0 bg-[#0F130F]" : ""}`}>
        <td className={`${cell} font-mono text-xs text-[#C9D1CA]`}>{row.event}</td>
        <td className={`${cell} text-[13px] font-semibold text-neutral-100`}>{row.leadName ?? "—"}</td>
        <td className={cell}>
          <span className={`inline-flex rounded-md px-2 py-[3px] text-[11px] font-semibold ${statusStyles[row.status]}`}>{statusLabels[row.status]}</span>
        </td>
        <td className={`${cell} text-center text-[13px] font-semibold tabular-nums text-neutral-100`}>{row.attempt}</td>
        <td className={`${cell} text-center text-[13px] font-semibold tabular-nums text-neutral-100`}>{row.responseStatus ?? "—"}</td>
        <td className={`${cell} whitespace-nowrap text-xs text-[#7C867E]`}>
          <time dateTime={row.createdAt} title={row.createdAt}>
            {new Date(row.createdAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" })}
          </time>
        </td>
        <td className={cell}>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              className="grid h-7 w-7 place-items-center rounded-lg text-[#7C867E] transition-colors hover:text-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-palco/60 motion-reduce:transition-none"
              aria-label={open ? "Ocultar detalhes do disparo" : "Ver detalhes do disparo"}
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
            >
              <ChevronDown className={`h-3.5 w-3.5 transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`} />
            </button>
            <button
              type="button"
              className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-[#1E241F] px-2.5 text-[11px] font-medium text-[#C9D1CA] transition-colors hover:border-palco/40 hover:text-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-palco/60 disabled:opacity-50 motion-reduce:transition-none"
              disabled={pending}
              onClick={onRetry}
            >
              <RefreshCw className={`h-3 w-3 ${pending ? "animate-spin motion-reduce:animate-none" : ""}`} />
              Reenviar
            </button>
          </div>
        </td>
      </tr>
      {open ? (
        <tr className="border-b border-[#1A1F1B] bg-[#0F130F]">
          <td colSpan={7} className="px-5 pb-[18px] pt-1">
            <div className="flex flex-col gap-2.5">
              <p className="text-xs font-semibold text-neutral-100">Payload</p>
              <JsonCode code={row.payloadJson} className="max-h-80 p-3.5" />
              {row.responseBody ? (
                <>
                  <p className="text-xs font-semibold text-neutral-100">Resposta</p>
                  {isJson(row.responseBody) ? (
                    <JsonCode code={row.responseBody} className="max-h-40 px-3.5 py-2.5" />
                  ) : (
                    <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-[10px] border border-[#1E241F] bg-[#070807] px-3.5 py-2.5 font-mono text-[11px] text-[#C9D1CA]">{row.responseBody}</pre>
                  )}
                </>
              ) : null}
              {row.errorMessage ? (
                <>
                  <p className="text-xs font-semibold text-red-400">Erro</p>
                  <pre className="overflow-auto whitespace-pre-wrap break-all rounded-[10px] border border-red-500/30 bg-[#070807] px-3.5 py-2.5 font-mono text-[11px] text-red-300">{row.errorMessage}</pre>
                </>
              ) : null}
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}
