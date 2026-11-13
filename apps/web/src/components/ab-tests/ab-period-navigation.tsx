"use client";

import { useEffect, useState } from "react";
import { AdminSurface } from "@/components/admin/admin-page";
import { abMetricBase, type AbPeriodReport, type AbReport } from "@/lib/ab-tests";
import { cn } from "@/lib/utils";
import { count, dateLabel, money, percent } from "./ab-utils";
import styles from "./ab-tests.module.css";

type PeriodView = "daily" | "weekly" | "total";
const stateLabels: Record<AbPeriodReport["state"], string> = {
  UPCOMING: "Ainda não ocorreu", EMPTY: "Sem registros", PARTIAL: "Parcial", COMPLETE: "Janelas concluídas"
};

/** Periods always span the plan, so selecting a day never hides other days. */
export function AbPeriodNavigation({ report, from, to, loading, onSelect }: {
  report: AbReport; from?: string; to?: string; loading: boolean;
  onSelect: (period: AbPeriodReport | null) => void;
}) {
  const [view, setView] = useState<PeriodView>("total");
  useEffect(() => { if (!from && !to) setView("total"); }, [from, to]);
  const periods = report.periods;
  if (!periods) return null;
  const rows = view === "total" ? [periods.total] : periods[view];
  const selected = !from && !to ? periods.total : [...periods.daily, ...periods.weekly, periods.total].find(period => period.from === from && period.to === to);
  const selectedInView = rows.find(period => period.key === selected?.key);

  function changeView(next: PeriodView) {
    setView(next);
    if (next === "total") { onSelect(null); return; }
    const candidates = periods![next];
    const anchor = from ?? [...candidates].reverse().find(period => period.variants.some(variant => variant.assigned > 0))?.from ?? report.generatedAt;
    const target = candidates.find(period => period.from <= anchor && period.to >= anchor)
      ?? [...candidates].reverse().find(period => period.state !== "UPCOMING") ?? candidates[0];
    if (target) onSelect(target);
  }

  return <AdminSurface className={styles.periodSurface}>
    <div className={styles.periodToolbar}>
      <div className={styles.periodTabs} role="group" aria-label="Agrupar acompanhamento">
        {([["daily", "Diário"], ["weekly", "Semanal"], ["total", "Total · " + report.experiment.durationDays + " dias"]] as const).map(([key, label]) => <button type="button" key={key} aria-pressed={view === key} className={cn(styles.periodTab, view === key && styles.periodTabActive)} onClick={() => changeView(key)}>{label}</button>)}
      </div>
      {view !== "total" ? <label className={styles.periodSelect}><span className="sr-only">{view === "daily" ? "Dia do acompanhamento" : "Semana do acompanhamento"}</span><select aria-label={view === "daily" ? "Dia do acompanhamento" : "Semana do acompanhamento"} value={selectedInView?.key ?? ""} onChange={event => { const period = rows.find(item => item.key === event.target.value); if (period) onSelect(period); }}>
        {!selectedInView && <option value="" disabled>Período personalizado</option>}
        {rows.map(period => <option key={period.key} value={period.key}>{period.label} · {stateLabels[period.state]}</option>)}
      </select></label> : <span className={styles.periodRange}>{selected?.key === periods.total.key ? dateLabel(periods.total.from) + " — " + dateLabel(periods.total.to) : "Recorte personalizado nos filtros"}</span>}
      {selected && <span className={styles.badge} role="status">{loading ? "Atualizando…" : stateLabels[selected.state]}</span>}
    </div>
    <p className={styles.periodNote}>{selected?.state === "UPCOMING" ? "Este período ainda não começou. A ausência de dados não representa audiência ou conversão zero." : "Participações por dia de atividade em Brasília. Compras em atualização por " + report.experiment.conversionWindowHours + "h após cada entrada; cada pedido conta uma vez."}</p>
    {view !== "total" && <details className={styles.periodOverview}><summary>{view === "daily" ? "Comparar todos os dias" : "Comparar todas as semanas"}</summary><div className={cn(styles.tableWrap, styles.periodTable)}><table aria-label={view === "daily" ? "Comparativo diário" : "Comparativo semanal"}>
      <thead><tr><th>Período / variante</th><th>Participações</th><th>Pessoas únicas</th><th>Reprodução</th><th>Pitch</th><th>Cliques</th><th>Participações com compra</th><th>Pedidos</th><th>Conversão de compra</th><th>Receita</th><th>Pico simultâneo</th></tr></thead>
      <tbody>{rows.flatMap(period => period.variants.map((variant, index) => {
        const unavailable = period.state === "UPCOMING" || period.state === "EMPTY";
        const value = (number: number) => unavailable ? "—" : count(number);
        const peak = period.audience?.[variant.key].peak;
        return <tr key={period.key + "-" + variant.key} data-selected={period.key === selectedInView?.key}><th scope="row"><button type="button" onClick={() => onSelect(period)}><b className={variant.key === "A" ? styles.variantA : styles.variantB}>{variant.key}</b>{period.label}</button>{index === 0 && <small>{stateLabels[period.state]}</small>}</th><td>{value(variant.assigned)}</td><td>{variant.uniquePeople === undefined ? "—" : value(variant.uniquePeople)}</td><td>{value(variant.viewers)}</td><td>{value(variant.pitch)}</td><td>{value(variant.clicks)}</td><td>{value(variant.buyers)}</td><td>{value(variant.sales)}</td><td>{unavailable ? "—" : percent(abMetricBase(variant) ? variant.buyers / abMetricBase(variant) : null)}</td><td>{unavailable ? "—" : money(variant.revenueCents)}</td><td>{peak == null ? "—" : count(peak)}</td></tr>;
      }))}</tbody>
    </table></div></details>}
  </AdminSurface>;
}
