"use client";

import { useState } from "react";
import type { AbReport, AbTimingMetrics } from "@/lib/ab-tests";
import { count } from "./ab-utils";
import styles from "./ab-diagnostics-panel.module.css";

const elapsedLabel = (value: number | null): string => {
  if (value === null) return "—";
  const seconds = Math.round(value), minutes = Math.floor(seconds / 60), hours = Math.floor(seconds / 3600);
  if (hours >= 24) return `${Math.floor(hours / 24)}d ${hours % 24}h ${minutes % 60}min`;
  if (hours) return `${hours}h ${minutes % 60}min`;
  return minutes ? `${minutes}min ${seconds % 60}s` : `${seconds}s`;
};
const stages: { key: "firstPlayback" | "firstPitch" | "firstClick" | "firstPurchase"; label: string }[] = [
  { key: "firstPlayback", label: "Primeiro registro de reprodução" }, { key: "firstPitch", label: "Primeira chegada ao pitch" },
  { key: "firstClick", label: "Primeiro clique na oferta" }, { key: "firstPurchase", label: "Primeira compra registrada" }
];

export function AbJourneyDetails({ report }: { report: AbReport }) {
  const [statistic, setStatistic] = useState<"medianSeconds" | "averageSeconds">("medianSeconds");
  const timing = report.diagnostics?.timing;
  if (!timing) return null;
  const cell = (arm: AbTimingMetrics, key: typeof stages[number]["key"]) => <>{elapsedLabel(arm[key][statistic])}<small>{count(arm[key].samples)} {arm[key].samples === 1 ? "amostra" : "amostras"}</small></>;
  return <div className={styles.journey}>
    <div className={styles.panelHeading}><div><h4>Tempo decorrido até cada marco</h4><p>Após a entrada na coorte, entre quem teve o evento observado dentro da janela. Inclui espera; não é tempo de vídeo assistido.</p></div><label className={styles.selectField}><span className="sr-only">Medida dos tempos da jornada</span><select aria-label="Medida dos tempos da jornada" value={statistic} onChange={event => setStatistic(event.target.value as typeof statistic)}><option value="medianSeconds">Mediana</option><option value="averageSeconds">Média</option></select></label></div>
    <div className={styles.tableWrap}><table aria-label="Tempos até os marcos do webinar"><thead><tr><th>Marco observado</th><th>A</th><th>B</th><th>Diferença B − A</th></tr></thead><tbody>{stages.map(stage => { const a = timing.A[stage.key][statistic], b = timing.B[stage.key][statistic]; return <tr key={stage.key}><th scope="row">{stage.label}</th><td>{cell(timing.A, stage.key)}</td><td>{cell(timing.B, stage.key)}</td><td>{a === null || b === null ? "—" : `${b - a > 0 ? "+" : b - a < 0 ? "−" : ""}${elapsedLabel(Math.abs(b - a))}`}</td></tr>; })}</tbody></table></div>
    <p className={styles.positionSummary}>Posição máxima registrada — A: média {elapsedLabel(timing.A.meanMaxVideoSec)}, mediana {elapsedLabel(timing.A.medianMaxVideoSec)} ({count(timing.A.positionSamples)} amostras). B: média {elapsedLabel(timing.B.meanMaxVideoSec)}, mediana {elapsedLabel(timing.B.medianMaxVideoSec)} ({count(timing.B.positionSamples)} amostras).</p>
  </div>;
}
