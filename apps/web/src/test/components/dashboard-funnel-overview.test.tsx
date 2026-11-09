import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DashboardFunnelOverview } from "@/components/dashboard/dashboard-funnel-overview";
import type { DashboardFunnelTransition } from "@/lib/dashboard-overview";

afterEach(cleanup);

const stages = [
  { label: "Acessos", count: 100, pct: 100 },
  { label: "Assistiram", count: 50, pct: 50 },
  { label: "Chegaram ao pitch", count: 0, pct: 0 },
  { label: "Clicaram na oferta", count: 12, pct: 12 },
  { label: "Compraram", count: 15, pct: 15 }
];

const stageButton = (label: string) => screen.getByRole("button", { name: new RegExp(`^${label}:`) });
const details = () => within(screen.getByRole("region", { name: "Detalhes da etapa" }));

const measuredStages = stages.map((stage, index) => ({
  ...stage, count: [200, 110, 100, 90, 80][index], pct: [100, 55, 50, 45, 40][index]
}));
// Valid but non-nested sets: the greatest difference between totals is 90
// (access → playback), while 100 playback viewers have no pitch record.
const measuredTransitions: DashboardFunnelTransition[] = [
  { fromLabel: "Acessos", toLabel: "Assistiram", fromCount: 200, toCount: 110, overlapCount: 110, previousOnlyCount: 90, currentOnlyCount: 0, overlapRate: 55 },
  { fromLabel: "Assistiram", toLabel: "Chegaram ao pitch", fromCount: 110, toCount: 100, overlapCount: 10, previousOnlyCount: 100, currentOnlyCount: 90, overlapRate: 9.09 },
  { fromLabel: "Chegaram ao pitch", toLabel: "Clicaram na oferta", fromCount: 100, toCount: 90, overlapCount: 80, previousOnlyCount: 20, currentOnlyCount: 10, overlapRate: 80 },
  { fromLabel: "Clicaram na oferta", toLabel: "Compraram", fromCount: 90, toCount: 80, overlapCount: 70, previousOnlyCount: 20, currentOnlyCount: 10, overlapRate: 77.78 }
];

