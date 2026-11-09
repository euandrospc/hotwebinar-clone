"use client";

import { useId, useMemo, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, ChevronDown, Info, Search, TvMinimalPlay } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface DashboardWebinarPerformance {
  id: string;
  title: string;
  status: string;
  mode: string;
  registrations: number;
  viewers: number;
  sales: number;
  revenueCents: number;
  convertedLeads: number;
  /** Percentage from 0 to 100; null when there are no registrations. */
  conversionRate: number | null;
}

type SortBy = "revenue" | "registrations" | "conversion";
type PerformanceRange = { from: string; to: string };
const PAGE_SIZE = 6;
const number = new Intl.NumberFormat("pt-BR");
const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const percentage = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const conversionExplanation = "Assistiram: leads com reprodução registrada no período, incluindo inscrições anteriores. Conversão = leads que se cadastraram e compraram no período ÷ total de leads cadastrados no período. Cada lead convertido conta uma vez. Vendas e faturamento incluem todas as compras recebidas no período.";

function metricsHref(id: string, range?: PerformanceRange) {
  const pathname = `/dashboard/webinars/${id}/metrics`;
  return range ? `${pathname}?${new URLSearchParams(range).toString()}` : pathname;
}

function searchable(value: string) {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("pt-BR");
}

function conversionLabel(rate: number | null) {
  return rate === null ? "—" : `${percentage.format(rate)}%`;
}

function WebinarIdentity({ row, range }: { row: DashboardWebinarPerformance; range?: PerformanceRange }) {
  const status = row.status.toUpperCase();
  const label = status === "ACTIVE" ? "Publicado" : status === "DRAFT" ? "Rascunho" : status === "ARCHIVED" ? "Arquivado" : "Status não informado";
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#F3F7EF] text-[#527660] dark:bg-[#17382D] dark:text-[#A6DE6B]" aria-hidden="true"><TvMinimalPlay className="h-[18px] w-[18px]" /></span>
      <div className="min-w-0">
        <Link href={metricsHref(row.id, range)} className="block truncate rounded-sm text-[13px] font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#80B94C]" title={row.title} aria-label={`Ver resultados de ${row.title}`}>{row.title}</Link>
        <span className={cn("mt-1 inline-flex items-center gap-1.5 text-[11px] font-normal", status === "ACTIVE" ? "text-[#46704F] dark:text-[#A6DE6B]" : "text-muted-foreground")}>
          <span className={cn("h-1.5 w-1.5 rounded-full", status === "ACTIVE" ? "bg-[#91C86A]" : "bg-muted-foreground/40")} aria-hidden="true" />
          {label}
        </span>
      </div>
    </div>
  );
}

