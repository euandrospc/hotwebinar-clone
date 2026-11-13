"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Portal as TooltipPortal } from "@radix-ui/react-tooltip";
import { ArrowRight, Info, Users } from "@/components/icons";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { DashboardFunnelTransition } from "@/lib/dashboard-overview";
import type { FunnelStage } from "@/lib/dashboard-stats";
import { cn } from "@/lib/utils";
import styles from "./dashboard-card.module.css";

const number = new Intl.NumberFormat("pt-BR");
const percentage = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });
const stagePercentage = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const formatPercent = (value: number | null) => value === null ? "—" : `${percentage.format(value)}%`;
const formatStagePercent = (value: number | null) => value === null ? "—" : `${stagePercentage.format(value)}%`;
const chartWidth = 1000;
const chartHeight = 180;
const center = 72;

/** Nested contours style one quantity series; they are not separate cohorts. */
function ribbonPath(counts: number[], max: number, scale: number) {
  const step = chartWidth / counts.length;
  const x = (index: number) => step * (index + 0.5);
  const half = (index: number) => counts[index] / max * 52 * scale;
  const plateau = Math.min(22, step * 0.12);
  let path = `M 0 ${center - half(0)} L ${x(0) + plateau} ${center - half(0)}`;
  for (let index = 1; index < counts.length; index++) {
    const from = x(index - 1) + plateau;
    const to = x(index) - plateau;
    path += ` C ${from + (to - from) * 0.48} ${center - half(index - 1)}, ${from + (to - from) * 0.52} ${center - half(index)}, ${to} ${center - half(index)} L ${x(index) + plateau} ${center - half(index)}`;
  }
  path += ` L ${chartWidth} ${center - half(counts.length - 1)} L ${chartWidth} ${center + half(counts.length - 1)} L ${x(counts.length - 1) - plateau} ${center + half(counts.length - 1)}`;
  for (let index = counts.length - 2; index >= 0; index--) {
    const from = x(index + 1) - plateau;
    const to = x(index) + plateau;
    path += ` C ${from - (from - to) * 0.48} ${center + half(index + 1)}, ${from - (from - to) * 0.52} ${center + half(index)}, ${to} ${center + half(index)} L ${x(index) - plateau} ${center + half(index)}`;
  }
  return `${path} L 0 ${center + half(0)} Z`;
}

const shortLabels = ["Acessos", "Vídeo", "Pitch", "Oferta", "Compra"];
const missingLabels = ["Sem acesso registrado", "Sem reprodução", "Sem registro de pitch", "Sem clique na oferta", "Sem compra registrada"];
const additionalLabels = ["", "reproduções sem acesso registrado", "registros de pitch sem reprodução registrada", "cliques sem registro de pitch", "compradores sem clique registrado"];
const stageDescriptions = [
  "Pessoas identificadas com atividade registrada no webinar.",
  "Pessoas com reprodução registrada no período.",
  "Pessoas com registro de chegada ao pitch ou posição do vídeo correspondente.",
  "Pessoas que clicaram na oferta no período.",
  "Compradores identificados entre os acessos, com venda em reais no período."
];

interface Props {
  stages: FunnelStage[];
  transitions?: DashboardFunnelTransition[];
}

