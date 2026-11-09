"use client";

import { useId, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Flag, Info } from "@/components/icons";
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
  return hours > 0 ? `${hours} h ${minutes} min` : minutes > 0 ? `${minutes} min ${remaining} s` : `${remaining} s`;
}

function clock(seconds: number) {
  const value = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor(value % 3600 / 60).toString().padStart(2, "0");
  const remaining = (value % 60).toString().padStart(2, "0");
  return hours ? `${hours}:${minutes}:${remaining}` : `${minutes}:${remaining}`;
}

function WatchTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload as { viewers: number; percentage: number };
  return (
    <div className="min-w-40 rounded-xl border border-[#E2E9DD] bg-white/95 px-3 py-2.5 text-[11px] shadow-[0_10px_28px_-12px_rgba(24,48,33,0.24)] backdrop-blur-sm dark:border-white/10 dark:bg-[#172119]/95">
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

  return (
    <section aria-labelledby={titleId} className={`${styles.card} flex h-full min-w-0 flex-col`}>
      <header className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-1">
            <h2 id={titleId} className="text-[13px] font-medium leading-5 text-muted-foreground">Tempo assistido</h2>
            <TooltipProvider delayDuration={150}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" aria-label="Como o tempo assistido é calculado" className="inline-flex size-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-[#F1F6EB] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none dark:hover:bg-[#203323]"><Info aria-hidden="true" className="size-3.5" /></button>
                </TooltipTrigger>
                <TooltipContent className="max-w-72 leading-relaxed">A média usa o tempo acumulado das pessoas observadas no período. A curva mostra a maior posição registrada no vídeo neste período, não a duração exata assistida.</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <p className="text-[22px] font-semibold leading-7 tracking-tight tabular-nums text-[#153D30] dark:text-foreground">{duration(watch.averageWatchedSeconds)}</p>
          <p className="text-[11px] leading-4 text-muted-foreground">Média acumulada por pessoa</p>
        </div>
        <div className="pt-1 text-right">
          {watch.pitchAtSeconds !== null && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#A6DE6B]/15 px-2 py-0.5 text-[10px] leading-4 font-medium text-[#07513D] dark:text-[#B7E779]"><Flag aria-hidden="true" className="size-3" />Pitch em {clock(watch.pitchAtSeconds)}</span>
          )}
          <p className="mt-1.5 text-[11px] text-muted-foreground">{number.format(watch.viewerCount)} {watch.viewerCount === 1 ? "pessoa" : "pessoas"}</p>
        </div>
      </header>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-muted-foreground">Alcance ao longo do vídeo</p>
        <div role="group" aria-label="Unidade do alcance do vídeo" className={styles.segmented}>
          {([{ key: "percentage", label: "%", name: "Percentual" }, { key: "viewers", label: "Pessoas", name: "Pessoas" }] as const).map((item) => (
            <motion.button key={item.key} type="button" aria-label={item.name} aria-pressed={mode === item.key} onClick={() => setMode(item.key)} whileTap={{ scale: reducedMotion ? 1 : 0.97 }} className={styles.segment}>{item.label}</motion.button>
          ))}
        </div>
      </div>
      {hasData ? (
        <AreaChart
          data={data}
          index="position"
          categories={[category]}
          colors={["chartLime"]}
          curveType="monotone"
          className="mt-1 h-28 min-h-28"
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
        <div className="mt-1 flex h-28 items-center justify-center text-center text-xs text-muted-foreground">Sem reprodução registrada neste período.</div>
      )}
      <div className="sr-only"><table>
        <caption>Alcance registrado por posição no vídeo</caption>
        <thead><tr><th scope="col">Posição</th><th scope="col">Pessoas</th><th scope="col">Percentual</th></tr></thead>
        <tbody>{watch.retention.map((point) => <tr key={point.positionSeconds}><th scope="row">{clock(point.positionSeconds)}</th><td>{number.format(point.viewers)}</td><td>{percent.format(point.percentage)}%</td></tr>)}</tbody>
      </table></div>
    </section>
  );
}
