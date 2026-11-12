import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AbTestsManager } from "@/components/ab-tests/ab-tests-manager";
import { AbExperimentForm } from "@/components/ab-tests/ab-experiment-form";
import type { AbExperimentDto, AbReport, AbWebinarOption } from "@/lib/ab-tests";
import { buildAbCsv, calendarFilters } from "@/components/ab-tests/ab-utils";
import { createAbTestsDemo, getAbTestsDemoReport } from "@/lib/ab-tests-demo";

vi.mock("@/components/tremor/area-chart", () => ({ AreaChart: () => <div data-testid="ab-chart" /> }));

const webinars: AbWebinarOption[] = [
  { id: "a", title: "Abertura original", name: "Original", slug: "original", status: "ACTIVE", mode: "JIT" },
  { id: "b", title: "Abertura direta", name: "Direta", slug: "direta", status: "ACTIVE", mode: "JIT" }
];
const experiment: AbExperimentDto = {
  id: "experiment", name: "Teste da abertura", hypothesis: "Uma abertura direta aumenta a compra.",
  mode: "RANDOMIZED", status: "COMPLETED", metric: "PURCHASE", webinarAId: "a", webinarBId: "b", webinarA: webinars[0], webinarB: webinars[1],
  baselineRate: .05, minimumDetectableLift: .2, sampleSizePerVariant: 8158, durationDays: 14, conversionWindowHours: 72,
  startedAt: "2026-10-01T03:00:00.000Z", endsAt: "2026-10-15T03:00:00.000Z", completedAt: "2026-10-15T03:00:00.000Z", createdAt: "2026-10-01T03:00:00.000Z", updatedAt: "2026-10-15T03:00:00.000Z", assignmentCount: 2000, publicPath: "/ab/experiment"
};
function report(label: string): AbReport {
  return {
    experiment, generatedAt: "2026-11-11T15:00:00.000Z", filters: {},
    variants: [
      { key: "A", webinarId: "a", label: "Original", assigned: 1000, mature: 900, pending: 100, identified: 800, viewers: 700, pitch: 500, clicks: 100, buyers: 45, sales: 45, revenueCents: 450000, conversions: 45, rate: .05, interval: [.037, .066] },
      { key: "B", webinarId: "b", label: "Direta", assigned: 1000, mature: 900, pending: 100, identified: 820, viewers: 730, pitch: 520, clicks: 130, buyers: 54, sales: 54, revenueCents: 540000, conversions: 54, rate: .06, interval: [.047, .078] }
    ],
    daily: [{ date: "2026-10-01", A: .05, B: .06 }],
    integrity: { overlapPeople: 0, duplicateIdentities: 0, unattributedSales: 0, excludedCurrencySales: 0, srmPValue: 1, warnings: [] },
    inference: { state: "EXPLORATORY", title: label, detail: "Recorte exploratório sem decisão automática.", delta: .01, relativeLift: .2, interval: null, pValue: null },
    filterOptions: { source: ["paid", "organic"], medium: [], campaign: [], content: [], device: ["mobile"] }
  };
}
const response = (body: unknown, ok = true) => ({ ok, json: async () => body }) as Response;

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); window.history.replaceState(null, "", "/"); });

