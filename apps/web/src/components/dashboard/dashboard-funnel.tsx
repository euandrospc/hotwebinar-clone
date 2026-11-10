"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Portal as TooltipPortal } from "@radix-ui/react-tooltip";
import { Info, Filter } from "@/components/icons";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { FunnelStage } from "@/lib/dashboard-stats";
import surfaceStyles from "@/components/webinar/webinar-operations.module.css";
import styles from "./dashboard-funnel.module.css";

const number = new Intl.NumberFormat("pt-BR");
const percentage = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });
const colors = ["#dcecc8", "#b6d88c", "#8fbe63", "#50875d", "#064b3c"];
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
  const checkpointWidth = Math.max(36, ...stages.map((stage) => number.format(stage.count).length * 7 + 12));
  const chartPadding = Math.max(24, Math.ceil(checkpointWidth / 2) + 4);
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
    <section className={`${surfaceStyles.surface} ${styles.funnel}`} aria-labelledby={`${id}-title`}>
      <header className={styles.header}>
        <span className={styles.icon}><Filter aria-hidden="true" /></span>
        <h3 id={`${id}-title`}>Funil de conversão</h3>
        <TooltipProvider delayDuration={150}>
          <Tooltip>
            <TooltipTrigger asChild><button type="button" className={styles.info} aria-label="Sobre os dados do funil"><Info aria-hidden="true" /></button></TooltipTrigger>
            <TooltipPortal><TooltipContent className={styles.tooltip}>Hoje, no fuso do webinar. Percentuais em relação às visitas. Etapas são contagens independentes; diferenças não comprovam perdas individuais. Compras podem ocorrer sem registro nas etapas anteriores.</TooltipContent></TooltipPortal>
          </Tooltip>
        </TooltipProvider>
      </header>

      {active ? <>
        <div className={styles.chartViewport} role="group" aria-label="Etapas do funil" onPointerLeave={() => setHoveredLabel(null)}>
          <div className={styles.chart} style={{ gridTemplateColumns: `repeat(${stages.length}, minmax(${checkpointWidth}px, 1fr))`, minWidth: stages.length * checkpointWidth + Math.max(0, stages.length - 1) * 6 + chartPadding * 2, paddingInline: chartPadding }}>
          {stages.map((stage, index) => {
            const heightFor = (i: number) => 12 + 88 * ((stages[i]?.count ?? 0) / max);
            const left = heightFor(index);
            const right = index + 1 < stages.length ? heightFor(index + 1) : left;
            const color = colors[Math.min(index, colors.length - 1)];
            return <button
              key={stage.label}
              ref={(element) => { buttons.current[index] = element; }}
              type="button"
              className={styles.stage}
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
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" className={styles.shape} aria-hidden="true">
                <motion.polygon
                  initial={false}
                  animate={{ points: `0,${50 - left / 2} 100,${50 - right / 2} 100,${50 + right / 2} 0,${50 + left / 2}` }}
                  transition={{ duration: reducedMotion ? 0 : 0.25, ease: "easeOut" }}
                  fill={color}
                />
              </svg>
              <span className={styles.checkpoint} aria-hidden="true">{number.format(stage.count)}</span>
              <span className={styles.stageLabel}>{shortLabels[stage.label] ?? stage.label}</span>
            </button>;
          })}
          </div>
        </div>

        <div id={`${id}-detail`} role="region" aria-label="Detalhes da etapa" aria-live="polite" aria-atomic="true" className={styles.detail}>
          <motion.div key={active.label} initial={{ opacity: reducedMotion ? 1 : 0.6 }} animate={{ opacity: 1 }} transition={{ duration: reducedMotion ? 0 : 0.15 }} className={styles.detailContent}>
            <p className={styles.detailLabel}><span aria-hidden="true" style={{ background: colors[Math.min(activeIndex, colors.length - 1)] }} />{active.label}</p>
            <p className={styles.percentage}><strong>{percentFor(active)}</strong><span>em relação às visitas</span></p>
          </motion.div>
        </div>
        <p className={styles.hint}>Explore as etapas · clique para manter a seleção</p>
      </> : <p className={styles.empty}>Nenhuma etapa disponível</p>}
    </section>
  );
}
