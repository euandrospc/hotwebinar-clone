"use client";

import { Info } from "@/components/icons";
import type { AbReport } from "@/lib/ab-tests";
import { count } from "./ab-utils";
import styles from "./ab-diagnostics-panel.module.css";

const valueLabel = (value: number | null) => value === null ? "—" : value.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
const timeLabel = (value: string | null) => value ? new Date(value).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—";
const difference = (a: number | null, b: number | null) => a === null || b === null ? "—" : `${b - a > 0 ? "+" : ""}${valueLabel(b - a)}`;

export function AbAudiencePanel({ report }: { report: AbReport }) {
  const audience = report.diagnostics?.audience;
  if (!audience) return <div className={styles.empty}>O histórico de audiência simultânea não está disponível neste relatório.</div>;
  const { A, B } = audience;
  const rows = [
    { label: "Média das leituras de audiência", a: A.average, b: B.average },
    { label: "Pico de pessoas simultâneas", a: A.peak, b: B.peak },
    { label: "Leituras observadas", a: A.sampleCount, b: B.sampleCount },
    { label: "Média simultânea no momento do pitch", a: A.pitch.average, b: B.pitch.average },
    { label: "Pico simultâneo no momento do pitch", a: A.pitch.peak, b: B.pitch.peak },
    { label: "Ocorrências programadas do pitch", a: A.pitch.occurrenceCount, b: B.pitch.occurrenceCount },
    { label: "Ocorrências do pitch com leitura", a: A.pitch.sampleCount, b: B.pitch.sampleCount }
  ];
  return <div>
    <div className={styles.panelHeading}><div><h4>Audiência simultânea do webinar</h4><p>Contexto de toda a transmissão {audience.window === "OBSERVED_COHORT_WINDOWS" ? "nos intervalos já observados até agora" : "nas janelas da coorte com maturação completa"}, incluindo quem acessou o webinar diretamente.</p></div></div>
    <p className={styles.explainer}><Info aria-hidden="true" /><span>Não é a audiência exclusiva dos visitantes sorteados. Média e pico usam somente leituras existentes; intervalos sem leitura não são preenchidos com zero. Filtros de aquisição ou dispositivo não recortam este histórico.</span></p>
    <div className={`${styles.tableWrap} ${styles.audienceTable}`}><table aria-label="Comparativo de audiência simultânea"><thead><tr><th>Indicador contextual</th><th>A</th><th>B</th><th>Diferença B − A</th></tr></thead><tbody>{rows.map(row => <tr key={row.label}><th scope="row">{row.label}</th><td>{valueLabel(row.a)}</td><td>{valueLabel(row.b)}</td><td>{difference(row.a, row.b)}</td></tr>)}<tr><th scope="row">Horário do pico · Brasília</th><td>{timeLabel(A.peakAt)}</td><td>{timeLabel(B.peakAt)}</td><td>—</td></tr></tbody></table></div>
    <div className={styles.audienceNotes}>{(["A", "B"] as const).map(key => <div key={key}><strong>{key} · intervalo consultado</strong><p>{audience[key].from && audience[key].to ? `${timeLabel(audience[key].from)} a ${timeLabel(audience[key].to)}` : "Sem intervalo de consulta elegível."}</p>{audience[key].reason && <p>{audience[key].reason}</p>}{audience[key].pitch.reason && <p><b>Pitch:</b> {audience[key].pitch.reason}</p>}</div>)}</div>
    <p className={styles.explainer}><Info aria-hidden="true" /><span>“No momento do pitch” exige transmissão sincronizada e leitura real próxima do horário programado, com tolerância de {audience.cadenceSeconds}s. É diferente da quantidade de pessoas únicas que chegaram ao pitch. Webinars individuais/JIT não têm um único instante de pitch compartilhado.</span></p>
    {(A.pitch.points.length > 0 || B.pitch.points.length > 0) && <details className={styles.readings}><summary>Ver leituras nos momentos de pitch ({count(A.pitch.points.length + B.pitch.points.length)})</summary><div className={styles.tableWrap}><table aria-label="Leituras da audiência nos momentos de pitch"><thead><tr><th>Variante</th><th>Pitch programado · Brasília</th><th>Leitura observada · Brasília</th><th>Pessoas simultâneas</th></tr></thead><tbody>{(["A", "B"] as const).flatMap(key => audience[key].pitch.points.map((point, index) => <tr key={`${key}-${point.scheduledAt}-${index}`}><th scope="row">{key}</th><td>{timeLabel(point.scheduledAt)}</td><td>{timeLabel(point.observedAt)}</td><td>{count(point.online)}</td></tr>))}</tbody></table></div></details>}
  </div>;
}
