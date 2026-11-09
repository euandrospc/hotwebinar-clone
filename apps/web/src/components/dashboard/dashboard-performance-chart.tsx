"use client";

import { useId, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Info } from "@/components/icons";
import { AreaChart, type TooltipProps } from "@/components/tremor/area-chart";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface DashboardPerformancePoint {
  date: string;
  label: string;
  registrations: number;
  viewers: number;
  revenueCents: number;
  sales: number;
}

type Metric = "registrations" | "viewers" | "revenueCents";

const metrics = [
  {
    key: "registrations",
    label: "Acessos",
    note: "Acessos identificados na plataforma",
    description: "Cada acesso identificado conta uma vez por webinar, no primeiro registro do período. Não representa captação externa de leads.",
    empty: "Nenhum acesso registrado neste período."
  },
  {
    key: "viewers",
    label: "Público",
    note: "Pessoas com reprodução registrada",
    description: "Público único por webinar, contado no dia do primeiro registro de reprodução do vídeo. Esse registro acontece durante a reprodução, e não necessariamente no início.",
    empty: "Nenhuma reprodução registrada neste período."
  },
  {
    key: "revenueCents",
    label: "Faturamento",
    note: "Receita atribuída aos webinars",
    description: "Receita das vendas atribuídas aos seus webinars, por dia do período selecionado.",
    empty: "Nenhuma receita atribuída neste período."
  }
] as const;

const numberFormat = new Intl.NumberFormat("pt-BR");
const moneyFormat = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const compactMoneyFormat = new Intl.NumberFormat("pt-BR", {
  style: "currency", currency: "BRL", notation: "compact", maximumFractionDigits: 1
});

function PerformanceTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  const isRevenue = item.category === "Faturamento";

  return (
    <div className="rounded-xl border border-[#E5E9E6] bg-white px-3.5 py-3 text-xs shadow-lg shadow-black/5 dark:border-border dark:bg-card">
      <p className="mb-2 text-muted-foreground">{label}</p>
      <div className="flex items-center gap-5">
        <span className="flex items-center gap-2 text-muted-foreground">
          <span aria-hidden="true" className="size-2 rounded-full bg-[#A6DE6B]" />
          {item.category}
        </span>
        <strong className="font-medium tabular-nums text-[#153D30] dark:text-foreground">
          {isRevenue ? moneyFormat.format(item.value) : numberFormat.format(item.value)}
        </strong>
      </div>
    </div>
  );
}

export function DashboardPerformanceChart({ data }: { data: DashboardPerformancePoint[] }) {
  const [metric, setMetric] = useState<Metric>("registrations");
  const reduceMotion = useReducedMotion();
  const titleId = useId();
  const activeMetric = metrics.find((item) => item.key === metric)!;
  const chartData = data.map((item) => ({
    // Include the year in the display index so identical DD/MM across years
    // remain separate categories. ISO date also remains in each tooltip payload.
    day: `${item.label}/${item.date.slice(0, 4)}`,
    date: item.date,
    [activeMetric.label]: metric === "revenueCents" ? item.revenueCents / 100 : item[metric]
  }));
  const hasValues = data.some((item) => item[metric] > 0);

  return (
    <section aria-labelledby={titleId} className="h-full min-w-0 rounded-2xl border border-[#E5E9E6] bg-white p-5 dark:border-border dark:bg-card">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h3 id={titleId} className="text-sm font-semibold text-[#253C31] dark:text-foreground">Evolução no período</h3>
        <div role="group" aria-label="Métrica da evolução" className="inline-flex rounded-lg bg-[#F5F7F5] p-0.5 dark:bg-muted/50">
          {metrics.map((item) => (
            <button
              key={item.key}
              type="button"
              aria-pressed={metric === item.key}
              onClick={() => setMetric(item.key)}
              className={cn(
                "rounded-md px-2.5 py-1.5 text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#064B3C] dark:focus-visible:ring-[#A6DE6B]",
                metric === item.key
                  ? "bg-white font-medium text-[#064B3C] shadow-sm dark:bg-card dark:text-[#A6DE6B]"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </header>

      <motion.div
        key={metric}
        initial={{ opacity: 0.5, y: 3 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.16 }}
        className="mt-3"
      >
        {hasValues ? (
          <AreaChart
            data={chartData}
            index="day"
            categories={[activeMetric.label]}
            colors={["chartLime"]}
            className="h-44"
            valueFormatter={(value) => metric === "revenueCents" ? compactMoneyFormat.format(value) : numberFormat.format(value)}
            allowDecimals={metric === "revenueCents"}
            showLegend={false}
            yAxisWidth={metric === "revenueCents" ? 62 : 36}
            tickGap={22}
            customTooltip={PerformanceTooltip}
            aria-label={`${activeMetric.label} por dia no período selecionado. Use as setas para explorar os valores.`}
          />
        ) : (
          <div className="flex h-44 items-center justify-center px-5 text-center text-xs text-muted-foreground">
            {activeMetric.empty}
          </div>
        )}
      </motion.div>

      <footer className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <span>{activeMetric.note}</span>
        <TooltipProvider delayDuration={150}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" aria-label={`Como contamos ${activeMetric.label.toLowerCase()}`} className="rounded-sm p-0.5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <Info aria-hidden="true" className="size-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-64 leading-relaxed">{activeMetric.description}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </footer>
      <div className="sr-only">
      <table>
        <caption>Evolução diária no período selecionado</caption>
        <thead><tr><th scope="col">Dia</th><th scope="col">Acessos</th><th scope="col">Público</th><th scope="col">Faturamento</th><th scope="col">Vendas</th></tr></thead>
        <tbody>{data.map((item) => <tr key={item.date}><th scope="row">{item.label}/{item.date.slice(0, 4)}</th><td>{item.registrations}</td><td>{item.viewers}</td><td>{moneyFormat.format(item.revenueCents / 100)}</td><td>{item.sales}</td></tr>)}</tbody>
      </table>
      </div>
    </section>
  );
}