describe("A/B frontend", () => {
  it("changes only the observed comparison conversion window and reloads its report", async () => {
    const user = userEvent.setup();
    let current: AbExperimentDto = { ...experiment, mode: "OBSERVATIONAL", publicPath: null };
    const fetcher = vi.fn(async (path: string, init?: RequestInit) => {
      if (init?.method === "PATCH") {
        current = { ...current, conversionWindowHours: 24, updatedAt: "2026-11-12T12:00:00Z" };
        return response({ experiment: current });
      }
      if (path === "/api/ab-tests") return response({ experiments: [current], webinars });
      return response({ ...report("Observação"), experiment: current, readout: "OBSERVED" });
    });
    vi.stubGlobal("fetch", fetcher);
    render(<AbTestsManager />);
    await screen.findByRole("table", { name: "Comparativo de resultados A e B" });
    await user.click(screen.getByRole("button", { name: "Detalhes" }));
    await user.selectOptions(screen.getByRole("combobox", { name: "Janela da comparação" }), "24");
    await user.click(screen.getByRole("button", { name: "Salvar janela" }));
    await waitFor(() => expect(fetcher).toHaveBeenCalledWith("/api/ab-tests/experiment", expect.objectContaining({ method: "PATCH", body: JSON.stringify({ action: "conversion_window", conversionWindowHours: 24 }) })));
    await waitFor(() => expect(screen.getByRole("button", { name: "Salvar janela" })).toBeDisabled());
    expect(screen.getByRole("combobox", { name: "Janela da comparação" })).toHaveValue("24");
    expect(fetcher.mock.calls.filter(([path]) => path.includes("/report"))).toHaveLength(2);
    expect(fetcher.mock.calls.some(([path]) => path.includes("/webinars/"))).toBe(false);
  });

  it("keeps a demonstration conversion-window change in memory", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const fetcher = vi.fn().mockRejectedValue(new Error("Unexpected demo request"));
    vi.stubGlobal("fetch", fetcher);
    const user = userEvent.setup();
    const historical = createAbTestsDemo().experiments.find(item => item.mode === "OBSERVATIONAL")!;
    window.history.replaceState(null, "", `/?test=${historical.id}`);
    render(<AbTestsManager demo />);
    await screen.findByRole("table", { name: "Comparativo de resultados A e B" });
    await user.click(screen.getByRole("button", { name: "Detalhes" }));
    await user.selectOptions(screen.getByRole("combobox", { name: "Janela da comparação" }), "24");
    await user.click(screen.getByRole("button", { name: "Salvar janela" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Salvar janela" })).toBeDisabled());
    expect(screen.getByRole("combobox", { name: "Janela da comparação" })).toHaveValue("24");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("does not offer a window edit for randomized experiments", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn(async (path: string) => response(path === "/api/ab-tests" ? { experiments: [experiment], webinars } : report("Teste"))));
    render(<AbTestsManager />);
    await screen.findByRole("table", { name: "Comparativo de resultados A e B" });
    await user.click(screen.getByRole("button", { name: "Detalhes" }));
    expect(screen.queryByRole("combobox", { name: "Janela da comparação" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Salvar janela" })).not.toBeInTheDocument();
  });

  it("previews synthetic reports, filters and lifecycle actions without any API writes or reads", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const fetcher = vi.fn().mockRejectedValue(new Error("Unexpected network request in demo"));
    vi.stubGlobal("fetch", fetcher);
    const user = userEvent.setup();
    const fixture = createAbTestsDemo();
    const running = fixture.experiments.find(item => item.status === "RUNNING")!;
    render(<AbTestsManager demo />);
    const table = await screen.findByRole("table", { name: "Comparativo de resultados A e B" });
    const fullTable = table.textContent;
    expect(screen.queryAllByRole("link").some(link => link.getAttribute("href")?.includes("demo-ab-"))).toBe(false);
    await user.click(screen.getByRole("button", { name: "Filtros" }));
    const source = screen.getByLabelText("Origem · UTM source") as HTMLSelectElement;
    await user.selectOptions(source, source.options[1].value);
    await user.click(screen.getByRole("button", { name: "Aplicar filtros" }));
    await waitFor(() => expect(screen.getByRole("table", { name: "Comparativo de resultados A e B" }).textContent).not.toBe(fullTable));
    await user.click(screen.getByRole("button", { name: /Selecionar teste:/ }));
    await user.click(screen.getByRole("option", { name: new RegExp(running.name) }));
    await screen.findByRole("button", { name: "Pausar coleta" });
    await user.click(screen.getByRole("button", { name: "Pausar coleta" }));
    const buttons = screen.getAllByRole("button", { name: "Pausar coleta" });
    await user.click(buttons[buttons.length - 1]);
    expect(await screen.findByRole("button", { name: "Retomar coleta" })).toBeEnabled();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("cannot render demonstration data in production even if the demo prop is set", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const fetcher = vi.fn().mockResolvedValue(response({ experiments: [], webinars: [] }));
    vi.stubGlobal("fetch", fetcher);
    render(<AbTestsManager demo />);
    expect(await screen.findByRole("link", { name: "Ir para Webinars" })).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("keeps creation and starting a demonstration draft in memory", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const fetcher = vi.fn().mockRejectedValue(new Error("Unexpected network request in demo"));
    vi.stubGlobal("fetch", fetcher);
    const user = userEvent.setup();
    render(<AbTestsManager demo />);
    await screen.findByRole("table", { name: "Comparativo de resultados A e B" });
    await user.click(screen.getByRole("button", { name: "Novo teste" }));
    await user.type(screen.getByLabelText("Nome do teste"), "Prévia de novo teste");
    await user.type(screen.getByLabelText("Hipótese"), "Uma nova abertura aumenta a conversão.");
    await user.click(screen.getByRole("button", { name: "Criar rascunho" }));
    await user.click(await screen.findByRole("button", { name: "Iniciar teste" }));
    const buttons = screen.getAllByRole("button", { name: "Iniciar teste" });
    await user.click(buttons[buttons.length - 1]);
    expect(await screen.findByRole("button", { name: "Pausar coleta" })).toBeEnabled();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("shows the real prerequisite instead of generating demonstration experiments", async () => {
    const fetcher = vi.fn().mockResolvedValue(response({ experiments: [], webinars: [webinars[0]] }));
    vi.stubGlobal("fetch", fetcher);
    render(<AbTestsManager />);
    expect(await screen.findByRole("link", { name: "Ir para Webinars" })).toHaveAttribute("href", "/dashboard/webinars");
    expect(screen.getByRole("button", { name: "Novo teste" })).toBeDisabled();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("plans a historical comparison with two webinars and inclusive Brasília dates", async () => {
    const user = userEvent.setup();
    const save = vi.fn().mockResolvedValue(undefined);
    render(<AbExperimentForm webinars={webinars} onClose={vi.fn()} onSave={save} />);
    await user.type(screen.getByLabelText("Nome do teste"), "Comparação da abertura");
    await user.type(screen.getByLabelText("Hipótese"), "Uma abertura direta aumenta conversões.");
    expect(screen.getByText("8.158")).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: /Comparar webinars existentes/ }));
    await user.clear(screen.getByLabelText("Entradas a partir de"));
    await user.type(screen.getByLabelText("Entradas a partir de"), "2026-10-01");
    await user.clear(screen.getByLabelText("Entradas até"));
    await user.type(screen.getByLabelText("Entradas até"), "2026-10-31");
    await user.click(screen.getByRole("button", { name: "Criar comparação" }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ mode: "OBSERVATIONAL", webinarAId: "a", webinarBId: "b", from: "2026-10-01T03:00:00.000Z", to: "2026-11-01T02:59:59.999Z" }));
  });

  it("shows required traffic and warns about an infeasible fixed horizon before starting", async () => {
    const user = userEvent.setup();
    render(<AbExperimentForm webinars={webinars} onClose={vi.fn()} onSave={vi.fn()} />);
    expect(screen.getByRole("spinbutton", { name: "Efeito mínimo detectável (%)" })).toHaveValue(20);
    expect(screen.getByText("1.166")).toBeInTheDocument();
    expect(screen.getByText("17")).toBeInTheDocument();
    await user.click(screen.getByText("Simular com meu tráfego"));
    await user.type(screen.getByLabelText("Entradas esperadas por dia · A + B"), "100");
    expect(screen.getByRole("status")).toHaveTextContent("164 dias de coleta");
    expect(screen.getByRole("status")).toHaveTextContent("O prazo de 14 dias é curto");
    await user.clear(screen.getByLabelText("Entradas esperadas por dia · A + B"));
    await user.type(screen.getByLabelText("Entradas esperadas por dia · A + B"), "2000");
    expect(screen.getByRole("status")).toHaveTextContent("mantenha os 14 dias de coleta");
  });

  it("keeps the hypothesis and distribution link accessible in compact test details", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn((path: string) => Promise.resolve(response(path === "/api/ab-tests" ? { experiments: [experiment], webinars } : report("Leitura inicial")))));
    render(<AbTestsManager />);
    await screen.findByText("Leitura inicial");
    expect(screen.queryByRole("dialog", { name: "Detalhes do teste" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Detalhes" }));
    expect(screen.getByRole("dialog", { name: "Detalhes do teste" })).toHaveTextContent(experiment.hypothesis);
    const clipboard = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);
    await user.click(screen.getByRole("button", { name: "Copiar link" }));
    expect(clipboard).toHaveBeenCalledWith(new URL(experiment.publicPath!, window.location.origin).href);
    expect(await screen.findByRole("button", { name: "Link copiado" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.getByRole("button", { name: "Detalhes" })).toHaveFocus();
  });

  it("discards a slow response after switching the report filters", async () => {
    const user = userEvent.setup();
    let resolvePaid!: (value: Response) => void;
    const paid = new Promise<Response>(resolve => { resolvePaid = resolve; });
    vi.stubGlobal("fetch", vi.fn((path: string) => {
      if (path === "/api/ab-tests") return Promise.resolve(response({ experiments: [experiment], webinars }));
      if (path.includes("source=paid")) return paid;
      if (path.includes("source=organic")) return Promise.resolve(response(report("Leitura organic")));
      return Promise.resolve(response(report("Leitura inicial")));
    }));
    render(<AbTestsManager />);
    await screen.findByText("Leitura inicial");
    expect(screen.getByText("200 aguardando a janela de 72h")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Filtros" }));
    await user.selectOptions(screen.getByLabelText("Origem · UTM source"), "paid");
    await user.click(screen.getByRole("button", { name: "Aplicar filtros" }));
    expect(screen.queryByText("Leitura inicial")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Exportar CSV" })).toBeDisabled();
    await user.selectOptions(screen.getByLabelText("Origem · UTM source"), "organic");
    await user.click(screen.getByRole("button", { name: "Aplicar filtros" }));
    await screen.findByText("Leitura organic");
    await act(async () => resolvePaid(response(report("Leitura paid antiga"))));
    expect(screen.getByText("Leitura organic")).toBeInTheDocument();
    expect(screen.queryByText("Leitura paid antiga")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Exportar CSV" })).toBeEnabled();
  });

  it("swaps control and variant when the account has exactly two webinars", async () => {
    const user = userEvent.setup();
    const save = vi.fn().mockResolvedValue(undefined);
    render(<AbExperimentForm webinars={webinars} onClose={vi.fn()} onSave={save} />);
    await user.type(screen.getByLabelText("Nome do teste"), "Abertura invertida");
    await user.type(screen.getByLabelText("Hipótese"), "Inverter os webinars de controle e variante.");
    expect(screen.getByRole("combobox", { name: /Webinar de controle/ })).toHaveValue("a");
    expect(screen.getByRole("combobox", { name: /Webinar variante/ })).toHaveValue("b");
    await user.click(screen.getByRole("button", { name: "Inverter A e B" }));
    expect(screen.getByRole("combobox", { name: /Webinar de controle/ })).toHaveValue("b");
    expect(screen.getByRole("combobox", { name: /Webinar variante/ })).toHaveValue("a");
    await user.click(screen.getByRole("button", { name: "Criar rascunho" }));
    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ webinarAId: "b", webinarBId: "a" })));
  });

  it("keeps a failed start reviewable and surfaces the readable server error", async () => {
    const user = userEvent.setup();
    const draft = { ...experiment, status: "DRAFT" as const, startedAt: null, endsAt: null, completedAt: null };
    vi.stubGlobal("fetch", vi.fn((path: string, init?: RequestInit) => {
      if (init?.method === "PATCH") return Promise.resolve(response({ error: "webinar_not_active", message: "Publique os dois webinars antes de iniciar." }, false));
      if (path === "/api/ab-tests") return Promise.resolve(response({ experiments: [draft], webinars }));
      return Promise.resolve(response({ ...report("Planejamento"), experiment: draft }));
    }));
    render(<AbTestsManager />);
    await screen.findByText("Planejamento");
    await user.click(screen.getByRole("button", { name: "Iniciar teste" }));
    const buttons = screen.getAllByRole("button", { name: "Iniciar teste" });
    await user.click(buttons[buttons.length - 1]);
    expect(await screen.findByRole("alert")).toHaveTextContent("Publique os dois webinars antes de iniciar.");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("exports aggregate facts, preserves unknown values and neutralizes formulas", () => {
    const value = report("Recorte");
    value.experiment = { ...experiment, name: '=HYPERLINK("evil")' };
    value.variants[0].label = "  +SUM(1,2)";
    value.variants[1].rate = null;
    const csv = buildAbCsv(value);
    expect(csv).toContain('"\'=HYPERLINK(""evil"")"');
    expect(csv).toContain('"\'  +SUM(1,2)"');
    expect(csv).toContain('"Taxa (fração)"');
    expect(csv).toContain('"Aguardando janela"');
    expect(csv).toContain('"A";"\'  +SUM(1,2)";"1000";"900";"900";"100"');
    expect(calendarFilters("2026-11-11", "2026-11-11")).toEqual({ from: "2026-11-11T03:00:00.000Z", to: "2026-11-12T02:59:59.999Z" });
  });
  it("exports the whole diagnostic with its audience scope and preserved configuration", () => {
    const fixture = createAbTestsDemo();
    const schedule = fixture.experiments.find(item => item.testVariable === "SCHEDULE")!;
    const csv = buildAbCsv(getAbTestsDemoReport(schedule));
    expect(csv).toContain("Horário e programação");
    expect(csv).toContain("Segmentos exploratórios: hour");
    expect(csv).toContain("Alcance por posição máxima registrada");
    expect(csv).toContain("inclui tráfego direto e não isola o grupo sorteado");
    expect(csv).toContain("Configuração registrada ao iniciar");
  });
});
