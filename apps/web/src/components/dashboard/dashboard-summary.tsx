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
      <section aria-label="Resultado financeiro" className={`${styles.card} ${styles.financial} flex h-full min-w-0 flex-col text-white`}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-[13px] font-medium leading-5 text-white/85">Faturamento</h2>
            <Tooltip><TooltipTrigger asChild><button type="button" aria-label="Sobre o faturamento" className="rounded-full text-white/60 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-400"><Info className="size-3.5" /></button></TooltipTrigger><TooltipContent className="max-w-72 leading-relaxed">Vendas em reais registradas no período. O sistema não desconta estornos. A comparação usa o intervalo imediatamente anterior, com a mesma duração.</TooltipContent></Tooltip>
          </div>
          <DollarSign aria-hidden="true" className="size-4 text-[#BDDF9E]" />
        </div>
        <p className="mt-3 break-words text-[30px] font-semibold leading-[1.15] tracking-[-0.04em] tabular-nums sm:text-[32px]">{currency.format(totals.revenueCents / 100)}</p>
        <p className="mt-1.5 text-[11px] leading-4 text-white/65">Ticket médio <span className="ml-1 font-medium text-white/90">{ticket === null ? "—" : currency.format(ticket / 100)}</span></p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] leading-4">
          {change === null ? (
            <span className="text-white/65">Sem base de faturamento no período anterior</span>
          ) : (
            <><span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ${change < 0 ? "bg-white/10 text-white" : "bg-[#C9EFA7] text-[#124D37]"}`}><ChangeIcon aria-hidden="true" className="size-3" />{change > 0 ? "+" : ""}{percent.format(change)}%</span><span className="text-white/65">vs. período anterior</span></>
          )}
        </div>
        <dl className="mt-auto grid grid-cols-2 gap-4 pt-4">
          <div className="border-t border-white/15 pt-2"><dt className="text-[11px] text-white/65">Vendas</dt><dd className="mt-0.5 text-lg font-medium leading-6 tabular-nums">{number.format(totals.sales)}</dd></div>
          <div className="border-t border-white/15 pt-2">
            <dt className="flex items-center gap-1.5 text-[11px] text-white/65">Conversão<Tooltip><TooltipTrigger asChild><button type="button" aria-label="Sobre a conversão" className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-400"><Info className="size-3" /></button></TooltipTrigger><TooltipContent className="max-w-64">{number.format(totals.convertedLeads)} compradores entre {number.format(totals.registrations)} acessos identificados no webinar. Captação externa não entra no cálculo.</TooltipContent></Tooltip></dt>
            <dd className="mt-0.5 text-lg font-medium leading-6 tabular-nums">{totals.conversionRate === null ? "—" : `${percent.format(totals.conversionRate)}%`}</dd>
          </div>
        </dl>
      </section>
    </TooltipProvider>
  );
}