export function DashboardWebinarPerformanceTable({ rows, range }: { rows: DashboardWebinarPerformance[]; range?: PerformanceRange }) {
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("revenue");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const reducedMotion = useReducedMotion();
  const resultsId = useId();
  const descriptionId = useId();
  const filteredRows = useMemo(() => {
    const normalizedQuery = searchable(query.trim());
    return rows.filter((row) => searchable(row.title).includes(normalizedQuery)).sort((a, b) => {
      const value = (row: DashboardWebinarPerformance) => sortBy === "registrations" ? row.registrations : sortBy === "conversion" ? (row.conversionRate ?? -1) : row.revenueCents;
      return value(b) - value(a) || b.revenueCents - a.revenueCents || a.title.localeCompare(b.title, "pt-BR");
    });
  }, [rows, query, sortBy]);
  const visibleRows = filteredRows.slice(0, visibleCount);
  const allVisible = visibleCount >= filteredRows.length;

  return (
    <TooltipProvider delayDuration={150}>
      <section aria-labelledby={`${resultsId}-heading`} className="min-w-0 rounded-2xl border border-border/70 bg-card">
        <header className="flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
          <div>
            <h2 id={`${resultsId}-heading`} className="text-base font-semibold tracking-tight">Desempenho por webinar</h2>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <p>Compare os resultados do período selecionado.</p>
              <Tooltip><TooltipTrigger asChild><button type="button" className="rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#80B94C]" aria-label="Como as métricas são calculadas"><Info className="h-3.5 w-3.5" /></button></TooltipTrigger><TooltipContent className="max-w-80 leading-relaxed">{conversionExplanation}</TooltipContent></Tooltip>
            </div>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <div className="relative min-w-40 flex-1 sm:w-52 sm:flex-none">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input type="search" aria-label="Buscar webinar pelo título" placeholder="Buscar webinar" value={query} onChange={(event) => { setQuery(event.target.value); setVisibleCount(PAGE_SIZE); }} className="h-9 rounded-lg bg-background pl-9 text-xs" />
            </div>
            <Select value={sortBy} onValueChange={(value) => { setSortBy(value as SortBy); setVisibleCount(PAGE_SIZE); }}>
              <SelectTrigger aria-label="Ordenar webinars" className="h-9 w-[164px] rounded-lg text-xs"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="revenue">Maior faturamento</SelectItem><SelectItem value="registrations">Mais leads</SelectItem><SelectItem value="conversion">Maior conversão</SelectItem></SelectContent>
            </Select>
          </div>
        </header>

        <p id={descriptionId} className="sr-only">{conversionExplanation}</p>
        <div id={resultsId} className="[container-type:inline-size]">
          {visibleRows.length > 0 ? (
            <>
              <div className="hidden [@container(min-width:880px)]:block">
                <table className="w-full table-fixed text-[13px]" aria-describedby={descriptionId}>
                  <caption className="sr-only">Resultados por webinar, ordenados por {sortBy === "revenue" ? "faturamento" : sortBy === "registrations" ? "leads" : "conversão"}, do maior para o menor.</caption>
                  <colgroup><col className="w-[34%]" /><col className="w-[9%]" /><col className="w-[10%]" /><col className="w-[8%]" /><col className="w-[12%]" /><col className="w-[19%]" /><col className="w-[8%]" /></colgroup>
                  <thead className="border-y border-border/60 bg-muted/20 text-[11px] font-normal text-muted-foreground">
                    <tr>
                      <th scope="col" className="py-3 pl-6 text-left font-normal">Webinar</th>
                      <th scope="col" className="px-2 py-3 text-right font-normal" aria-sort={sortBy === "registrations" ? "descending" : undefined}>Leads</th>
                      <th scope="col" className="px-2 py-3 text-right font-normal">Assistiram</th>
                      <th scope="col" className="px-2 py-3 text-right font-normal">Vendas</th>
                      <th scope="col" className="px-2 py-3 text-right font-normal" aria-sort={sortBy === "conversion" ? "descending" : undefined}>Conversão</th>
                      <th scope="col" className="px-2 py-3 text-right font-normal" aria-sort={sortBy === "revenue" ? "descending" : undefined}>Faturamento</th>
                      <th scope="col"><span className="sr-only">Resultados</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.map((row) => (
                      <motion.tr key={row.id} layout={reducedMotion ? false : "position"} initial={false} transition={{ duration: 0.18 }} className="border-b border-border/50 transition-colors last:border-0 hover:bg-muted/20 motion-reduce:transition-none">
                        <th scope="row" className="py-4 pl-6 pr-4 text-left font-normal"><WebinarIdentity row={row} range={range} /></th>
                        <td className="px-2 py-4 text-right tabular-nums">{number.format(row.registrations)}</td>
                        <td className="px-2 py-4 text-right tabular-nums">{number.format(row.viewers)}</td>
                        <td className="px-2 py-4 text-right tabular-nums">{number.format(row.sales)}</td>
                        <td className="px-2 py-4 text-right tabular-nums" title={row.registrations ? `${number.format(row.convertedLeads)} de ${number.format(row.registrations)} leads cadastrados no período geraram compra` : "Sem leads cadastrados no período"}>{conversionLabel(row.conversionRate)}</td>
                        <td className="whitespace-nowrap px-2 py-4 text-right font-medium tabular-nums text-[#064B3C] dark:text-[#A6DE6B]">{currency.format(row.revenueCents / 100)}</td>
                        <td className="py-4 pr-5 text-right"><Link href={metricsHref(row.id, range)} aria-label={`Abrir métricas de ${row.title}`} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-[#F0F7E9] hover:text-[#064B3C] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#80B94C] dark:hover:bg-[#17382D] dark:hover:text-[#A6DE6B]"><ArrowUpRight className="h-4 w-4" /></Link></td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <ul aria-label="Resultados dos webinars" aria-describedby={descriptionId} className="divide-y divide-border/60 border-t border-border/60 [@container(min-width:880px)]:hidden">
                {visibleRows.map((row) => (
                  <motion.li key={row.id} layout={reducedMotion ? false : "position"} initial={false} transition={{ duration: 0.18 }} className="p-5 sm:px-6">
                    <div className="flex items-center justify-between gap-3">
                      <WebinarIdentity row={row} range={range} />
                      <Link href={metricsHref(row.id, range)} aria-label={`Abrir métricas de ${row.title}`} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#80B94C]"><ArrowUpRight className="h-4 w-4" /></Link>
                    </div>
                    <dl className="mt-4 grid grid-cols-3 gap-x-4 gap-y-3 text-xs sm:grid-cols-5">
                      {[["Leads", number.format(row.registrations)], ["Assistiram", number.format(row.viewers)], ["Vendas", number.format(row.sales)], ["Conversão", conversionLabel(row.conversionRate)]].map(([label, value]) => <div key={label}><dt className="text-[11px] text-muted-foreground">{label}</dt><dd className="mt-1 font-medium tabular-nums">{value}</dd></div>)}
                      <div className="col-span-2 sm:col-span-1"><dt className="text-[11px] text-muted-foreground">Faturamento</dt><dd className="mt-1 whitespace-nowrap font-semibold tabular-nums text-[#064B3C] dark:text-[#A6DE6B]">{currency.format(row.revenueCents / 100)}</dd></div>
                    </dl>
                  </motion.li>
                ))}
              </ul>
            </>
          ) : (
            <div className="flex min-h-56 flex-col items-center justify-center gap-2 border-t border-border/60 px-6 py-10 text-center">
              <TvMinimalPlay className="mb-2 h-7 w-7 text-muted-foreground/60" />
              <p className="text-sm font-medium">{query.trim() ? "Nenhum webinar encontrado" : "Nenhum webinar para exibir"}</p>
              <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">{query.trim() ? "Tente outro título para encontrar o webinar." : "Seus webinars e resultados aparecerão aqui depois que você criar o primeiro."}</p>
              {query.trim() && <Button variant="ghost" size="sm" className="mt-1 text-xs" onClick={() => { setQuery(""); setVisibleCount(PAGE_SIZE); }}>Limpar busca</Button>}
            </div>
          )}
        </div>
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 px-5 py-4 sm:px-6">
          <p aria-live="polite" className="text-[11px] text-muted-foreground">{filteredRows.length > 0 ? `${visibleRows.length} de ${filteredRows.length} webinars` : "0 webinars"}</p>
          <div className="flex flex-wrap items-center gap-4">
            {filteredRows.length > PAGE_SIZE && <Button variant="ghost" size="sm" aria-controls={resultsId} className="h-8 gap-1.5 rounded-lg text-xs" onClick={() => setVisibleCount(allVisible ? PAGE_SIZE : visibleCount + PAGE_SIZE)}>{allVisible ? "Mostrar menos" : "Ver mais"}<ChevronDown className={cn("h-3.5 w-3.5", allVisible && "rotate-180")} /></Button>}
            <Link href="/dashboard/webinars" className="inline-flex items-center gap-1 rounded-sm text-xs font-medium text-[#064B3C] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#80B94C] dark:text-[#A6DE6B]">Todos os webinars <ArrowUpRight className="h-3.5 w-3.5" /></Link>
          </div>
        </footer>
      </section>
    </TooltipProvider>
  );
}
