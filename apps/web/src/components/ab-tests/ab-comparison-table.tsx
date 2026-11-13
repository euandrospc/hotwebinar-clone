import type { AbReport, AbVariantReport } from "@/lib/ab-tests";
import { AB_METRIC_LABELS, abMetricBase } from "@/lib/ab-tests";
import { count, money, percent, percentagePoints } from "./ab-utils";
import styles from "./ab-comparison-table.module.css";

const signed = (value: number) => `${value > 0 ? "+" : ""}${count(value)}`;
const moneyDelta = (value: number | null) => value === null ? "—" : `${value > 0 ? "+" : ""}${money(value)}`;
const rate = (count: number, total: number) => total ? count / total : null;
const subtract = (a: number | null, b: number | null) => a === null || b === null ? null : b - a;

export function AbComparisonTable({ report }: { report: AbReport }) {
  const [a, b] = report.variants;
  const observed = report.readout === "OBSERVED";
  const recurring = report.experiment.observationUnit === "DAILY_SESSION";
  const baseA = abMetricBase(a), baseB = abMetricBase(b);
  type Row = { label: string; note?: string; A: string; B: string; delta: string; detailA?: string; detailB?: string; detailDelta?: string };
  const rows: Row[] = [
    { label: report.experiment.mode === "RANDOMIZED" ? "Visitantes distribuídos" : recurring ? "Participações por dia" : "Acessos identificados", note: recurring ? "Uma participação por pessoa, webinar e dia de atividade." : undefined, A: count(a.assigned), B: count(b.assigned), delta: signed(b.assigned - a.assigned) },
    ...(recurring ? [{ label: "Pessoas identificadas únicas", note: "Deduplicadas no recorte; o total não soma pessoas dos dias.", A: a.uniquePeople === undefined ? "—" : count(a.uniquePeople), B: b.uniquePeople === undefined ? "—" : count(b.uniquePeople), delta: a.uniquePeople === undefined || b.uniquePeople === undefined ? "—" : signed(b.uniquePeople - a.uniquePeople) }] : []),
    { label: "Janela completa", note: observed ? "Entradas que já tiveram o prazo inteiro para converter." : "Base das etapas e das taxas abaixo.", A: count(a.mature), B: count(b.mature), delta: signed(b.mature - a.mature), detailA: `${percent(rate(a.mature, a.assigned))} das entradas`, detailB: `${percent(rate(b.mature, b.assigned))} das entradas` },
    { label: "Aguardando janela", A: count(a.pending), B: count(b.pending), delta: signed(b.pending - a.pending) }
  ];
  const stageRows: { label: string; key: "identified" | "viewers" | "pitch" | "clicks" | "buyers" }[] = [
    { label: "Com identificação", key: "identified" }, { label: "Com registro de reprodução", key: "viewers" },
    { label: "Chegaram ao pitch", key: "pitch" }, { label: "Clicaram na oferta", key: "clicks" }, { label: recurring ? "Participações com compra" : "Compradores", key: "buyers" }
  ];
  for (const stage of stageRows) rows.push({ label: stage.label, A: count(a[stage.key]), B: count(b[stage.key]), delta: percentagePoints(subtract(rate(a[stage.key], baseA), rate(b[stage.key], baseB))), detailA: `${percent(rate(a[stage.key], baseA))} de ${count(baseA)}`, detailB: `${percent(rate(b[stage.key], baseB))} de ${count(baseB)}`, detailDelta: `${signed(b[stage.key] - a[stage.key])} entradas` });
  rows.push(
    { label: `Taxa principal · ${AB_METRIC_LABELS[report.experiment.metric]}`, A: percent(a.rate), B: percent(b.rate), delta: percentagePoints(report.inference.delta) },
    ...(report.experiment.mode === "RANDOMIZED" ? [{ label: "Intervalo da taxa principal · 95%", A: a.interval ? `${percent(a.interval[0])} a ${percent(a.interval[1])}` : "—", B: b.interval ? `${percent(b.interval[0])} a ${percent(b.interval[1])}` : "—", delta: report.inference.interval ? `${percentagePoints(report.inference.interval[0])} a ${percentagePoints(report.inference.interval[1])}` : "—" }] : []),
    { label: "Pedidos em BRL", note: "Uma pessoa pode realizar vários pedidos.", A: count(a.sales), B: count(b.sales), delta: signed(b.sales - a.sales) },
    { label: "Receita atribuída · BRL", A: money(a.revenueCents), B: money(b.revenueCents), delta: moneyDelta(b.revenueCents - a.revenueCents) }
  );
  for (const item of [{ label: observed ? "Receita por entrada observada" : "Receita por entrada com janela completa", divisor: "base" as const }, { label: "Ticket médio por pedido em BRL", divisor: "sales" as const }]) {
    const value = (v: AbVariantReport) => { const divisor = item.divisor === "base" ? abMetricBase(v) : v.sales; return divisor ? v.revenueCents / divisor : null; };
    const av = value(a), bv = value(b);
    rows.push({ label: item.label, A: av === null ? "—" : money(av), B: bv === null ? "—" : money(bv), delta: moneyDelta(subtract(av, bv)) });
  }
  return <div className={styles.wrapper}><table aria-label="Comparativo de resultados A e B"><thead><tr><th>Indicador</th><th><b className={styles.variantA}>A</b><span>{a.label}</span></th><th><b className={styles.variantB}>B</b><span>{b.label}</span></th><th>Diferença B − A</th></tr></thead><tbody>{rows.map(row => <tr key={row.label}><th scope="row">{row.label}{row.note && <small>{row.note}</small>}</th><td>{row.A}{row.detailA && <small>{row.detailA}</small>}</td><td>{row.B}{row.detailB && <small>{row.detailB}</small>}</td><td>{row.delta}{row.detailDelta && <small>{row.detailDelta}</small>}</td></tr>)}</tbody></table></div>;
}
