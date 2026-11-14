"use client";

import { useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight } from "@/components/icons";
import { LEADS_PAGE_SIZES, leadsPageHref, leadsPageNumbers } from "@/lib/leads-pagination";
import { cn } from "@/lib/utils";

const fmt = new Intl.NumberFormat("pt-BR");
const pageButton = "inline-flex h-7 min-w-7 items-center justify-center rounded-lg px-1.5 text-xs tabular-nums text-neutral-400 transition-colors hover:bg-white/[0.04] hover:text-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-palco/60 disabled:cursor-not-allowed disabled:text-[#5A635C] disabled:hover:bg-transparent aria-[current=page]:bg-palco/[0.12] aria-[current=page]:text-palco motion-reduce:transition-none";

interface Props {
  baseHref: string;
  filters: Record<string, string>;
  page: number;
  pageSize: number;
  total: number;
  children: ReactNode;
}

/** Only the controls are client-side; the server still fetches and renders one page. */
export function LeadsResults({ baseHref, filters, page, pageSize, total, children }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);
  const summary = total === 0 ? "0 registros" : `${fmt.format(first)}–${fmt.format(last)} de ${fmt.format(total)}`;

  function navigate(nextPage: number, nextSize = pageSize) {
    startTransition(() => {
      router.push(leadsPageHref(baseHref, filters, nextPage, nextSize), { scroll: false });
    });
  }

  function controls(position: "top" | "bottom") {
    return <div data-position={position} className={cn("flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2.5 px-5 py-3.5 text-xs text-neutral-500", position === "bottom" && "border-t border-[#1A1F1B]")}>
      <div className="flex flex-wrap items-center gap-3">
        <span className="whitespace-nowrap tabular-nums">{summary}</span>
        {position === "top" && <label className="flex items-center gap-1.5">
          <select aria-label="Registros por página" value={pageSize} disabled={pending}
            onChange={(event) => navigate(1, Number(event.target.value))}
            className="h-7 rounded-lg border border-[#1E241F] bg-[#070807] px-1.5 text-xs text-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-palco/60 disabled:opacity-40">
            {LEADS_PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
          </select>
          <span>por página</span>
        </label>}
      </div>
      <nav className="flex min-w-0 items-center gap-1" aria-label={`Paginação de leads (${position === "top" ? "início" : "fim"})`}>
        <button type="button" className={pageButton} aria-label="Página anterior" title="Página anterior"
          disabled={pending || page <= 1} onClick={() => navigate(page - 1)}>
          <ArrowLeft aria-hidden="true" className="size-3.5" />
        </button>
        <div className="hidden min-w-0 items-center gap-1 sm:flex">
          {leadsPageNumbers(page, totalPages).map((value, index) => value === "ellipsis"
            ? <span key={`gap-${index}`} className="inline-flex h-7 min-w-7 items-center justify-center text-neutral-400" aria-hidden="true">…</span>
            : <button type="button" key={value} className={pageButton}
                aria-label={`Página ${fmt.format(value)}`} aria-current={value === page ? "page" : undefined}
                disabled={pending} onClick={() => value !== page && navigate(value)}>{fmt.format(value)}</button>)}
        </div>
        <span className="min-w-[70px] text-center tabular-nums sm:hidden">{fmt.format(page)} de {fmt.format(totalPages)}</span>
        <button type="button" className={pageButton} aria-label="Próxima página" title="Próxima página"
          disabled={pending || page >= totalPages} onClick={() => navigate(page + 1)}>
          <ArrowRight aria-hidden="true" className="size-3.5" />
        </button>
      </nav>
    </div>;
  }

  return <div className="group/results min-w-0" aria-busy={pending}>
    <span role="status" className="sr-only">
      {pending ? "Carregando leads…" : `Página ${fmt.format(page)} de ${fmt.format(totalPages)}. ${summary}.`}
    </span>
    {controls("top")}
    <div className="transition-opacity group-aria-busy/results:opacity-50 motion-reduce:transition-none">{children}</div>
    {controls("bottom")}
  </div>;
}