describe("Dashboard funnel interactions", () => {
  it("starts on pitch and restores the selected stage after a pointer preview", async () => {
    const user = userEvent.setup();
    render(<DashboardFunnelOverview stages={stages} />);
    expect(stageButton("Chegaram ao pitch")).toHaveAttribute("aria-pressed", "true");

    const viewers = stageButton("Assistiram");
    const purchases = stageButton("Compraram");
    await user.click(viewers);
    await user.hover(purchases);
    expect(details().getByText(/3 a mais/)).toBeInTheDocument();
    expect(viewers).toHaveAttribute("aria-pressed", "true");
    expect(purchases).toHaveAttribute("aria-pressed", "false");

    await user.unhover(purchases);
    expect(viewers).toHaveAttribute("aria-pressed", "true");
    expect(details().getByText(/50 a menos/)).toBeInTheDocument();
  });

  it("navigates stages with arrows, Home and End and selects with the keyboard", async () => {
    const user = userEvent.setup();
    render(<DashboardFunnelOverview stages={stages} />);
    await user.click(stageButton("Assistiram"));
    await user.keyboard("{ArrowRight}");
    expect(stageButton("Chegaram ao pitch")).toHaveFocus();
    await user.keyboard("{End}");
    expect(stageButton("Compraram")).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(stageButton("Compraram")).toHaveAttribute("aria-pressed", "true");
    await user.keyboard("{Home}");
    expect(stageButton("Acessos")).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(stageButton("Assistiram")).toHaveFocus();
    await user.keyboard("{ArrowUp}");
    expect(stageButton("Acessos")).toHaveFocus();
  });

  it("reports increases and zero denominators honestly without clamping percentages", async () => {
    const user = userEvent.setup();
    render(<DashboardFunnelOverview stages={stages} />);
    await user.click(screen.getByRole("button", { name: "Entre etapas" }));

    expect(stageButton("Clicaram na oferta")).toHaveAccessibleName("Clicaram na oferta: 12, —");
    expect(stageButton("Compraram")).toHaveAccessibleName("Compraram: 15, 125%");
    await user.click(stageButton("Compraram"));
    expect(details().getByText(/3 a mais/)).toBeInTheDocument();
    expect(details().getByText(/125%/)).toBeInTheDocument();

    await user.click(stageButton("Clicaram na oferta"));
    expect(stageButton("Clicaram na oferta")).toHaveAttribute("aria-pressed", "true");
    expect(document.body).not.toHaveTextContent(/NaN|Infinity/);

    await user.click(screen.getByRole("button", { name: "Sobre acessos" }));
    expect(stageButton("Compraram")).toHaveAccessibleName("Compraram: 15, 15%");
    expect(stageButton("Clicaram na oferta")).toHaveAccessibleName("Clicaram na oferta: 12, 12%");
  });

  it("shows an empty state instead of a fictional funnel", () => {
    render(<DashboardFunnelOverview stages={stages.map((stage) => ({ ...stage, count: 0, pct: 0 }))} />);
    expect(screen.getByText(/Nenhum acesso registrado neste período/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Acessos:/ })).not.toBeInTheDocument();
  });

  it("updates values and recovers from empty or shorter data without stale indices", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<DashboardFunnelOverview stages={stages} />);
    await user.click(stageButton("Compraram"));
    rerender(<DashboardFunnelOverview stages={stages.map((stage) => ({ ...stage, count: stage.count * 2 }))} />);
    expect(stageButton("Compraram")).toHaveAccessibleName("Compraram: 30, 15%");
    expect(stageButton("Compraram")).toHaveAttribute("aria-pressed", "true");

    rerender(<DashboardFunnelOverview stages={[]} />);
    expect(document.body).not.toHaveTextContent(/NaN|Infinity|undefined/);
    rerender(<DashboardFunnelOverview stages={[{ label: "Acessos", count: 4, pct: 100 }]} />);
    expect(stageButton("Acessos")).toHaveAccessibleName("Acessos: 4, 100%");
    expect(document.body).not.toHaveTextContent(/NaN|Infinity|undefined/);
  });

  it("uses measured intersections between stages while retaining totals over accesses", async () => {
    const user = userEvent.setup();
    render(<DashboardFunnelOverview stages={measuredStages} transitions={measuredTransitions} />);

    expect(stageButton("Chegaram ao pitch")).toHaveAccessibleName("Chegaram ao pitch: 100, 50%");
    await user.click(screen.getByRole("button", { name: "Entre etapas" }));
    expect(stageButton("Chegaram ao pitch")).toHaveAccessibleName("Chegaram ao pitch: 100 pessoas; 10 de 110 da etapa anterior também nesta etapa (9,09%)");
    expect(stageButton("Compraram")).toHaveAccessibleName("Compraram: 80 pessoas; 70 de 90 da etapa anterior também nesta etapa (77,78%)");
    expect(details().getByText("Nas duas etapas").nextElementSibling).toHaveTextContent(/^9,09%$/);
    expect(details().getByText("Pessoas em comum").nextElementSibling).toHaveTextContent(/^10$/);
    expect(details().getByText("Sem registro de pitch").nextElementSibling).toHaveTextContent(/^100$/);
    expect(details().getByText(/90 registros de pitch sem reprodução registrada/)).toHaveTextContent("10 de 110 pessoas aparecem nas duas etapas no período.");

    await user.click(stageButton("Compraram"));
    expect(details().getByText("Pessoas em comum").nextElementSibling).toHaveTextContent(/^70$/);
    expect(details().getByText(/10 compradores sem clique registrado/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Sobre acessos" }));
    expect(stageButton("Compraram")).toHaveAccessibleName("Compraram: 80, 40%");
  });

  it("restores the fixed stage and focus with Escape after inspecting a different stage", async () => {
    const user = userEvent.setup();
    render(<DashboardFunnelOverview stages={measuredStages} transitions={measuredTransitions} />);
    await user.click(stageButton("Assistiram"));
    await user.keyboard("{ArrowRight}");
    expect(stageButton("Chegaram ao pitch")).toHaveFocus();
    expect(details().getByText("Pessoas em comum").nextElementSibling).toHaveTextContent(/^10$/);
    expect(stageButton("Assistiram")).toHaveAttribute("aria-pressed", "true");

    await user.keyboard("{Escape}");
    expect(stageButton("Assistiram")).toHaveFocus();
    expect(details().getByText("Pessoas em comum").nextElementSibling).toHaveTextContent(/^110$/);
    await user.hover(stageButton("Compraram"));
    expect(details().getByText("Pessoas em comum").nextElementSibling).toHaveTextContent(/^70$/);
    await user.keyboard("{Escape}");
    expect(details().getByText("Pessoas em comum").nextElementSibling).toHaveTextContent(/^110$/);
    expect(stageButton("Assistiram")).toHaveAttribute("aria-pressed", "true");
  });

  it("keeps a measured zero denominator unknown and reports the unmatched current population", async () => {
    const user = userEvent.setup();
    const zeroTransitions: DashboardFunnelTransition[] = [
      { fromLabel: "Acessos", toLabel: "Assistiram", fromCount: 100, toCount: 50, overlapCount: 50, previousOnlyCount: 50, currentOnlyCount: 0, overlapRate: 50 },
      { fromLabel: "Assistiram", toLabel: "Chegaram ao pitch", fromCount: 50, toCount: 0, overlapCount: 0, previousOnlyCount: 50, currentOnlyCount: 0, overlapRate: 0 },
      { fromLabel: "Chegaram ao pitch", toLabel: "Clicaram na oferta", fromCount: 0, toCount: 12, overlapCount: 0, previousOnlyCount: 0, currentOnlyCount: 12, overlapRate: null },
      { fromLabel: "Clicaram na oferta", toLabel: "Compraram", fromCount: 12, toCount: 15, overlapCount: 5, previousOnlyCount: 7, currentOnlyCount: 10, overlapRate: 41.67 }
    ];
    render(<DashboardFunnelOverview stages={stages} transitions={zeroTransitions} />);
    await user.click(screen.getByRole("button", { name: "Entre etapas" }));
    await user.click(stageButton("Clicaram na oferta"));
    expect(stageButton("Clicaram na oferta")).toHaveAccessibleName("Clicaram na oferta: 12 pessoas; 0 de 0 da etapa anterior também nesta etapa (—)");
    expect(details().getByText("Nas duas etapas").nextElementSibling).toHaveTextContent(/^—$/);
    expect(details().getByText("Pessoas em comum").nextElementSibling).toHaveTextContent(/^0$/);
    expect(details().getByText("Sem clique na oferta").nextElementSibling).toHaveTextContent(/^0$/);
    expect(details().getByText(/12 cliques sem registro de pitch/)).toHaveTextContent("Etapa anterior sem registros; percentual indisponível.");
    expect(document.body).not.toHaveTextContent(/NaN|Infinity|undefined/);
  });

  it("does not apply stale measured intersections to a changed population", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<DashboardFunnelOverview stages={measuredStages} transitions={measuredTransitions} />);
    await user.click(screen.getByRole("button", { name: "Entre etapas" }));
    expect(stageButton("Chegaram ao pitch")).toHaveAccessibleName("Chegaram ao pitch: 100 pessoas; 10 de 110 da etapa anterior também nesta etapa (9,09%)");

    rerender(<DashboardFunnelOverview stages={measuredStages.map((stage) => ({ ...stage, count: stage.count * 2 }))} transitions={measuredTransitions} />);
    expect(stageButton("Chegaram ao pitch")).toHaveAccessibleName("Chegaram ao pitch: 200, 90,91%");
    expect(details().queryByText("Pessoas em comum")).not.toBeInTheDocument();
    expect(details().getByText(/20 a menos/)).toBeInTheDocument();
    expect(screen.getByText("Razão entre as contagens das etapas")).toBeInTheDocument();
  });

  it("uses one explicit counting basis when measured transitions are incomplete", async () => {
    const user = userEvent.setup();
    render(<DashboardFunnelOverview stages={measuredStages} transitions={measuredTransitions.slice(1)} />);
    await user.click(screen.getByRole("button", { name: "Entre etapas" }));
    expect(stageButton("Chegaram ao pitch")).toHaveAccessibleName("Chegaram ao pitch: 100, 90,91%");
    expect(stageButton("Compraram")).toHaveAccessibleName("Compraram: 80, 88,89%");
    expect(details().queryByText("Pessoas em comum")).not.toBeInTheDocument();
    expect(screen.getByText("Razão entre as contagens das etapas")).toBeInTheDocument();
  });
});
