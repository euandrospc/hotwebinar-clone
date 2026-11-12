"use client";

import { useMemo, useState } from "react";
import { AdminSurface } from "@/components/admin/admin-page";
import { AreaChart } from "@/components/tremor/area-chart";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Info, Search } from "@/components/icons";
import { AB_METRIC_LABELS, type AbDiagnosticDimension, type AbReport, type AbSegmentMetrics } from "@/lib/ab-tests";
import { count, money, percent, percentagePoints } from "./ab-utils";
import { AbAudiencePanel } from "./ab-audience-panel";
import { AbConfigurationComparison } from "./ab-configuration-comparison";
import { AbJourneyDetails } from "./ab-journey-details";
import styles from "./ab-diagnostics-panel.module.css";

const positionLabel = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
type SegmentDimension = AbDiagnosticDimension | "hour" | "weekday";
const dimensionLabels: Record<SegmentDimension, string> = { source: "Origem", device: "Dispositivo", campaign: "Campanha", hour: "Hora de entrada", weekday: "Dia da semana" };
const deviceLabels: Record<string, string> = { desktop: "Desktop", mobile: "Celular", tablet: "Tablet", unknown: "Não informado" };
const weekdays = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
const segmentLabel = (value: string, dimension: SegmentDimension) => !value || value === "__unknown__" ? "Não informado" : dimension === "device" ? deviceLabels[value] ?? value : dimension === "hour" ? `${value.padStart(2, "0")}h · Brasília` : dimension === "weekday" ? weekdays[Number(value)] ?? value : value;
type SegmentMetric = "primary" | "purchase" | "revenue";

