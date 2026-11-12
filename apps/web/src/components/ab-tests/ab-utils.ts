import { AB_METRIC_LABELS, AB_TEST_VARIABLE_LABELS, abMetricBase, type AbReport, type AbReportFilters } from "@/lib/ab-tests";

export const count = (value: number) => value.toLocaleString("pt-BR");
export const percent = (value: number | null, digits = 1) => value === null ? "—" : `${(value * 100).toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`;
export const percentagePoints = (value: number | null) => value === null ? "—" : `${value > 0 ? "+" : ""}${(value * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} p.p.`;
export const money = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const dayInBrasilia = (value: string | Date = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
export const dateLabel = (value: string | null) => value ? new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "short", year: "numeric" }).format(new Date(value)) : "A definir";

/** Both ends are inclusive; all calendar controls use Brasília, never browser timezone. */
export function calendarFilters(from: string, to: string): Pick<AbReportFilters, "from" | "to"> {
  return {
    ...(from ? { from: new Date(`${from}T00:00:00.000-03:00`).toISOString() } : {}),
    ...(to ? { to: new Date(`${to}T23:59:59.999-03:00`).toISOString() } : {})
  };
}

function csvCell(value: string | number | null): string {
  const raw = value === null ? "" : String(value);
  // Quoting alone does not prevent spreadsheet formula execution.
  const safe = typeof value === "string" && /^[\s\u0000-\u001f]*[=+@-]/u.test(raw) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
}

/** Aggregate report only: no attendee identities or raw chat data. */
export function buildAbCsv(report: AbReport): string {
  const rows: (string | number | null)[][] = [
    ["Relatório agregado de teste A/B", report.experiment.name],
    ["Gerado em (UTC)", report.generatedAt],
    ["Modalidade", report.experiment.mode === "RANDOMIZED" ? "Experimento randomizado" : "Comparação observacional"],
    ["Métrica principal", AB_METRIC_LABELS[report.experiment.metric]],
    ["Variável testada", AB_TEST_VARIABLE_LABELS[report.experiment.testVariable ?? "FULL_WEBINAR"]],
    ["Condição A", report.experiment.variantADescription ?? ""], ["Condição B", report.experiment.variantBDescription ?? ""],
    ["Janela de conversão (horas)", report.experiment.conversionWindowHours],
    ["Leitura", report.inference.title],
    ["Base dos resultados", report.readout === "OBSERVED" ? "Resultados observados até agora, incluindo janelas ainda abertas" : "Somente entradas com janela completa"],
    ["Detalhe", report.inference.detail],
    ...Object.entries(report.filters).map(([key, value]) => [`Filtro ${key}`, value ?? ""]),
    [],
    ["Variante", "Webinar", "Entradas", "Base das métricas", "Janela completa", "Aguardando janela", "Identificados", "Reprodução", "Pitch", "Clique na oferta", "Compradores", "Pedidos BRL", "Receita BRL", "Conversões da métrica", "Taxa (fração)", "IC95 inferior", "IC95 superior"],
    ...report.variants.map(v => [v.key, v.label, v.assigned, abMetricBase(v), v.mature, v.pending, v.identified, v.viewers, v.pitch, v.clicks, v.buyers, v.sales, v.revenueCents / 100, v.conversions, v.rate, v.interval?.[0] ?? null, v.interval?.[1] ?? null]),
    [], ["Diferença B − A (fração)", report.inference.delta], ["Variação relativa (fração)", report.inference.relativeLift],
    ["p-valor", report.inference.pValue], ["p-valor SRM", report.integrity.srmPValue],
    ...report.integrity.warnings.map(warning => ["Integridade", warning]),
    [], ["Dia de entrada (Brasília)", "Taxa A (fração)", "Taxa B (fração)"],
    ...report.daily.map(day => [day.date, day.A, day.B])
  ];
  const diagnostics = report.diagnostics;
  if (diagnostics) {
    rows.push([], ["Alcance por posição máxima registrada; não é tempo assistido contínuo"],
      ["Posição (segundos)", "Entradas A", "Fração da base A", "Entradas B", "Fração da base B"]);
    for (const point of diagnostics.position.points) rows.push([point.seconds, point.A.rate === null ? null : point.A.count, point.A.rate, point.B.rate === null ? null : point.B.count, point.B.rate]);
    const groups = [...diagnostics.segments, ...(diagnostics.timing ? [{ dimension: "hour", rows: diagnostics.timing.hours }, { dimension: "weekday", rows: diagnostics.timing.weekdays }] : [])];
    for (const group of groups) {
      rows.push([], [`Segmentos exploratórios: ${group.dimension}`, "Horários de entrada em Brasília"], ["Segmento", "Variante", "Base das métricas", "Janela completa", "Conversões principais", "Taxa principal (fração)", "Compradores", "Taxa de compra (fração)", "Receita BRL", "Receita por entrada BRL"]);
      for (const segment of group.rows) for (const key of ["A", "B"] as const) {
        const value = segment[key];
        rows.push([segment.value === "__unknown__" ? "Não informado" : segment.value, key, value.entries ?? value.mature, value.mature, value.conversions, value.conversionRate, value.buyers, value.purchaseRate, value.revenueCents / 100, value.revenuePerEntryCents === null ? null : value.revenuePerEntryCents / 100]);
      }
    }
    if (diagnostics.timing) {
      rows.push([], ["Tempo da entrada ao primeiro evento elegível; somente entradas com o evento"], ["Etapa", "Variante", "Mediana (segundos)", "Média (segundos)", "Observações"]);
      for (const [metric, label] of [["firstPlayback", "Reprodução"], ["firstPitch", "Pitch"], ["firstClick", "Clique"], ["firstPurchase", "Compra"]] as const) for (const key of ["A", "B"] as const) {
        const timing = diagnostics.timing[key][metric];
        rows.push([label, key, timing.medianSeconds, timing.averageSeconds, timing.samples]);
      }
    }
    if (diagnostics.audience) {
      rows.push([], ["Audiência contextual do webinar inteiro; inclui tráfego direto e não isola o grupo sorteado"], ["Variante", "Média simultânea", "Pico simultâneo", "Instante do pico (UTC)", "Leituras", "Motivo de ausência", "Média simultânea no pitch", "Pico simultâneo no pitch", "Leituras no pitch", "Limite do pitch"]);
      for (const key of ["A", "B"] as const) {
        const audience = diagnostics.audience[key];
        rows.push([key, audience.average, audience.peak, audience.peakAt, audience.sampleCount, audience.reason, audience.pitch.average, audience.pitch.peak, audience.pitch.sampleCount, audience.pitch.reason]);
      }
    }
  }
  if (report.experiment.configuration) {
    rows.push([], [report.experiment.configuration.frozen ? "Configuração registrada ao iniciar" : "Configuração atual; sem snapshot de início"],
      ["A", JSON.stringify(report.experiment.configuration.A)], ["B", JSON.stringify(report.experiment.configuration.B)]);
  }
  return "\uFEFF" + rows.map(row => row.map(csvCell).join(";")).join("\r\n");
}

export function downloadAbCsv(report: AbReport) {
  const url = URL.createObjectURL(new Blob([buildAbCsv(report)], { type: "text/csv;charset=utf-8;" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `teste-ab-${report.experiment.id}-${dayInBrasilia()}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
