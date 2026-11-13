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
const COLORS = ["#DCEBD2", "#A6D69A", "#3FA06A", "#0F6A43"];

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
    if (count === 0) return "#DCEBD2";
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
          <h2 id={titleId} className="text-base font-semibold text-neutral-100">Localização do público</h2>
          <p className="mt-1 text-sm text-neutral-500">Localização aproximada · no período</p>
        </div>
        {selected && <Button variant="ghost" size="icon" className="size-7 rounded-lg text-palco hover:bg-white/5 focus-visible:ring-palco motion-reduce:transition-none" aria-label="Restaurar visão do Brasil" title="Restaurar visão do Brasil" onClick={() => select(null)}><RotateCcw className="h-3.5 w-3.5" /></Button>}
      </header>
      <p id={descriptionId} className="sr-only">Mapa do Brasil por unidade da Federação. As cores indicam quantidades de acessos. Clique ou toque em um estado para selecionar; selecione novamente para restaurar a visão do Brasil. Pelo teclado, use as setas para explorar, Enter ou espaço para selecionar e Escape para limpar a seleção. Percentuais sobre todos os acessos do período.</p>

      <div className="mt-5 grid flex-1 items-start gap-5 [@container(min-width:380px)]:grid-cols-[216px_minmax(0,1fr)]">
        <div className="relative min-w-0 rounded-xl border border-[#1a1f1b] bg-[#070807] px-3 py-3.5">
          <svg viewBox="0 0 420 420" className="mx-auto h-[185px] w-full max-w-[190px]" role="group" aria-labelledby={titleId} aria-describedby={descriptionId}>
            {states.map((state, index) => (
              <motion.path
                key={state.code}
                ref={(node) => { if (node) paths.current.set(state.code, node); else paths.current.delete(state.code); }}
                d={state.path}
                fillRule="evenodd"
                initial={false}
                animate={{ fill: selectedCode === state.code || hoveredCode === state.code ? "#2BE07A" : fill(state.count), opacity: selectedCode && selectedCode !== state.code ? 0.52 : 1 }}
                transition={{ duration: reduceMotion ? 0 : 0.16 }}
                stroke={selectedCode === state.code || hoveredCode === state.code ? "#F2F5F2" : "#070807"}
                strokeWidth={selectedCode === state.code || hoveredCode === state.code ? 1.7 : 0.8}
                vectorEffect="non-scaling-stroke"
                className="cursor-pointer outline-none focus:stroke-neutral-100 focus:[stroke-width:2.4px]"
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
          {hovered && <div role="tooltip" className="pointer-events-none absolute left-1/2 top-2 z-10 w-max max-w-[95%] -translate-x-1/2 rounded-lg border border-white/10 bg-neutral-900/95 px-2.5 py-1.5 text-center text-xs shadow-xl backdrop-blur-sm"><span className="font-medium">{hovered.name}</span><span className="ml-1.5 inline-block text-neutral-400">{number.format(hovered.count)} · {percent(hovered.count)}</span></div>}
          <div aria-hidden="true" className="mt-3 flex items-center gap-1.5 text-[10px] text-neutral-500"><span>0</span><span className="h-1.5 flex-1 rounded-full bg-[linear-gradient(90deg,#DCEBD2,#0F6A43)]" /><span>{number.format(max === 1 && located === 0 ? 0 : max)}</span></div>
        </div>

        <div className="flex min-w-0 flex-col gap-[18px] self-stretch">
          <div aria-live="polite" aria-atomic="true">
            <p className="flex items-center gap-1.5 text-xs text-neutral-400"><MapPin className="size-[13px] text-neutral-500" />{selected?.name ?? "Acessos com UF identificada"}</p>
            <motion.p key={selectedCode ?? "BR"} initial={reduceMotion ? false : { opacity: 0.6, y: 2 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduceMotion ? 0 : 0.18 }} className="mt-1 text-3xl font-bold tabular-nums text-palco">{number.format(selected?.count ?? located)}</motion.p>
            <p className="mt-1 text-xs text-neutral-500">{percent(selected?.count ?? located)} dos acessos do período</p>
          </div>
          {ranking.length > 0 ? <div>
            <p className="mb-1.5 text-xs font-semibold text-neutral-400">Maiores concentrações</p>
            <ul className="-mx-1.5 space-y-0.5">
              {ranking.slice(0, 3).map((state) => <li key={state.code}><button type="button" aria-pressed={selectedCode === state.code} onClick={() => select(selectedCode === state.code ? null : state.code)} className={cn("w-full rounded-lg p-1.5 text-left text-[13px] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-palco motion-reduce:transition-none", selectedCode === state.code ? "bg-palco/10" : "hover:bg-white/[0.04]")}><span className="flex items-center justify-between gap-2"><span className="truncate font-semibold text-neutral-100">{state.name}</span><span className="shrink-0 tabular-nums text-neutral-400">{percent(state.count)}</span></span><span className="mt-1.5 block h-1 rounded-full bg-[#1a1f1b]"><motion.span initial={false} className="block h-full rounded-full bg-palco" animate={{ width: `${Math.min(100, state.count / Math.max(1, geography.totalAccesses) * 100)}%` }} transition={{ duration: reduceMotion ? 0 : 0.3 }} /></span></button></li>)}
            </ul>
          </div> : <p className="text-xs leading-relaxed text-neutral-500">{geography.totalAccesses === 0 ? "Nenhum acesso registrado neste período." : "Ainda não há acessos com UF identificada. As localizações disponíveis serão exibidas aqui."}</p>}
        </div>
      </div>

      <footer className="mt-5 border-t border-[#1e241f] pt-3.5">
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-neutral-400 [&>span+span]:before:mr-1.5 [&>span+span]:before:content-['·']">
          <span>{number.format(geography.unlocated)} sem localização</span>
          {geography.outsideBrazil > 0 && <span>{number.format(geography.outsideBrazil)} fora do Brasil</span>}
          {geography.brazilUnresolved > 0 && <span>{number.format(geography.brazilUnresolved)} no Brasil sem UF</span>}
        </div>
        <div className="mt-1.5 flex flex-wrap items-center justify-between gap-1.5 text-[11px] text-neutral-500">
          <span>Base: {number.format(geography.totalAccesses)} acessos · última localização conhecida</span>
          <a href="https://servicodados.ibge.gov.br/api/docs/malhas?versao=3" target="_blank" rel="noreferrer" className="rounded-sm underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Mapa: IBGE · CC BY 4.0</a>
        </div>
      </footer>
    </section>
  );
}