export function DashboardFunnelOverview({ stages, transitions = [] }: Props) {
  const reducedMotion = useReducedMotion();
  const [mode, setMode] = useState<"base" | "previous">("base");
  const [selectedIndex, setSelectedIndex] = useState(2);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  const id = useId();
  const max = Math.max(0, ...stages.map((stage) => stage.count));
  const base = stages[0]?.count ?? 0;
  const lastIndex = Math.max(0, stages.length - 1);
  const selected = Math.min(selectedIndex, lastIndex);
  const activeIndex = Math.min(hoveredIndex ?? focusedIndex ?? selected, lastIndex);
  const active = stages[activeIndex];
  const previous = activeIndex > 0 ? stages[activeIndex - 1] : undefined;
  // A transition is a measured intersection, never inferred from the totals.
  const transitionAt = (index: number) => transitions.find((item) =>
    item.fromLabel === stages[index - 1]?.label && item.toLabel === stages[index]?.label &&
    item.fromCount === stages[index - 1]?.count && item.toCount === stages[index]?.count
  );
  const hasMeasuredTransitions = stages.length > 1 && stages.slice(1).every((_, index) => Boolean(transitionAt(index + 1)));
  const transition = hasMeasuredTransitions ? transitionAt(activeIndex) : undefined;
  const delta = active && previous ? active.count - previous.count : 0;
  const ratio = active && previous && previous.count > 0 ? active.count / previous.count * 100 : null;
  const baseRatio = active && base > 0 ? active.count / base * 100 : null;
  const duration = reducedMotion ? 0 : 0.24;
  const activeX = (activeIndex + 0.5) / Math.max(1, stages.length) * chartWidth;

  function selectStage(index: number) {
    setSelectedIndex(index);
    setHoveredIndex(null);
    setFocusedIndex(null);
  }
  function onStageKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key === "Escape") {
      setHoveredIndex(null);
      setFocusedIndex(null);
      buttons.current[selected]?.focus();
      return;
    }
    let next: number | undefined;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (index + 1) % stages.length;
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (index - 1 + stages.length) % stages.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = stages.length - 1;
    if (next === undefined) return;
    event.preventDefault();
    buttons.current[next]?.focus();
  }
  function stagePercent(index: number) {
    if (mode === "previous" && hasMeasuredTransitions) {
      const measured = transitionAt(index);
      if (measured) return measured.overlapRate;
    }
    const denominator = mode === "base" ? base : index > 0 ? stages[index - 1].count : 0;
    return denominator > 0 ? stages[index].count / denominator * 100 : null;
  }
  function stageAccessibleLabel(index: number) {
    const stage = stages[index];
    const measured = mode === "previous" && hasMeasuredTransitions ? transitionAt(index) : undefined;
    return measured
      ? `${stage.label}: ${number.format(stage.count)} pessoas; ${number.format(measured.overlapCount)} de ${number.format(measured.fromCount)} da etapa anterior também nesta etapa (${formatPercent(measured.overlapRate)})`
      : `${stage.label}: ${number.format(stage.count)}, ${formatPercent(stagePercent(index))}`;
  }

  return (
    <section className={cn(styles.card, "flex h-full min-w-0 flex-col overflow-hidden [container-type:inline-size]")} aria-labelledby={`${id}-title`}>
      <header className="flex flex-wrap items-start justify-between gap-2.5">
        <div>
          <div className="flex items-center gap-1.5">
            <h2 id={`${id}-title`} className="text-base font-semibold text-neutral-100">Funil de conversão</h2>
            <TooltipProvider delayDuration={150}>
              <Tooltip>
                <TooltipTrigger asChild><button type="button" aria-label="Como o funil é calculado" className="inline-flex size-6 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-white/5 hover:text-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-palco motion-reduce:transition-none"><Info aria-hidden="true" className="size-3.5" /></button></TooltipTrigger>
                <TooltipPortal><TooltipContent className="max-w-[min(20rem,calc(100vw-2rem))] rounded-xl border-[#E1E8DA] bg-white/95 leading-relaxed shadow-[0_8px_24px_-8px_rgba(24,48,33,0.2)] backdrop-blur-sm dark:border-[#334533] dark:bg-[#19221B]/95">O fluxo mostra pessoas únicas por etapa, entre os acessos identificados na plataforma. Captação externa não é medida. {hasMeasuredTransitions ? "Entre etapas mostra quem tem registro em ambas no período, sem inferir a ordem das ações. Ausência de registro não comprova abandono. Compras podem ocorrer sem clique na oferta." : "As etapas são contagens independentes; diferenças não comprovam perdas individuais."} As camadas de cor representam a mesma série.</TooltipContent></TooltipPortal>
              </Tooltip>
            </TooltipProvider>
          </div>
          <p className="mt-1 text-sm text-neutral-500">Do acesso à compra · pessoas únicas</p>
        </div>
        <div role="group" aria-label="Base dos percentuais do funil" className={styles.segmented}>
          {([{ key: "base", label: "Sobre acessos" }, { key: "previous", label: "Entre etapas" }] as const).map((option) => (
            <button key={option.key} type="button" aria-pressed={mode === option.key} onClick={() => setMode(option.key)} className={styles.segment}>{option.label}</button>
          ))}
        </div>
      </header>

      {max === 0 ? (
        <div className="flex min-h-64 flex-1 flex-col items-center justify-center gap-2 text-center">
          <Users aria-hidden="true" className="mb-2 size-7 text-muted-foreground/50" />
          <p className="text-sm font-medium">Nenhum acesso registrado neste período</p>
          <p className="text-xs text-muted-foreground">O funil aparece conforme os eventos do webinar são registrados.</p>
        </div>
      ) : (
        <>
          <div className="mb-2 mt-1 flex flex-1 flex-col justify-center">
            <div className="max-w-full overflow-x-auto overflow-y-hidden overscroll-x-contain rounded-xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Fluxo de conversão por etapa">
              <div className="relative min-w-[500px]" style={{ height: chartHeight }}>
                <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
                  <defs>
                    <linearGradient id={`${id}-outer`} x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#D7EDBF" /><stop offset="100%" stopColor="#80B69A" /></linearGradient>
                    <linearGradient id={`${id}-middle`} x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#AFDA84" /><stop offset="100%" stopColor="#3C9070" /></linearGradient>
                    <linearGradient id={`${id}-inner`} x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#78C18B" /><stop offset="100%" stopColor="#146C52" /></linearGradient>
                    <linearGradient id={`${id}-core`} x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#44A781" /><stop offset="100%" stopColor="#064E3B" /></linearGradient>
                    <linearGradient id={`${id}-focus`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2BE07A" stopOpacity="0" /><stop offset="50%" stopColor="#2BE07A" stopOpacity="0.08" /><stop offset="100%" stopColor="#2BE07A" stopOpacity="0" /></linearGradient>
                    <clipPath id={`${id}-reveal`}><motion.rect y="0" height={chartHeight} initial={reducedMotion ? false : { width: 0 }} animate={{ width: chartWidth }} transition={{ duration: reducedMotion ? 0 : 0.7, ease: [0.22, 1, 0.36, 1] }} /></clipPath>
                  </defs>
                  <motion.rect initial={false} animate={{ x: activeX - chartWidth / stages.length / 2 }} transition={{ duration, ease: "easeOut" }} y="0" width={chartWidth / stages.length} height={chartHeight - 4} fill={`url(#${id}-focus)`} rx="12" />
                  <g clipPath={`url(#${id}-reveal)`}>
                    {([{ scale: 1, fill: "outer" }, { scale: 0.76, fill: "middle" }, { scale: 0.51, fill: "inner" }, { scale: 0.27, fill: "core" }]).map((layer) => (
                      <motion.path key={layer.fill} initial={false} animate={{ d: ribbonPath(stages.map((stage) => stage.count), max, layer.scale) }} transition={{ duration: reducedMotion ? 0 : 0.5 }} fill={`url(#${id}-${layer.fill})`} />
                    ))}
                  </g>
                  {stages.map((stage, index) => (
                    <line key={stage.label} x1={(index + 0.5) / stages.length * chartWidth} x2={(index + 0.5) / stages.length * chartWidth} y1="0" y2="132" stroke="currentColor" className="text-[#1e241f]" strokeWidth="1" vectorEffect="non-scaling-stroke" />
                  ))}
                </svg>
                <ol aria-label="Etapas do funil" className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${stages.length}, minmax(0, 1fr))` }}>
                  {stages.map((stage, index) => (
                    <li key={stage.label} className="min-w-0">
                      <button
                        ref={(node) => { buttons.current[index] = node; }}
                        type="button"
                        aria-pressed={selected === index}
                        aria-controls={`${id}-details`}
                        aria-label={stageAccessibleLabel(index)}
                        onPointerEnter={(event) => { if (event.pointerType !== "touch") setHoveredIndex(index); }}
                        onPointerLeave={() => setHoveredIndex(null)}
                        onFocus={() => setFocusedIndex(index)}
                        onBlur={() => setFocusedIndex(null)}
                        onClick={() => selectStage(index)}
                        onKeyDown={(event) => onStageKeyDown(event, index)}
                        className="relative block h-full w-full rounded-xl text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                      >
                        <span className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2" style={{ top: center }}>
                          <motion.span initial={false} animate={{ scale: !reducedMotion && activeIndex === index ? 1.035 : 1, y: !reducedMotion && activeIndex === index ? -1 : 0 }} transition={{ duration }} className={cn("inline-flex min-w-[44px] items-center justify-center rounded-full border px-3 py-[5px] text-[13px] font-bold tabular-nums transition-colors motion-reduce:transition-none", activeIndex === index ? "border-palco bg-[#0c0e0c] text-palco" : "border-palco/35 bg-[#123524] text-neutral-100")}>{number.format(stage.count)}</motion.span>
                        </span>
                        <span className="absolute inset-x-1 bottom-0 flex h-12 flex-col items-center justify-start gap-1">
                          <span className={cn("text-[13px] leading-tight", activeIndex === index ? "font-bold text-palco" : "font-medium text-neutral-300")}>{stage.label}</span>
                          <span className={cn("text-xs tabular-nums", activeIndex === index ? "font-bold text-palco" : "text-neutral-500")}>{formatStagePercent(stagePercent(index))}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
            <div className="mt-2 flex min-h-7 items-center justify-between gap-2 text-xs text-neutral-500 [@container(min-width:500px)]:min-h-[15px]">
              <span>{mode === "base" ? "% do total de acessos" : hasMeasuredTransitions ? "% da etapa anterior com registro nas duas" : "Razão entre as contagens das etapas"}</span>
              <span className="hidden shrink-0 [@container(min-width:500px)]:inline">Passe o mouse · clique para fixar</span>
              <span className="shrink-0 [@container(min-width:500px)]:hidden">Deslize e toque</span>
            </div>
          </div>

          {/* Reserve room for the longest stage details at each width so inspection does not move the chart or neighboring cards. */}
          {active && (
            <div id={`${id}-details`} role="region" aria-label="Detalhes da etapa" aria-live="polite" aria-atomic="true" className="mt-auto min-h-[192px] border-t border-[#1e241f] pt-3.5 [@container(min-width:300px)]:min-h-[164px] [@container(min-width:500px)]:min-h-[128px]">
              <motion.div key={activeIndex} initial={reducedMotion ? false : { opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reducedMotion ? 0 : 0.16 }}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="flex items-center gap-2 text-sm font-semibold text-neutral-100"><span className="font-normal text-neutral-400">{previous ? shortLabels[activeIndex - 1] ?? previous.label : "01"}</span><ArrowRight aria-hidden="true" className="size-3.5 text-neutral-500" />{active.label}</p>
                  <span className="text-xs tabular-nums text-neutral-500">{formatStagePercent(baseRatio)} dos acessos</span>
                </div>
                {transition ? (
                  <>
                    <dl className="mt-3 grid grid-cols-3">
                      <div><dt className="min-h-7 text-xs text-neutral-500 [@container(min-width:500px)]:min-h-0">Nas duas etapas</dt><dd className="mt-1 text-[22px] font-bold leading-tight tabular-nums text-palco">{formatPercent(transition.overlapRate)}</dd></div>
                      <div className="border-l border-[#1e241f] px-2 sm:px-4"><dt className="min-h-7 text-xs text-neutral-500 [@container(min-width:500px)]:min-h-0">Pessoas em comum</dt><dd className="mt-1 text-[22px] font-bold leading-tight tabular-nums text-neutral-100">{number.format(transition.overlapCount)}</dd></div>
                      <div className="border-l border-[#1e241f] px-2 sm:px-4"><dt className="min-h-7 text-xs text-neutral-500 [@container(min-width:500px)]:min-h-0">{missingLabels[activeIndex] ?? "Só na etapa anterior"}</dt><dd className="mt-1 text-[22px] font-bold leading-tight tabular-nums text-neutral-100">{number.format(transition.previousOnlyCount)}</dd></div>
                    </dl>
                    <div className="mt-3 flex h-1 overflow-hidden rounded-full bg-[#1a1f1b]" aria-hidden="true"><motion.div initial={false} animate={{ width: `${transition.overlapRate ?? 0}%` }} transition={{ duration }} className="h-full rounded-full bg-palco" /></div>
                    <p className="mt-2 min-h-7 text-xs leading-relaxed text-neutral-500">{transition.currentOnlyCount > 0 ? <>{number.format(transition.currentOnlyCount)} {additionalLabels[activeIndex] || "nesta etapa sem registro na anterior"}. </> : null}{transition.fromCount === 0 ? "Etapa anterior sem registros; percentual indisponível." : `${number.format(transition.overlapCount)} de ${number.format(transition.fromCount)} pessoas aparecem nas duas etapas no período.`}</p>
                  </>
                ) : (
                  <div className="mt-2 flex min-h-[72px] items-start justify-between gap-3">
                    <div><p className="max-w-sm text-xs leading-relaxed text-neutral-500">{stageDescriptions[activeIndex] ?? "Pessoas com registro nesta etapa no período."}</p><p className="mt-1.5 text-xs text-neutral-500">{!previous ? `${number.format(active.count)} pessoas compõem a base deste funil.` : delta === 0 ? "Mesma quantidade da etapa anterior." : `${number.format(Math.abs(delta))} ${delta < 0 ? "a menos" : "a mais"} que a etapa anterior.`}{previous && ratio === null && " Etapa anterior sem registros; comparação percentual indisponível."}</p></div>
                    <div className="shrink-0 text-right"><strong className="text-[22px] font-bold leading-tight tabular-nums text-palco">{previous ? formatPercent(ratio) : number.format(active.count)}</strong><p className="mt-1 text-[10px] text-muted-foreground">{previous ? "da quantidade anterior" : "acessos identificados"}</p></div>
                  </div>
                )}
              </motion.div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
