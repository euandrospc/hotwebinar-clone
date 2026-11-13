import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AbTestsManager } from "@/components/ab-tests/ab-tests-manager";
import { AbExperimentForm } from "@/components/ab-tests/ab-experiment-form";
import { buildAbCsv } from "@/components/ab-tests/ab-utils";
import { createAbTestsDemo, getAbTestsDemoReport } from "@/lib/ab-tests-demo";
import type { AbReportFilters } from "@/lib/ab-tests";

vi.mock("@/components/tremor/area-chart", () => ({ AreaChart: () => <div data-testid="ab-chart" /> }));
const response = (body: unknown) => ({ ok: true, json: async () => body }) as Response;
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); window.history.replaceState(null, "", "/"); });

describe("recurring comparison interface", () => {
  it("creates a 30-day comparison from the chosen first day with a 24h window", async () => {
    const user = userEvent.setup();
    const save = vi.fn().mockResolvedValue(undefined);
    render(<AbExperimentForm webinars={createAbTestsDemo().webinars} onSave={save} onClose={vi.fn()} />);
    await user.type(screen.getByLabelText("Nome do teste"), "15h × 20h por 30 dias");
    await user.type(screen.getByLabelText("Hipótese"), "O horário das 20h converte mais compras.");
    await user.click(screen.getByRole("radio", { name: /Comparar webinars existentes/ }));
    await user.click(screen.getByRole("checkbox", { name: /Acompanhar webinars recorrentes/ }));
    expect(screen.getByRole("spinbutton", { name: /Duração do acompanhamento/ })).toHaveValue(30);
    expect(screen.getByRole("combobox", { name: /Janela de conversão/ })).toHaveValue("24");
    await user.clear(screen.getByLabelText("Entradas a partir de"));
    await user.type(screen.getByLabelText("Entradas a partir de"), "2026-11-11");
    expect(screen.getByText(/Período: 11\/11\/2026 a 10\/12\/2026/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Criar acompanhamento" }));
    await waitFor(() => expect(save).toHaveBeenCalledOnce());
    expect(save.mock.calls[0][0]).toMatchObject({ mode: "OBSERVATIONAL", observationUnit: "DAILY_SESSION", from: "2026-11-11T03:00:00.000Z", durationDays: 30, conversionWindowHours: 24 });
    expect(save.mock.calls[0][0]).not.toHaveProperty("to");
  });

  it("selects daily, weekly and total dashboard dates without losing the full calendar or public filters", async () => {
    const user = userEvent.setup();
    const fixture = createAbTestsDemo();
    const experiment = fixture.experiments.find(item => item.observationUnit === "DAILY_SESSION")!;
    const initial = getAbTestsDemoReport(experiment, {});
    const fetcher = vi.fn(async (path: string) => {
      if (path === "/api/ab-tests") return response({ experiments: [experiment], webinars: fixture.webinars });
      const filters = Object.fromEntries(new URL(path, "http://localhost").searchParams) as AbReportFilters;
      return response(getAbTestsDemoReport(experiment, filters));
    });
    vi.stubGlobal("fetch", fetcher);
    render(<AbTestsManager />);
    await screen.findByRole("button", { name: "Total · 30 dias" });
    expect(screen.queryByRole("button", { name: "Pausar coleta" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Diário" }));
    const selector = await screen.findByRole("combobox", { name: "Dia do acompanhamento" });
    await waitFor(() => expect(within(selector).getAllByRole("option")).toHaveLength(30));
    const first = initial.periods!.daily[0];
    await user.selectOptions(selector, first.key);
    await waitFor(() => expect(fetcher.mock.calls.some(([path]) => path.includes(encodeURIComponent(first.from)) && path.includes(encodeURIComponent(first.to)))).toBe(true));
    await screen.findByRole("table", { name: "Comparativo de resultados A e B" });
    expect(screen.getByText("Participações por dia")).toBeInTheDocument();
    expect(screen.getByText("Pessoas identificadas únicas")).toBeInTheDocument();
    expect(within(screen.getByRole("table", { name: "Comparativo de resultados A e B" })).getByText("Participações com compra")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Semanal" }));
    await waitFor(() => expect(within(screen.getByRole("combobox", { name: "Semana do acompanhamento" })).getAllByRole("option")).toHaveLength(5));
    await user.click(screen.getByRole("button", { name: "Total · 30 dias" }));
    await screen.findByRole("table", { name: "Comparativo de resultados A e B" });
    expect(fetcher.mock.calls.at(-1)?.[0]).toBe("/api/ab-tests/" + experiment.id + "/report");
    await user.click(screen.getByRole("button", { name: "Diário" }));
    await screen.findByRole("button", { name: "Limpar filtros" });
    await user.click(screen.getByRole("button", { name: "Limpar filtros" }));
    expect(screen.getByRole("button", { name: "Total · 30 dias" })).toHaveAttribute("aria-pressed", "true");
    expect(fetcher.mock.calls.some(([path]) => path.includes("/webinars/"))).toBe(false);
  });

  it("keeps refreshing after collection closes while conversion windows remain open", async () => {
    const fixture = createAbTestsDemo();
    const original = fixture.experiments.find(item => item.observationUnit === "DAILY_SESSION")!;
    const experiment = { ...original, status: "COMPLETED" as const, endsAt: new Date(Date.now() - 3600000).toISOString(), conversionWindowHours: 24 };
    const fetcher = vi.fn(async (path: string) => response(path === "/api/ab-tests" ? { experiments: [experiment], webinars: fixture.webinars } : getAbTestsDemoReport(experiment, {})));
    const interval = vi.spyOn(window, "setInterval");
    vi.stubGlobal("fetch", fetcher);
    render(<AbTestsManager />);
    await screen.findByRole("button", { name: "Total · 30 dias" });
    expect(screen.getByText("Aguardando conversões")).toBeInTheDocument();
    const polls = interval.mock.calls.filter(([, delay]) => delay === 60000).map(([callback]) => callback);
    expect(polls.length).toBeGreaterThan(0);
    const before = fetcher.mock.calls.length;
    await act(async () => { for (const poll of polls) if (typeof poll === "function") poll(); });
    await waitFor(() => expect(fetcher.mock.calls.length).toBe(before + 1));
    expect(screen.queryByRole("button", { name: "Pausar coleta" })).not.toBeInTheDocument();
  });

  it("exports all daily and weekly bases, statuses and audience without inventing future zeros", () => {
    const experiment = createAbTestsDemo().experiments.find(item => item.observationUnit === "DAILY_SESSION")!;
    const report = getAbTestsDemoReport(experiment, {});
    const csv = buildAbCsv(report);
    expect(csv).toContain('"Pessoas únicas"');
    expect(csv).toContain('"Participações com compra"');
    expect(csv).toContain('"Média no pitch"');
    expect(csv).toContain('"Diário"');
    expect(csv).toContain('"Semanal"');
    const future = report.periods!.daily.find(period => period.state === "UPCOMING")!;
    const row = csv.split("\r\n").find(line => line.startsWith('"Diário";"' + future.label + '"'))!;
    expect(row).toContain('"UPCOMING"');
    expect(row).toContain('"";"";"";"";""');
  });
});
