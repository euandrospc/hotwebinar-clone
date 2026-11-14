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
    <div className="rounded-xl border border-[#1E241F] bg-[#121512] px-4 py-3 font-palco text-xs shadow-lg">
      <p className="mb-2 text-[#7C867E]">{label}</p>
      <div className="flex items-center gap-6">
        <span className="flex items-center gap-2 text-neutral-400">
          <span aria-hidden="true" className="size-2 rounded-full bg-[#B6F09A]" />
          {payload[0].category}
        </span>
        <span className="font-semibold tabular-nums text-neutral-100">{formatCount(payload[0].value)}</span>
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
    <section aria-labelledby="participants-title" className="flex h-full min-w-0 flex-col gap-4 rounded-2xl border border-[#1E241F] bg-[#0C0E0C] p-5 font-palco">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 id="participants-title" className="text-[13px] text-neutral-400">Participantes</h3>
          <div className="mt-1.5 flex items-baseline gap-2">
            <p className="text-[26px] font-semibold leading-tight tabular-nums text-neutral-100">{formatCount(total)}</p>
            <span className="text-[11px] text-[#7C867E]">sessões no período</span>
          </div>
        </div>
        <div role="group" aria-label="Visualização de participantes" className="inline-flex gap-0.5 rounded-lg border border-[#1E241F] bg-[#070807] p-[3px]">
          {([{ value: "daily", label: "Por dia" }, { value: "cumulative", label: "Acumulado" }] as const).map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={view === option.value}
              onClick={() => { setView(option.value); setSelectedDate(null); }}
              className={cn("rounded-md px-2.5 py-[5px] text-[11px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-palco motion-reduce:transition-none", view === option.value ? "bg-palco/[0.08] font-semibold text-[#B6F09A]" : "text-neutral-400 hover:text-neutral-100")}
            >
              {option.label}
            </button>
          ))}
        </div>
      </header>

      {total === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center gap-2 text-center">
          <p className="text-sm font-medium text-neutral-400">Nenhuma sessão neste período</p>
          <p className="max-w-64 text-xs leading-relaxed text-[#7C867E]">Escolha outro período ou aguarde as primeiras visitas aos seus webinars.</p>
        </div>
      ) : (
        <AreaChart
          key={view}
          data={chartData}
          index="date"
          categories={[category]}
          colors={["chartLime"]}
          className="h-48 [&_.recharts-cartesian-axis-tick_text]:!fill-[#5A635C] [&_.recharts-cartesian-axis-tick_text]:text-[10px] [&_.recharts-cartesian-grid_line]:!stroke-[#1A1F1B]"
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

      <footer className="mt-auto flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#7C867E]">
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
