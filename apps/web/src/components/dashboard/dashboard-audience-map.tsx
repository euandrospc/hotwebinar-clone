"use client";

import { useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { MapPin, RotateCcw } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BRAZIL_STATES } from "./geography/brazil-states";
import styles from "./dashboard-card.module.css";

export interface DashboardAudienceGeography {
  regions: Array<{ code: string; name: string; count: number }>;
  unlocated: number;
  outsideBrazil: number;
  brazilUnresolved: number;
  totalAccesses: number;
}

const number = new Intl.NumberFormat("pt-BR");
const percentage = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const COLORS = ["#DDEDC8", "#AFD775", "#72AD62", "#347D58", "#064B3C"];

export function DashboardAudienceMap({ geography }: { geography: DashboardAudienceGeography }) {
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [hoveredCode, setHoveredCode] = useState<string | null>(null);
  const paths = useRef<Map<string, SVGPathElement>>(new Map());
  const reduceMotion = useReducedMotion();
  const titleId = useId();
  const descriptionId = useId();
  const states = useMemo(() => {
    const counts = new Map(geography.regions.map((region) => [region.code.toUpperCase().replace(/^BR-/, ""), region.count]));
    return BRAZIL_STATES.map((state) => ({ ...state, count: counts.get(state.code) ?? 0 }));
  }, [geography.regions]);
  const ranking = [...states].filter((state) => state.count > 0).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "pt-BR"));
  const located = states.reduce((sum, state) => sum + state.count, 0);
  const max = Math.max(1, ...states.map((state) => state.count));
  const selected = states.find((state) => state.code === selectedCode);
  const hovered = states.find((state) => state.code === hoveredCode);
  const percent = (count: number) => geography.totalAccesses > 0 ? `${percentage.format(count / geography.totalAccesses * 100)}%` : "—";

  function fill(count: number) {
    if (count === 0) return "#E9EEE8";
    return COLORS[Math.min(COLORS.length - 1, Math.floor(count / max * (COLORS.length - 1)))];
  }

  function select(code: string | null) {
    setSelectedCode(code);
    setHoveredCode(null);
  }

  function onStateKeyDown(event: KeyboardEvent<SVGPathElement>, index: number) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      select(selectedCode === states[index].code ? null : states[index].code);
      return;
    }
    if (event.key === "Escape") { select(null); return; }
    let next: number | undefined;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (index + 1) % states.length;
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (index - 1 + states.length) % states.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = states.length - 1;
    if (next === undefined) return;
    event.preventDefault();
    paths.current.get(states[next].code)?.focus();
  }

  return (
    <section aria-labelledby={titleId} className={cn(styles.card, "flex h-full min-w-0 flex-col [container-type:inline-size]")}>
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id={titleId} className="text-[13px] font-semibold tracking-tight">Localização do público</h2>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Localização aproximada · no período</p>
        </div>
        {selected && <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-[#52733D] hover:bg-[#EDF4E7] focus-visible:ring-[#83B94D] motion-reduce:transition-none dark:text-[#C5E99D] dark:hover:bg-[#233A28]" aria-label="Restaurar visão do Brasil" title="Restaurar visão do Brasil" onClick={() => select(null)}><RotateCcw className="h-3.5 w-3.5" /></Button>}
      </header>
      <p id={descriptionId} className="sr-only">Mapa do Brasil por unidade da Federação. As cores indicam quantidades de acessos. Clique ou toque em um estado para selecionar; selecione novamente para restaurar a visão do Brasil. Pelo teclado, use as setas para explorar, Enter ou espaço para selecionar e Escape para limpar a seleção. Percentuais sobre todos os acessos do período.</p>

      <div className="mt-3 grid flex-1 items-center gap-3 [@container(min-width:300px)]:grid-cols-[minmax(0,1.2fr)_minmax(120px,1fr)] [@container(min-width:470px)]:grid-cols-[minmax(0,1.45fr)_minmax(145px,0.9fr)]">
        <div className={cn(styles.inset, "relative min-w-0 px-2 py-2")}>
          <svg viewBox="0 0 420 420" className="mx-auto h-[180px] w-full max-w-[280px] [@container(min-width:420px)]:h-[206px]" role="group" aria-labelledby={titleId} aria-describedby={descriptionId}>
            {states.map((state, index) => (
              <motion.path
                key={state.code}
                ref={(node) => { if (node) paths.current.set(state.code, node); else paths.current.delete(state.code); }}
                d={state.path}
                fillRule="evenodd"
                initial={false}
                animate={{ fill: selectedCode === state.code || hoveredCode === state.code ? "#91C85D" : fill(state.count), opacity: selectedCode && selectedCode !== state.code ? 0.52 : 1 }}
                transition={{ duration: reduceMotion ? 0 : 0.16 }}
                stroke={selectedCode === state.code || hoveredCode === state.code ? "#064B3C" : "#FFFFFF"}
                strokeWidth={selectedCode === state.code || hoveredCode === state.code ? 1.7 : 0.8}
                vectorEffect="non-scaling-stroke"
                className="cursor-pointer outline-none focus:stroke-[#064B3C] focus:[stroke-width:2.4px]"
                role="button"
                tabIndex={selectedCode ? (selectedCode === state.code ? 0 : -1) : (index === 0 ? 0 : -1)}
                aria-label={`${state.name}: ${number.format(state.count)} acessos, ${percent(state.count)} do total`}
                aria-pressed={selectedCode === state.code}
                onClick={() => select(selectedCode === state.code ? null : state.code)}
                onPointerEnter={() => setHoveredCode(state.code)}
                onPointerLeave={() => setHoveredCode(null)}
                onFocus={() => setHoveredCode(state.code)}
                onBlur={() => setHoveredCode(null)}
                onKeyDown={(event) => onStateKeyDown(event, index)}
              >
                <title>{`${state.name} · ${number.format(state.count)} acessos · ${percent(state.count)}`}</title>
              </motion.path>
            ))}
          </svg>
          {hovered && <div role="tooltip" className="pointer-events-none absolute left-1/2 top-2 z-10 w-max max-w-[95%] -translate-x-1/2 rounded-lg border border-[#E1E8DA] bg-white/95 px-2.5 py-1.5 text-center text-[11px] shadow-[0_4px_16px_-4px_rgba(24,48,33,0.16)] backdrop-blur-sm dark:border-[#334533] dark:bg-[#19221B]/95"><span className="font-medium">{hovered.name}</span><span className="ml-1.5 inline-block text-muted-foreground">{number.format(hovered.count)} · {percent(hovered.count)}</span></div>}
          <div aria-hidden="true" className="mx-auto mt-1 flex max-w-[220px] items-center justify-center gap-2 text-[9px] text-muted-foreground"><span>0</span><span className="h-1.5 flex-1 rounded-full bg-[linear-gradient(90deg,#E9EEE8,#AFD775,#347D58,#064B3C)]" /><span>{number.format(max === 1 && located === 0 ? 0 : max)} acessos</span></div>
        </div>

        <div className="flex min-w-0 flex-col self-stretch py-1">
          <div aria-live="polite" aria-atomic="true">
            <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><MapPin className="h-3 w-3" />{selected?.name ?? "UFs identificadas"}</p>
            <motion.p key={selectedCode ?? "BR"} initial={reduceMotion ? false : { opacity: 0.6, y: 2 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduceMotion ? 0 : 0.18 }} className="mt-1 text-2xl font-semibold tracking-tight tabular-nums text-[#064B3C] dark:text-[#B7E779]">{number.format(selected?.count ?? located)}</motion.p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{percent(selected?.count ?? located)} dos acessos do período</p>
          </div>
          {ranking.length > 0 ? <div className="mt-3">
            <p className="mb-1.5 text-[10px] font-medium text-muted-foreground">Maiores concentrações</p>
            <ul className="space-y-0.5">
              {ranking.slice(0, 3).map((state) => <li key={state.code}><button type="button" aria-pressed={selectedCode === state.code} onClick={() => select(selectedCode === state.code ? null : state.code)} className={cn("w-full rounded-lg p-1.5 text-left text-[11px] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#80B94C] motion-reduce:transition-none", selectedCode === state.code ? "bg-[#EDF5E5] text-[#175039] dark:bg-[#233D2A] dark:text-[#C5E99D]" : "hover:bg-[#F1F6EB] dark:hover:bg-[#1D2D20]")}><span className="flex items-center justify-between gap-2"><span className="truncate">{state.name}</span><span className="shrink-0 tabular-nums text-muted-foreground">{percent(state.count)}</span></span><span className="mt-1.5 block h-1 rounded-full bg-muted"><motion.span initial={false} className="block h-full rounded-full bg-gradient-to-r from-[#78AD55] to-[#A4CE76]" animate={{ width: `${Math.min(100, state.count / Math.max(1, geography.totalAccesses) * 100)}%` }} transition={{ duration: reduceMotion ? 0 : 0.3 }} /></span></button></li>)}
            </ul>
          </div> : <p className="mt-5 text-xs leading-relaxed text-muted-foreground">{geography.totalAccesses === 0 ? "Nenhum acesso registrado neste período." : "Ainda não há acessos com UF identificada. As localizações disponíveis serão exibidas aqui."}</p>}
        </div>
      </div>

      <footer className="mt-3 border-t border-border/50 pt-2.5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[10px] text-muted-foreground">
          <span>{number.format(geography.unlocated)} sem localização</span>
          {geography.outsideBrazil > 0 && <span>{number.format(geography.outsideBrazil)} fora do Brasil</span>}
          {geography.brazilUnresolved > 0 && <span>{number.format(geography.brazilUnresolved)} no Brasil sem UF</span>}
        </div>
        <div className="mt-1.5 flex flex-wrap items-center justify-between gap-1.5 text-[10px] text-muted-foreground">
          <span>Base: {number.format(geography.totalAccesses)} acessos · última localização conhecida</span>
          <a href="https://servicodados.ibge.gov.br/api/docs/malhas?versao=3" target="_blank" rel="noreferrer" className="rounded-sm underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Mapa: IBGE · CC BY 4.0</a>
        </div>
      </footer>
    </section>
  );
}
