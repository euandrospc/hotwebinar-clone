import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AbDecisionSummary } from "@/components/ab-tests/ab-decision-summary";
import { AbDiagnosticsPanel } from "@/components/ab-tests/ab-diagnostics-panel";
import { AbComparisonTable } from "@/components/ab-tests/ab-comparison-table";
import { createAbTestsDemo, getAbTestsDemoReport } from "@/lib/ab-tests-demo";
import type { AbLatencyMetric, AbSegmentMetrics } from "@/lib/ab-tests";

vi.mock("@/components/tremor/area-chart", () => ({ AreaChart: () => <div data-testid="chart" /> }));
afterEach(cleanup);
const now = new Date("2026-11-11T18:00:00Z");
const createReport = () => getAbTestsDemoReport(createAbTestsDemo(now).experiments[0], {}, now);
const latency = (medianSeconds: number | null, averageSeconds = medianSeconds): AbLatencyMetric => ({ medianSeconds, averageSeconds, samples: medianSeconds === null ? 0 : 10 });
const metrics = (base: number, conversions: number): AbSegmentMetrics => ({ mature: base, conversions, buyers: conversions, revenueCents: conversions * 10000, conversionRate: base ? conversions / base : null, purchaseRate: base ? conversions / base : null, revenuePerEntryCents: base ? conversions * 10000 / base : null });