export function AbDiagnosticsPanel({ report }: { report: AbReport }) {
  const [showDailyTable, setShowDailyTable] = useState(false);
  const [showPositionTable, setShowPositionTable] = useState(false);
  const [dimension, setDimension] = useState<SegmentDimension>("source");
  const [metric, setMetric] = useState<SegmentMetric>("primary");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const position = report.diagnostics?.position;
  const metricLabel = metric === "revenue" ? "Receita / entrada" : metric === "purchase" ? "Compra" : AB_METRIC_LABELS[report.experiment.metric];
  const rows = useMemo(() => {
    const needle = normalize(query.trim());
    const source = dimension === "hour" ? report.diagnostics?.timing?.hours : dimension === "weekday" ? report.diagnostics?.timing?.weekdays : report.diagnostics?.segments.find(segment => segment.dimension === dimension)?.rows;
    return [...(source ?? [])]
      .filter(row => normalize(segmentLabel(row.value, dimension)).includes(needle))
      .sort((a, b) => (b.A.mature + b.B.mature) - (a.A.mature + a.B.mature) || a.value.localeCompare(b.value, "pt-BR"));
  }, [report.diagnostics, dimension, query]);
  const pageCount = Math.max(1, Math.ceil(rows.length / 6));
  const activePage = Math.min(page, pageCount);
  const visibleRows = rows.slice((activePage - 1) * 6, activePage * 6);
  const metricValue = (value: AbSegmentMetrics) => metric === "revenue" ? value.revenuePerEntryCents : metric === "purchase" ? value.purchaseRate : value.conversionRate;
  const formattedValue = (value: number | null) => value === null ? "—" : metric === "revenue" ? money(value) : percent(value);
  const deltaValue = (a: AbSegmentMetrics, b: AbSegmentMetrics) => {
    const valueA = metricValue(a), valueB = metricValue(b);
    if (valueA === null || valueB === null) return "—";
    const delta = valueB - valueA;
    return metric === "revenue" ? `${delta > 0 ? "+" : ""}${money(delta)}` : percentagePoints(delta);
  };

  return <AdminSurface className={styles.surface}>
    <Tabs defaultValue="daily" className={styles.tabs}>
      <div className={styles.header}><div><h3>Diagnóstico do comparativo</h3><p>Explore a evolução, o vídeo, a audiência e o que muda entre as versões.</p></div><TabsList className={styles.tabList} aria-label="Diagnósticos do teste"><TabsTrigger className={styles.tab} value="daily">Conversão diária</TabsTrigger><TabsTrigger className={styles.tab} value="position">Vídeo e jornada</TabsTrigger><TabsTrigger className={styles.tab} value="audience">Audiência</TabsTrigger><TabsTrigger className={styles.tab} value="segments">Segmentos</TabsTrigger><TabsTrigger className={styles.tab} value="configuration">Configuração A/B</TabsTrigger></TabsList></div>

      <TabsContent value="daily" className={styles.tabContent}>
        <div className={styles.panelHeading}><div><h4>Conversão por dia de entrada</h4><p>Resultado da métrica principal em cada coorte diária com janela completa. Dias sem base permanecem sem valor.</p></div><button type="button" className={styles.textButton} aria-expanded={showDailyTable} onClick={() => setShowDailyTable(value => !value)}>{showDailyTable ? "Ocultar dados" : "Ver dados do gráfico"}</button></div>
        {report.daily.some(day => day.A !== null || day.B !== null) ? <div className={styles.chart}><AreaChart data={report.daily.map(day => ({ day: `${day.date.slice(8, 10)}/${day.date.slice(5, 7)}`, A: day.A, B: day.B }))} index="day" categories={["A", "B"]} colors={["forest", "chartLime"]} valueFormatter={value => percent(value)} minValue={0} connectNulls={false} showLegend yAxisWidth={52} className="h-56" accessibilityLayer /></div> : <div className={styles.empty}>A evolução aparece quando houver entradas com a janela de conversão completa.</div>}
        {showDailyTable && <div className={styles.tableWrap}><table aria-label="Dados da conversão diária"><thead><tr><th>Entrada · Brasília</th><th>A · controle</th><th>B · variante</th></tr></thead><tbody>{report.daily.map(day => <tr key={day.date}><th scope="row">{day.date.split("-").reverse().join("/")}</th><td>{percent(day.A)}</td><td>{percent(day.B)}</td></tr>)}</tbody></table></div>}
      </TabsContent>

      <TabsContent value="position" className={styles.tabContent}>
        <div className={styles.panelHeading}><div><h4>Alcance por posição registrada</h4><p>Entradas cuja posição máxima observada alcançou cada ponto do vídeo, sobre a base com janela completa.</p></div><button type="button" className={styles.textButton} aria-expanded={showPositionTable} onClick={() => setShowPositionTable(value => !value)}>{showPositionTable ? "Ocultar dados" : "Ver dados do alcance"}</button></div>
        {position && <div className={styles.coverage}><span><b>A</b> {count(position.measured.A)} com posição registrada / {count(position.mature.A)} na base</span><span><b>B</b> {count(position.measured.B)} com posição registrada / {count(position.mature.B)} na base</span></div>}
        {position?.points.some(point => point.A.rate !== null || point.B.rate !== null) ? <div className={styles.chart}><AreaChart data={position.points.map(point => ({ position: positionLabel(point.seconds), A: point.A.rate, B: point.B.rate }))} index="position" categories={["A", "B"]} colors={["forest", "chartLime"]} valueFormatter={value => percent(value)} minValue={0} maxValue={1} connectNulls={false} showLegend yAxisWidth={52} xAxisLabel="Posição do vídeo · min:seg" className="h-56" accessibilityLayer /></div> : <div className={styles.empty}>Ainda não há posições de vídeo registradas na coorte com janela completa.</div>}
        <p className={styles.explainer}><Info aria-hidden="true" /><span>Posição máxima não representa tempo assistido contínuo nem retenção contínua. Entradas tardias e avanços no vídeo podem alcançar uma posição sem assistir aos trechos anteriores. Um braço sem medições fica sem valor.</span></p>
        {showPositionTable && <div className={styles.tableWrap}><table aria-label="Dados do alcance por posição"><thead><tr><th>Posição · min:seg</th><th>Entradas A</th><th>Alcance A</th><th>Entradas B</th><th>Alcance B</th></tr></thead><tbody>{position?.points.map(point => <tr key={point.seconds}><th scope="row">{positionLabel(point.seconds)}</th><td>{point.A.rate === null ? "—" : count(point.A.count)}</td><td>{percent(point.A.rate)}</td><td>{point.B.rate === null ? "—" : count(point.B.count)}</td><td>{percent(point.B.rate)}</td></tr>)}</tbody></table></div>}
        <AbJourneyDetails report={report} />
      </TabsContent>

      <TabsContent value="audience" className={styles.tabContent}><AbAudiencePanel report={report} /></TabsContent>

      <TabsContent value="segments" className={styles.tabContent}>
        <div className={styles.panelHeading}><div><h4>Resultado por segmento</h4><p>Comparação exploratória dentro do recorte atual. As bases de A e B ficam explícitas; nenhum segmento declara vencedor.</p></div></div>
        <div className={styles.segmentToolbar}>
          <label className={styles.selectField}><span>Agrupar por</span><select aria-label="Agrupar segmentos por" value={dimension} onChange={event => { setDimension(event.target.value as SegmentDimension); setPage(1); setQuery(""); }}>{Object.entries(dimensionLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className={styles.selectField}><span>Indicador</span><select aria-label="Indicador dos segmentos" value={metric} onChange={event => setMetric(event.target.value as SegmentMetric)}><option value="primary">{AB_METRIC_LABELS[report.experiment.metric]} · principal</option>{report.experiment.metric !== "PURCHASE" && <option value="purchase">Compra</option>}<option value="revenue">Receita por entrada</option></select></label>
          <label className={styles.search}><Search aria-hidden="true" /><input aria-label="Buscar segmento" placeholder={`Buscar ${dimensionLabels[dimension].toLocaleLowerCase("pt-BR")}…`} value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} /></label>
        </div>
        {visibleRows.length ? <div className={styles.tableWrap}><table aria-label="Comparação exploratória por segmento"><thead><tr><th>{dimensionLabels[dimension]}</th><th>Base A</th><th>Base B</th><th>{metricLabel} A</th><th>{metricLabel} B</th><th>Diferença B − A</th></tr></thead><tbody>{visibleRows.map(row => <tr key={row.value}><th scope="row" title={segmentLabel(row.value, dimension)}>{segmentLabel(row.value, dimension)}</th><td>{count(row.A.mature)}</td><td>{count(row.B.mature)}</td><td>{formattedValue(metricValue(row.A))}</td><td>{formattedValue(metricValue(row.B))}</td><td>{deltaValue(row.A, row.B)}</td></tr>)}</tbody></table></div> : <div className={styles.segmentEmpty}>{query ? "Nenhum segmento encontrado com essa busca." : "Os segmentos aparecem quando houver entradas com janela completa."}</div>}
        <div className={styles.segmentFooter}><p>{count(rows.length)} {rows.length === 1 ? "segmento" : "segmentos"} · base com janela completa</p>{pageCount > 1 && <nav aria-label="Páginas de segmentos"><button type="button" disabled={activePage === 1} onClick={() => setPage(activePage - 1)}>Anterior</button><span>{activePage} / {pageCount}</span><button type="button" disabled={activePage === pageCount} onClick={() => setPage(activePage + 1)}>Próxima</button></nav>}</div>
        <p className={styles.explainer}><Info aria-hidden="true" /><span>Diferenças com bases pequenas podem variar muito. Este detalhamento gera hipóteses; não substitui a análise principal. Receita por entrada é descritiva, em BRL, sem dedução de custos ou estornos.</span></p>
        {(dimension === "hour" || dimension === "weekday") && <p className={styles.explainer}><Info aria-hidden="true" /><span>Hora e dia refletem a entrada observada em Brasília, não o horário programado do webinar. Comparar esses grupos não demonstra o efeito causal de alterar o horário.</span></p>}
      </TabsContent>
      <TabsContent value="configuration" className={styles.tabContent}><AbConfigurationComparison experiment={report.experiment} /></TabsContent>
    </Tabs>
  </AdminSurface>;
}
