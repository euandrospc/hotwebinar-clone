import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AbTestPicker } from "@/components/ab-tests/ab-test-picker";
import type { AbExperimentDto } from "@/lib/ab-tests";

const makeExperiment = (index: number, overrides: Partial<AbExperimentDto> = {}): AbExperimentDto => ({
  id: `test-${index}`, name: `Experimento ${index}`, hypothesis: index === 3 ? "Uma oferta mais clara reduz objeções." : "Uma abertura direta aumenta a compra.",
  mode: "RANDOMIZED", status: "DRAFT", metric: "PURCHASE", webinarAId: "a", webinarBId: "b",
  webinarA: { id: "a", title: "Abertura original", name: "Original", slug: "original", status: "ACTIVE", mode: "JIT" },
  webinarB: { id: "b", title: `Abertura ${index}`, name: `Variante ${index}`, slug: `variante-${index}`, status: "ACTIVE", mode: "JIT" },
  baselineRate: .05, minimumDetectableLift: .2, sampleSizePerVariant: 8158, durationDays: 14, conversionWindowHours: 72,
  startedAt: null, endsAt: null, completedAt: null, createdAt: "2026-11-01T03:00:00.000Z", updatedAt: "2026-11-01T03:00:00.000Z", assignmentCount: 0, publicPath: `/ab/test-${index}`,
  ...overrides
});

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("compact A/B experiment picker", () => {
  it("keeps the list hidden until opened, paginates six options and closes on selection", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<AbTestPicker experiments={Array.from({ length: 8 }, (_, index) => makeExperiment(index + 1))} selectedId="test-1" onSelect={onSelect} />);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(screen.getByText("8 testes")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Selecionar teste: Experimento 1" }));
    expect(screen.getByRole("textbox", { name: "Buscar teste" })).toHaveFocus();
    expect(screen.getAllByRole("option").filter(option => option.tagName === "BUTTON")).toHaveLength(6);
    const list = screen.getByRole("listbox", { name: "Testes disponíveis" });
    expect(within(list).getByRole("option", { name: /Experimento 1 / })).toHaveAttribute("aria-selected", "true");
    await user.click(screen.getByRole("button", { name: "Próxima página de testes" }));
    expect(within(list).getAllByRole("option")).toHaveLength(2);
    await user.click(within(list).getByRole("option", { name: /Experimento 8 / }));
    expect(onSelect).toHaveBeenCalledWith("test-8");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Selecionar teste: Experimento 1" })).toHaveFocus();
  });

  it("searches hypotheses without accents and filters effective expired statuses", async () => {
    const user = userEvent.setup();
    const experiments = [makeExperiment(1), makeExperiment(2, { status: "RUNNING", endsAt: "2020-01-01T03:00:00.000Z" }), makeExperiment(3, { mode: "OBSERVATIONAL", status: "COMPLETED" })];
    render(<AbTestPicker experiments={experiments} selectedId="test-1" onSelect={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Selecionar teste: Experimento 1" }));
    await user.type(screen.getByRole("textbox", { name: "Buscar teste" }), "objecoes");
    let options = within(screen.getByRole("listbox")).getAllByRole("option");
    expect(options).toHaveLength(1);
    expect(options[0]).toHaveTextContent("Experimento 3");
    await user.click(screen.getByRole("button", { name: "Limpar filtros" }));
    await user.selectOptions(screen.getByRole("combobox", { name: "Filtrar testes por status" }), "COLLECTION_ENDED");
    options = within(screen.getByRole("listbox")).getAllByRole("option");
    expect(options).toHaveLength(1);
    expect(options[0]).toHaveTextContent("Experimento 2");
    expect(options[0]).toHaveTextContent("Coleta encerrada");
    await user.selectOptions(screen.getByRole("combobox", { name: "Filtrar testes por modalidade" }), "OBSERVATIONAL");
    expect(screen.getByRole("status")).toHaveTextContent("Nenhum teste encontrado");
  });

  it("supports keyboard navigation and opens the selected experiment's page", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<AbTestPicker experiments={Array.from({ length: 8 }, (_, index) => makeExperiment(index + 1))} selectedId="test-8" onSelect={onSelect} />);
    await user.click(screen.getByRole("button", { name: "Selecionar teste: Experimento 8" }));
    const options = within(screen.getByRole("listbox")).getAllByRole("option");
    expect(options).toHaveLength(2);
    expect(options[1]).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{ArrowDown}");
    expect(options[0]).toHaveFocus();
    await user.keyboard("{End}");
    expect(options[1]).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(options[0]).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onSelect).toHaveBeenCalledWith("test-7");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });
});