describe("A/B decision and diagnostics", () => {
  it("waits for the planned readout even when no current entries remain pending", () => {
    const report = createReport();
    report.inference.state = "MATURING";
    report.variants[0].pending = 0;
    report.variants[1].pending = 0;
    render(<AbDecisionSummary report={report} />);
    expect(screen.getByText(/As entradas atuais já completaram suas janelas/)).toBeInTheDocument();
    expect(screen.getByText(/leitura final aguarda o encerramento da janela planejada/)).toBeInTheDocument();
    expect(screen.queryByText(/0 entradas ainda aguardam/)).not.toBeInTheDocument();
  });

  it("keeps sample targets visible and surfaces commercial divergence without claiming a business winner", async () => {
    const user = userEvent.setup();
    const report = createReport();
    report.experiment.metric = "OFFER_CLICK";
    report.inference.delta = .1;
    report.variants[0] = { ...report.variants[0], mature: 100, buyers: 10, revenueCents: 100000 };
    report.variants[1] = { ...report.variants[1], mature: 100, buyers: 8, revenueCents: 60000 };
    render(<AbDecisionSummary report={report} />);
    expect(screen.getByRole("progressbar", { name: "Progresso da amostra A" })).toBeVisible();
    expect(screen.getByText(/a compra e a receita por entrada são menores/)).toBeInTheDocument();
    const table = screen.getByRole("table", { name: "Comparação comercial A e B" });
    expect(within(table).getByRole("row", { name: /Compra/ })).toHaveTextContent("10,0%8,0%-2 p.p.");
    await user.click(screen.getByText("Ver amostra e critérios estatísticos"));
    expect(screen.getByText(/O MDE dimensiona a amostra/)).toBeVisible();
    expect(screen.getByText(/Lucro, ROAS e CPA não estão disponíveis/)).toBeVisible();
    expect(screen.queryByText(/adotar automaticamente/i)).not.toBeInTheDocument();
  });

  it("compares all observable funnel stages with denominators and differences", () => {
    const report = createReport();
    report.variants[0] = { ...report.variants[0], mature: 100, viewers: 60, pitch: 40, clicks: 20, buyers: 10 };
    report.variants[1] = { ...report.variants[1], mature: 80, viewers: 56, pitch: 32, clicks: 24, buyers: 8 };
    render(<AbComparisonTable report={report} />);
    const table = screen.getByRole("table", { name: "Comparativo de resultados A e B" });
    expect(within(table).getByRole("row", { name: /Com registro de reprodução/ })).toHaveTextContent("60,0% de 100");
    expect(within(table).getByRole("row", { name: /Com registro de reprodução/ })).toHaveTextContent("70,0% de 80");
    expect(within(table).getByRole("row", { name: /Clicaram na oferta/ })).toHaveTextContent("+10 p.p.");
    expect(within(table).getByRole("row", { name: /Ticket médio por pedido/ })).toBeInTheDocument();
  });

  it("preserves missing position measurements and distinguishes elapsed time from watch time", async () => {
    const user = userEvent.setup();
    const report = createReport();
    report.diagnostics!.position = { basis: "MATURE_ENTRIES", mature: { A: 100, B: 80 }, measured: { A: 50, B: 0 }, points: [{ seconds: 60, A: { count: 40, rate: .4 }, B: { count: 0, rate: null } }] };
    const timing = { positionSamples: 10, meanMaxVideoSec: 360, medianMaxVideoSec: 300, firstPlayback: latency(0, 5), firstPitch: latency(120, 140), firstClick: latency(null), firstPurchase: latency(3600, 4200) };
    report.diagnostics!.timing = { timeZone: "America/Sao_Paulo", hours: [], weekdays: [], A: timing, B: timing };
    render(<AbDiagnosticsPanel report={report} />);
    await user.click(screen.getByRole("tab", { name: "Vídeo e jornada" }));
    expect(screen.getByText(/Posição máxima não representa tempo assistido contínuo/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Ver dados do alcance" }));
    const table = screen.getByRole("table", { name: "Dados do alcance por posição" });
    expect(within(table).getAllByText("—")).toHaveLength(2);
    const journey = screen.getByRole("table", { name: "Tempos até os marcos do webinar" });
    expect(within(journey).getByRole("row", { name: /Primeiro registro de reprodução/ })).toHaveTextContent("0s");
    await user.selectOptions(screen.getByRole("combobox", { name: "Medida dos tempos da jornada" }), "averageSeconds");
    expect(within(journey).getByRole("row", { name: /Primeiro registro de reprodução/ })).toHaveTextContent("5s");
  });

  it("searches and paginates descriptive segments and supports hour-of-entry exploration", async () => {
    const user = userEvent.setup();
    const report = createReport();
    const rows = Array.from({ length: 8 }, (_, index) => ({ value: index === 7 ? "orgânico" : `canal ${index}`, A: metrics(100 - index, 10), B: metrics(80 - index, 8) }));
    report.diagnostics!.segments = [{ dimension: "source", rows }];
    const timing = { positionSamples: 0, meanMaxVideoSec: null, medianMaxVideoSec: null, firstPlayback: latency(null), firstPitch: latency(null), firstClick: latency(null), firstPurchase: latency(null) };
    report.diagnostics!.timing = { timeZone: "America/Sao_Paulo", hours: [{ value: "09", A: metrics(10, 2), B: metrics(0, 0) }], weekdays: [], A: timing, B: timing };
    render(<AbDiagnosticsPanel report={report} />);
    await user.click(screen.getByRole("tab", { name: "Segmentos" }));
    expect(within(screen.getByRole("table", { name: "Comparação exploratória por segmento" })).getAllByRole("row")).toHaveLength(7);
    await user.click(screen.getByRole("button", { name: "Próxima" }));
    expect(within(screen.getByRole("table", { name: "Comparação exploratória por segmento" })).getAllByRole("row")).toHaveLength(3);
    await user.type(screen.getByRole("textbox", { name: "Buscar segmento" }), "organico");
    expect(screen.getByRole("row", { name: /orgânico/ })).toBeInTheDocument();
    await user.selectOptions(screen.getByRole("combobox", { name: "Agrupar segmentos por" }), "hour");
    expect(screen.getByRole("row", { name: /09h · Brasília/ })).toHaveTextContent("—");
    expect(screen.getByText(/não demonstra o efeito causal de alterar o horário/)).toBeInTheDocument();
  });

  it("labels simultaneous audience as contextual and keeps unavailable shared pitch readings missing", async () => {
    const user = userEvent.setup();
    const report = createReport();
    const arm = { from: "2026-11-01T03:00:00.000Z", to: "2026-11-02T03:00:00.000Z", average: 35.5, peak: 80, peakAt: "2026-11-01T12:30:00.000Z", sampleCount: 30, reason: null, pitch: { average: null, peak: null, sampleCount: 0, occurrenceCount: 0, reason: "Webinar JIT sem um instante compartilhado de pitch.", points: [] } };
    report.diagnostics!.audience = { scope: "WEBINAR_TOTAL", window: "MATURE_COHORT_WINDOWS", cadenceSeconds: 15, A: arm, B: arm };
    render(<AbDiagnosticsPanel report={report} />);
    await user.click(screen.getByRole("tab", { name: "Audiência" }));
    expect(screen.getByText(/Não é a audiência exclusiva dos visitantes sorteados/)).toBeInTheDocument();
    const row = screen.getByRole("row", { name: /Média simultânea no momento do pitch/ });
    expect(within(row).getAllByText("—")).toHaveLength(3);
    expect(screen.getAllByText(/Webinar JIT sem um instante compartilhado/)).toHaveLength(2);
  });
});
