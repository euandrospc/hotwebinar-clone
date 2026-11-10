"use client";

import { useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight } from "@/components/icons";
import { LEADS_PAGE_SIZES, leadsPageHref, leadsPageNumbers } from "@/lib/leads-pagination";
import styles from "./leads-results.module.css";

const fmt = new Intl.NumberFormat("pt-BR");

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
    return <div className={styles.pagination} data-position={position}>
      <div className={styles.summary}>
        <span className={styles.range}>{summary}</span>
        {position === "top" && <label className={styles.size}>
          <select aria-label="Registros por página" value={pageSize} disabled={pending}
            onChange={(event) => navigate(1, Number(event.target.value))}>
            {LEADS_PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
          </select>
          <span>por página</span>
        </label>}
      </div>
      <nav className={styles.navigation} aria-label={`Paginação de leads (${position === "top" ? "início" : "fim"})`}>
        <button type="button" className={styles.pageButton} aria-label="Página anterior" title="Página anterior"
          disabled={pending || page <= 1} onClick={() => navigate(page - 1)}>
          <ArrowLeft aria-hidden="true" />
        </button>
        <div className={styles.numbers}>
          {leadsPageNumbers(page, totalPages).map((value, index) => value === "ellipsis"
            ? <span key={`gap-${index}`} className={styles.ellipsis} aria-hidden="true">…</span>
            : <button type="button" key={value} className={styles.pageButton}
                aria-label={`Página ${fmt.format(value)}`} aria-current={value === page ? "page" : undefined}
                disabled={pending} onClick={() => value !== page && navigate(value)}>{fmt.format(value)}</button>)}
        </div>
        <span className={styles.mobilePage}>{fmt.format(page)} de {fmt.format(totalPages)}</span>
        <button type="button" className={styles.pageButton} aria-label="Próxima página" title="Próxima página"
          disabled={pending || page >= totalPages} onClick={() => navigate(page + 1)}>
          <ArrowRight aria-hidden="true" />
        </button>
      </nav>
    </div>;
  }

  return <div className={styles.results} aria-busy={pending}>
    <span role="status" className="sr-only">
      {pending ? "Carregando leads…" : `Página ${fmt.format(page)} de ${fmt.format(totalPages)}. ${summary}.`}
    </span>
    {controls("top")}
    <div className={styles.rows}>{children}</div>
    {controls("bottom")}
  </div>;
}
