"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Portal as TooltipPortal } from "@radix-ui/react-tooltip";
import { Info, Filter } from "@/components/icons";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { FunnelStage } from "@/lib/dashboard-stats";
import { cn } from "@/lib/utils";

const number = new Intl.NumberFormat("pt-BR");
const percentage = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });
const colors = ["#B6CBA8", "#9BC78A", "#6FA352", "#2F6B3E", "#0E4A35"];
const shortLabels: Record<string, string> = {
  Visitas: "Visitas",
  "Acessou o webinar": "Webinar",
  "Chegou no pitch": "Pitch",
  "Clicou na oferta": "Oferta",
  Comprou: "Compra"
};

export function DashboardFunnel({ stages }: { stages: FunnelStage[] }) {
  const id = useId();
  const reducedMotion = useReducedMotion();
  const [selectedLabel, setSelectedLabel] = useState(() => stages.at(-1)?.label);
  const [hoveredLabel, setHoveredLabel] = useState<string | null>(null);
  const [focusedLabel, setFocusedLabel] = useState<string | null>(null);
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedIndex = stages.findIndex((stage) => stage.label === selectedLabel);
  const selected = selectedIndex >= 0 ? selectedIndex : Math.max(0, stages.length - 1);
  const previewIndex = stages.findIndex((stage) => stage.label === (hoveredLabel ?? focusedLabel));
  const activeIndex = previewIndex >= 0 ? previewIndex : selected;
  const active = stages[activeIndex];
  const max = Math.max(1, ...stages.map((stage) => stage.count));
  const base = stages[0]?.count ?? 0;
  const checkpointWidth = Math.max(48, ...stages.map((stage) => number.format(stage.count).length * 7 + 28));
  const percentFor = (stage: FunnelStage) => base > 0 && Number.isFinite(stage.pct) ? `${percentage.format(stage.pct)}%` : "—";

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next: number | undefined;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (index + 1) % stages.length;
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (index - 1 + stages.length) % stages.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = stages.length - 1;
    if (event.key === "Escape") {
      setHoveredLabel(null);
      setFocusedLabel(null);
      next = selected;
    }
    if (next === undefined) return;
    event.preventDefault();
    setHoveredLabel(null);
    buttons.current[next]?.focus();
  }

  return (
    <section className="flex min-w-0 flex-col gap-4 rounded-2xl border border-[#1E241F] bg-[#0C0E0C] p-[18px]" aria-labelledby={`${id}-title`}>
      <header className="flex items-center gap-2">
        <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-palco/[.12] text-palco"><Filter aria-hidden="true" className="h-3 w-3" /></span>
        <h3 id={`${id}-title`} className="text-[13px] font-semibold text-neutral-100">Funil de conversão</h3>
        <TooltipProvider delayDuration={150}>
          <Tooltip>
            <TooltipTrigger asChild><button type="button" className="ml-auto inline-flex h-6 w-6 items-center justify-center rounded-full text-[#5A635C] transition-colors hover:bg-white/5 hover:text-neutral-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-palco motion-reduce:transition-none" aria-label="Sobre os dados do funil"><Info aria-hidden="true" className="h-3.5 w-3.5" /></button></TooltipTrigger>
            <TooltipPortal><TooltipContent className="max-w-[min(320px,calc(100vw-32px))] rounded-xl border-[#1E241F] bg-[#121512] p-3 text-xs leading-relaxed text-neutral-300">Hoje, no fuso do webinar. Percentuais em relação às visitas. Etapas são contagens independentes; diferenças não comprovam perdas individuais. Compras podem ocorrer sem registro nas etapas anteriores.</TooltipContent></TooltipPortal>
          </Tooltip>
        </TooltipProvider>
      </header>

      {active ? <>
        <div className="min-w-0 overflow-x-auto [scrollbar-width:thin]" role="group" aria-label="Etapas do funil" onPointerLeave={() => setHoveredLabel(null)}>
          <div className="grid gap-0.5" style={{ gridTemplateColumns: `repeat(${stages.length}, minmax(${checkpointWidth}px, 1fr))`, minWidth: stages.length * checkpointWidth + Math.max(0, stages.length - 1) * 2 }}>
          {stages.map((stage, index) => {
            const heightFor = (i: number) => 13 + 76 * ((stages[i]?.count ?? 0) / max);
            const left = heightFor(index);
            const right = index + 1 < stages.length ? heightFor(index + 1) : left;
            const color = colors[Math.min(index, colors.length - 1)];
            return <button
              key={stage.label}
              ref={(element) => { buttons.current[index] = element; }}
              type="button"
              className="relative flex min-w-0 cursor-pointer flex-col items-stretch gap-4 rounded-md p-0 [-webkit-tap-highlight-color:transparent] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-palco"
              data-active={activeIndex === index}
              aria-label={`${stage.label}: ${number.format(stage.count)}, ${percentFor(stage)} em relação às visitas`}
              aria-pressed={selected === index}
              aria-controls={`${id}-detail`}
              tabIndex={selected === index ? 0 : -1}
              onPointerEnter={(event) => { if (event.pointerType !== "touch") setHoveredLabel(stage.label); }}
              onPointerLeave={() => setHoveredLabel(null)}
              onFocus={() => setFocusedLabel(stage.label)}
              onBlur={() => setFocusedLabel(null)}
              onClick={() => { setSelectedLabel(stage.label); setHoveredLabel(null); }}
              onKeyDown={(event) => handleKeyDown(event, index)}
            >
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" className={cn("block h-[90px] w-full transition-[opacity,filter] duration-150 motion-reduce:transition-none", activeIndex === index ? "opacity-100 saturate-[1.12]" : "opacity-90")} aria-hidden="true">
                <motion.polygon
                  initial={false}
                  animate={{ points: `0,${50 - left / 2} 100,${50 - right / 2} 100,${50 + right / 2} 0,${50 + left / 2}` }}
                  transition={{ duration: reducedMotion ? 0 : 0.25, ease: "easeOut" }}
                  fill={color}
                />
              </svg>
              <span className={cn("absolute left-2 top-[45px] z-[1] inline-flex -translate-y-1/2 items-center justify-center rounded-full border px-2 py-1 text-[10px] font-bold leading-none tabular-nums text-neutral-100 transition-colors duration-150 motion-reduce:transition-none", activeIndex === index ? "border-palco/50 bg-[#123020]" : "border-[#3A4A3D] bg-[#1B241D]")} aria-hidden="true">{number.format(stage.count)}</span>
              <span className={cn("self-start whitespace-nowrap text-left text-[11px] leading-4 transition-colors duration-150 motion-reduce:transition-none", activeIndex === index ? "font-semibold text-[#B6F09A]" : "text-[#7C867E]")}>{shortLabels[stage.label] ?? stage.label}</span>
            </button>;
          })}
          </div>
        </div>

        <div id={`${id}-detail`} role="region" aria-label="Detalhes da etapa" aria-live="polite" aria-atomic="true" className="rounded-xl border border-[#1E3A26] bg-[#102516] px-3.5 py-3">
          <motion.div key={active.label} initial={{ opacity: reducedMotion ? 1 : 0.6 }} animate={{ opacity: 1 }} transition={{ duration: reducedMotion ? 0 : 0.15 }} className="flex items-center justify-between gap-4">
            <p className="min-w-0 text-[13px] font-semibold text-neutral-100">{active.label}</p>
            <p className="flex shrink-0 flex-col items-end gap-0.5"><strong className="text-lg font-semibold leading-tight tabular-nums text-[#B6F09A]">{percentFor(active)}</strong><span className="text-[10px] text-[#7C867E]">em relação às visitas</span></p>
          </motion.div>
        </div>
        <p className="text-[10px] text-[#6E776F]">Explore as etapas · clique para manter a seleção</p>
      </> : <p className="text-sm text-[#7C867E]">Nenhuma etapa disponível</p>}
    </section>
  );
}
