"use client";

import { useState } from "react";
import { AreaChart, type TooltipProps } from "@/components/tremor/area-chart";
import type { DailyParticipants } from "@/lib/dashboard-stats";
import { cn } from "@/lib/utils";

const numberFormat = new Intl.NumberFormat("pt-BR");
const formatCount = (value: number) => numberFormat.format(value);

function ParticipantsTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-[#E5E9E6] dark:border-border bg-white dark:bg-card px-4 py-3 text-xs shadow-lg shadow-black/5">
      <p className="mb-2 text-[#7C8580] dark:text-muted-foreground">{label}</p>
      <div className="flex items-center gap-6">
        <span className="flex items-center gap-2 text-[#59645E] dark:text-muted-foreground">
          <span aria-hidden="true" className="size-2 rounded-full bg-[#A6DE6B]" />
          {payload[0].category}
        </span>
        <span className="font-semibold tabular-nums text-[#163C2F] dark:text-foreground">{formatCount(payload[0].value)}</span>
      </div>
    </div>
  );
}

export function DashboardParticipantesChart({ data }: { data: DailyParticipants[] }) {
  const [view, setView] = useState<"daily" | "cumulative">("daily");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const total = data.reduce((sum, item) => sum + item.count, 0);
  const category = view === "daily" ? "Sessões no dia" : "Sessões acumuladas";
  let cumulative = 0;
  const chartData = data.map((item) => {
    cumulative += item.count;
    return { date: item.date, [category]: view === "daily" ? item.count : cumulative };
  });
  const selected = chartData.find((item) => item.date === selectedDate);
  const range = data.length > 0 ? `${data[0].date} a ${data[data.length - 1].date}` : "Período selecionado";

  return (
    <section aria-labelledby="participants-title" className="h-full min-w-0 rounded-2xl border border-[#E5E9E6] dark:border-border bg-white dark:bg-card p-5 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 id="participants-title" className="text-sm font-medium text-[#59645E] dark:text-muted-foreground">Participantes</h3>
          <div className="mt-2 flex items-baseline gap-2">
            <p className="text-3xl font-semibold tracking-tight tabular-nums text-[#153D30] dark:text-foreground">{formatCount(total)}</p>
            <span className="text-xs text-[#7C8580] dark:text-muted-foreground">sessões no período</span>
          </div>
        </div>
        <div role="group" aria-label="Visualização de participantes" className="inline-flex rounded-lg border border-[#E5E9E6] dark:border-border bg-[#F8FAF8] dark:bg-muted/40 p-1">
          {([{ value: "daily", label: "Por dia" }, { value: "cumulative", label: "Acumulado" }] as const).map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={view === option.value}
              onClick={() => { setView(option.value); setSelectedDate(null); }}
              className={cn("rounded-md px-3 py-1.5 text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#064B3C] dark:focus-visible:ring-[#A6DE6B]", view === option.value ? "bg-white dark:bg-card font-medium text-[#064B3C] dark:text-[#A6DE6B] shadow-sm" : "text-[#78817C] dark:text-muted-foreground hover:text-[#064B3C] dark:hover:text-foreground")}
            >
              {option.label}
            </button>
          ))}
        </div>
      </header>

      {total === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center gap-2 text-center">
          <p className="text-sm font-medium text-[#59645E] dark:text-muted-foreground">Nenhuma sessão neste período</p>
          <p className="max-w-64 text-xs leading-relaxed text-[#7C8580] dark:text-muted-foreground">Escolha outro período ou aguarde as primeiras visitas aos seus webinars.</p>
        </div>
      ) : (
        <AreaChart
          key={view}
          data={chartData}
          index="date"
          categories={[category]}
          colors={["chartLime"]}
          className="mt-5 h-60 sm:h-64"
          valueFormatter={formatCount}
          showLegend={false}
          yAxisWidth={42}
          allowDecimals={false}
          tickGap={24}
          customTooltip={ParticipantsTooltip}
          onValueChange={(value) => setSelectedDate(value?.eventType === "dot" ? String(value.date) : null)}
          aria-label={`Participantes: ${formatCount(total)} sessões entre ${range}. Use as setas para explorar os dias.`}
        />
      )}

      <footer className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[#F0F2F0] dark:border-border pt-3 text-xs text-[#7C8580] dark:text-muted-foreground">
        <span>{range}</span>
        <span aria-live="polite">
          {selected ? `${selected.date} · ${formatCount(Number(selected[category]))} ${view === "daily" ? "sessões" : "acumuladas"}` : "Cada visita representa uma sessão"}
        </span>
      </footer>
      <table className="sr-only">
        <caption>Sessões de participantes por dia</caption>
        <thead><tr><th scope="col">Data</th><th scope="col">Sessões</th></tr></thead>
        <tbody>{data.map((item) => <tr key={item.date}><th scope="row">{item.date}</th><td>{item.count}</td></tr>)}</tbody>
      </table>
    </section>
  );
}
