"use client";

import { useId, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Info } from "@/components/icons";
import { AreaChart, type TooltipProps } from "@/components/tremor/area-chart";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { DashboardInsights } from "@/lib/dashboard-insights";
import styles from "./dashboard-card.module.css";

export type DashboardWatchData = DashboardInsights["watch"];

const number = new Intl.NumberFormat("pt-BR");
const percent = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

function duration(seconds: number | null) {
  if (seconds === null) return "—";
  const value = Math.max(0, Math.round(seconds));
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor(value % 3600 / 60);
  const remaining = value % 60;
  return hours > 0 ? `${hours}h ${minutes}min` : minutes > 0 ? `${minutes}min ${remaining}s` : `${remaining}s`;
}

function clock(seconds: number) {
  const value = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor(value % 3600 / 60).toString().padStart(2, "0");
  const remaining = (value % 60).toString().padStart(2, "0");
  return hours ? `${hours}:${minutes}:${remaining}` : `${minutes}:${remaining}`;
}

// Pill drawn at the top of the pitch line, to its left so it stays inside the plot near the end of the video.
function PitchLabel({ text, viewBox }: { text: string; viewBox?: { x: number; y: number } }) {
  if (!viewBox) return null;
  const width = text.length * 6.1 + 30;
  // Flip to the right when the pill would cover the y-axis labels (narrow cards, early pitch).
  const x = viewBox.x - width - 6 < 52 ? viewBox.x + 6 : viewBox.x - width - 6;
  return <g aria-hidden="true">
    <rect x={x} y={viewBox.y} width={width} height={20} rx={10} className="fill-palco" />
    <text x={x + 22} y={viewBox.y + 14} className="fill-palco-ink text-[11px] font-bold">{text}</text>
    <path d={`M${x + 9} ${viewBox.y + 5.5}v9M${x + 9} ${viewBox.y + 6}h6l-1.5 2.2 1.5 2.3h-6`} className="fill-none stroke-palco-ink" strokeWidth={1.4} strokeLinejoin="round" />
  </g>;
}

function WatchTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload as { viewers: number; percentage: number };
  return (
    <div className="min-w-40 rounded-xl border border-white/10 bg-neutral-900/95 px-3 py-2.5 text-xs shadow-xl backdrop-blur-sm">
      <p className="text-muted-foreground">Posição {label}</p>
      <p className="mt-1.5 font-medium tabular-nums">{number.format(point.viewers)} pessoas <span className="font-normal text-muted-foreground">· {percent.format(point.percentage)}%</span></p>
      <p className="mt-1 text-[10px] text-muted-foreground">alcançaram esta posição ou avançaram</p>
    </div>
  );
}

export function DashboardWatchChart({ watch }: { watch: DashboardWatchData }) {
  const [mode, setMode] = useState<"percentage" | "viewers">("percentage");
  const reducedMotion = useReducedMotion();
  const titleId = useId();
  const category = mode === "percentage" ? "Alcance" : "Pessoas";
  const data = watch.retention.map((point) => ({ ...point, position: clock(point.positionSeconds), [category]: point[mode] }));
  const hasData = watch.retention.some((point) => point.viewers > 0);
  const pitchPoint = watch.pitchAtSeconds === null || !watch.retention.length ? null
    : watch.retention.reduce((best, point) => Math.abs(point.positionSeconds - watch.pitchAtSeconds!) < Math.abs(best.positionSeconds - watch.pitchAtSeconds!) ? point : best);

  return (
    <section aria-labelledby={titleId} className={`${styles.card} flex h-full min-w-0 flex-col`}>
      <header className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-1">
            <h2 id={titleId} className="text-sm font-semibold text-neutral-300">Tempo assistido</h2>
            <TooltipProvider delayDuration={150}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" aria-label="Como o tempo assistido é calculado" className="inline-flex size-6 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-white/5 hover:text-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-palco motion-reduce:transition-none"><Info aria-hidden="true" className="size-3.5" /></button>
                </TooltipTrigger>
                <TooltipContent className="max-w-72 leading-relaxed">A média usa o tempo acumulado das pessoas observadas no período. A curva mostra a maior posição registrada no vídeo neste período, não a duração exata assistida.</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <p className="text-3xl font-bold leading-tight tabular-nums text-neutral-100">{duration(watch.averageWatchedSeconds)}</p>
          <p className="text-sm text-neutral-500">Média por pessoa · {number.format(watch.viewerCount)} {watch.viewerCount === 1 ? "pessoa" : "pessoas"}</p>
        </div>
        <div role="group" aria-label="Unidade do alcance do vídeo" className={styles.segmented}>
          {([{ key: "percentage", label: "%", name: "Percentual" }, { key: "viewers", label: "Pessoas", name: "Pessoas" }] as const).map((item) => (
            <motion.button key={item.key} type="button" aria-label={item.name} aria-pressed={mode === item.key} onClick={() => setMode(item.key)} whileTap={{ scale: reducedMotion ? 1 : 0.97 }} className={styles.segment}>{item.label}</motion.button>
          ))}
        </div>
      </header>
      {hasData ? (
        <AreaChart
          data={data}
          index="position"
          categories={[category]}
          colors={["palco"]}
          curveType="monotone"
          className="mt-5 h-40 min-h-40 flex-1"
          referenceLine={pitchPoint ? { x: clock(pitchPoint.positionSeconds), label: <PitchLabel text={`Pitch ${clock(watch.pitchAtSeconds!)} · ${percent.format(pitchPoint.percentage)}%`} /> } : undefined}
          showLegend={false}
          allowDecimals={false}
          minValue={0}
          maxValue={mode === "percentage" ? 100 : undefined}
          yAxisWidth={48}
          tickGap={24}
          valueFormatter={(value) => mode === "percentage" ? `${percent.format(value)}%` : number.format(value)}
          customTooltip={WatchTooltip}
          aria-label={`Alcance por posição no vídeo, em ${mode === "percentage" ? "percentual" : "pessoas"}. Use as setas para explorar.`}
        />
      ) : (
        <div className="mt-5 flex h-40 flex-1 items-center justify-center text-center text-sm text-neutral-500">Sem reprodução registrada neste período.</div>
      )}
      <div className="sr-only"><table>
        <caption>Alcance registrado por posição no vídeo</caption>
        <thead><tr><th scope="col">Posição</th><th scope="col">Pessoas</th><th scope="col">Percentual</th></tr></thead>
        <tbody>{watch.retention.map((point) => <tr key={point.positionSeconds}><th scope="row">{clock(point.positionSeconds)}</th><td>{number.format(point.viewers)}</td><td>{percent.format(point.percentage)}%</td></tr>)}</tbody>
      </table></div>
    </section>
  );
}
