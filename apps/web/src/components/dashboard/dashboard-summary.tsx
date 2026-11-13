"use client";

import { ArrowDown, ArrowUp, DollarSign, Info } from "@/components/icons";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import styles from "./dashboard-card.module.css";

interface SummaryTotals {
  revenueCents: number;
  sales: number;
  registrations: number;
  convertedLeads: number;
  conversionRate: number | null;
}

interface Comparison {
  previousRevenueCents: number;
  previousSales: number;
  revenueChangePct: number | null;
}

const number = new Intl.NumberFormat("pt-BR");
const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const percent = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

export function DashboardSummary({ totals, comparison }: { totals: SummaryTotals; comparison: Comparison }) {
  const change = comparison.revenueChangePct;
  const ChangeIcon = change !== null && change < 0 ? ArrowDown : ArrowUp;
  const ticket = totals.sales > 0 ? totals.revenueCents / totals.sales : null;

  return (
    <TooltipProvider delayDuration={150}>
      <section aria-label="Resultado financeiro" className={`${styles.card} ${styles.financial} flex h-full min-w-0 flex-col text-neutral-100`}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            <h2 className="text-sm font-semibold">Faturamento</h2>
            <Tooltip><TooltipTrigger asChild><button type="button" aria-label="Sobre o faturamento" className="rounded-full text-white/60 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-palco"><Info className="size-3.5" /></button></TooltipTrigger><TooltipContent className="max-w-72 leading-relaxed">Vendas em reais registradas no período. O sistema não desconta estornos. A comparação usa o intervalo imediatamente anterior, com a mesma duração.</TooltipContent></Tooltip>
          </div>
          <DollarSign aria-hidden="true" className="size-5 text-white/80" />
        </div>
        <p className="mt-4 break-words text-4xl font-bold leading-tight tracking-tight tabular-nums lg:text-[2.5rem]">{currency.format(totals.revenueCents / 100)}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2.5 text-sm">
          {change === null ? (
            <span className="text-white/70">Sem base de faturamento no período anterior</span>
          ) : (
            <><span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${change < 0 ? "bg-white/15 text-white" : "bg-palco text-palco-ink"}`}><ChangeIcon aria-hidden="true" className="size-3" />{change > 0 ? "+" : ""}{percent.format(change)}%</span><span className="text-white/70">vs. período anterior</span></>
          )}
        </div>
        <dl className="mt-auto grid grid-cols-3 gap-4 border-t border-white/15 pt-4 [&>div]:pt-0">
          <div><dt className="text-xs text-white/70">Vendas</dt><dd className="mt-1 text-lg font-bold tabular-nums sm:text-xl">{number.format(totals.sales)}</dd></div>
          <div>
            <dt className="flex items-center gap-1 text-xs text-white/70">Conversão<Tooltip><TooltipTrigger asChild><button type="button" aria-label="Sobre a conversão" className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-palco"><Info className="size-3" /></button></TooltipTrigger><TooltipContent className="max-w-64">{number.format(totals.convertedLeads)} compradores entre {number.format(totals.registrations)} acessos identificados no webinar. Captação externa não entra no cálculo.</TooltipContent></Tooltip></dt>
            <dd className="mt-1 text-lg font-bold tabular-nums sm:text-xl">{totals.conversionRate === null ? "—" : `${percent.format(totals.conversionRate)}%`}</dd>
          </div>
          <div><dt className="text-xs text-white/70">Ticket médio</dt><dd className="mt-1 truncate text-lg font-bold tabular-nums sm:text-xl">{ticket === null ? "—" : currency.format(ticket / 100)}</dd></div>
        </dl>
      </section>
    </TooltipProvider>
  );
}
