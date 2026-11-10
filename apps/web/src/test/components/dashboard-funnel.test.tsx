import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DashboardFunnel } from "@/components/dashboard/dashboard-funnel";
import type { FunnelStage } from "@/lib/dashboard-stats";

afterEach(cleanup);

const stages: FunnelStage[] = [
  { label: "Visitas", count: 912, pct: 100 },
  { label: "Acessou o webinar", count: 816, pct: 89.47 },
  { label: "Chegou no pitch", count: 412, pct: 45.18 },
  { label: "Clicou na oferta", count: 60, pct: 6.58 },
  { label: "Comprou", count: 18, pct: 1.97 }
];

const stageButton = (label: string) => within(screen.getByRole("group", { name: "Etapas do funil" }))
  .getByRole("button", { name: new RegExp(`^${label}:`) });
const details = () => screen.getByRole("region", { name: "Detalhes da etapa" });

describe("Realtime dashboard funnel", () => {
  it("keeps every stage count visible before and during interaction", async () => {
    const user = userEvent.setup();
    render(<DashboardFunnel stages={stages} />);
    const expectCountsVisible = () => {
      for (const stage of stages) {
        expect(within(stageButton(stage.label)).getByText(String(stage.count), { exact: true })).toBeVisible();
      }
    };

    expectCountsVisible();
    await user.hover(stageButton("Chegou no pitch"));
    expectCountsVisible();
    await user.click(stageButton("Clicou na oferta"));
    await user.unhover(stageButton("Clicou na oferta"));
    expectCountsVisible();
  });

  it("starts on purchases and previews a hovered stage without replacing the fixed selection", async () => {
    const user = userEvent.setup();
    render(<DashboardFunnel stages={stages} />);

    expect(stageButton("Comprou")).toHaveAttribute("aria-pressed", "true");
    expect(within(details()).queryByText("18", { exact: true })).not.toBeInTheDocument();
    expect(details()).toHaveTextContent("1,97%");
    expect(details()).toHaveTextContent("em relação às visitas");

    await user.hover(stageButton("Chegou no pitch"));
    expect(details()).toHaveTextContent("Chegou no pitch");
    expect(details()).toHaveTextContent("45,18%");
    expect(within(details()).queryByText("412", { exact: true })).not.toBeInTheDocument();
    expect(stageButton("Comprou")).toHaveAttribute("aria-pressed", "true");
    expect(stageButton("Chegou no pitch")).toHaveAttribute("aria-pressed", "false");

    await user.unhover(stageButton("Chegou no pitch"));
    expect(details()).toHaveTextContent("Comprou");
    expect(details()).toHaveTextContent("1,97%");
  });

  it("keeps a clicked stage selected after inspecting another stage", async () => {
    const user = userEvent.setup();
    render(<DashboardFunnel stages={stages} />);

    await user.click(stageButton("Acessou o webinar"));
    await user.hover(stageButton("Clicou na oferta"));
    expect(details()).toHaveTextContent("Clicou na oferta");
    expect(stageButton("Acessou o webinar")).toHaveAttribute("aria-pressed", "true");

    await user.unhover(stageButton("Clicou na oferta"));
    expect(details()).toHaveTextContent("Acessou o webinar");
    expect(details()).toHaveTextContent("89,47%");
  });

  it("supports arrows, Home, End, Enter and Escape without committing a focus preview", async () => {
    const user = userEvent.setup();
    render(<DashboardFunnel stages={stages} />);
    await user.click(stageButton("Acessou o webinar"));

    await user.keyboard("{ArrowRight}");
    expect(stageButton("Chegou no pitch")).toHaveFocus();
    expect(details()).toHaveTextContent("Chegou no pitch");
    expect(stageButton("Acessou o webinar")).toHaveAttribute("aria-pressed", "true");

    await user.keyboard("{Escape}");
    expect(stageButton("Acessou o webinar")).toHaveFocus();
    expect(details()).toHaveTextContent("Acessou o webinar");

    await user.keyboard("{End}{Enter}");
    expect(stageButton("Comprou")).toHaveFocus();
    expect(stageButton("Comprou")).toHaveAttribute("aria-pressed", "true");
    await user.keyboard("{Home}");
    expect(stageButton("Visitas")).toHaveFocus();
    await user.keyboard("{ArrowRight}{ArrowLeft}");
    expect(stageButton("Visitas")).toHaveFocus();
    expect(stageButton("Comprou")).toHaveAttribute("aria-pressed", "true");
  });

  it("selects on a touch tap without leaving a hover preview behind", async () => {
    const user = userEvent.setup();
    render(<DashboardFunnel stages={stages} />);
    const offer = stageButton("Clicou na oferta");

    await user.pointer({ keys: "[TouchA>]", target: offer });
    expect(details()).toHaveTextContent("Comprou");
    await user.pointer({ keys: "[/TouchA]", target: offer });
    expect(offer).toHaveAttribute("aria-pressed", "true");
    expect(details()).toHaveTextContent("Clicou na oferta");

    await user.hover(stageButton("Comprou"));
    await user.unhover(stageButton("Comprou"));
    expect(details()).toHaveTextContent("Clicou na oferta");
  });

  it("retains selection by label while refreshed or reordered data updates its values", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<DashboardFunnel stages={stages} />);
    await user.click(stageButton("Chegou no pitch"));
    const refreshed = stages.map((stage) => stage.label === "Chegou no pitch"
      ? { ...stage, count: 1234, pct: 135.31 }
      : stage);
    rerender(<DashboardFunnel stages={[refreshed[0], refreshed[2], refreshed[1], ...refreshed.slice(3)]} />);

    expect(stageButton("Chegou no pitch")).toHaveAttribute("aria-pressed", "true");
    expect(within(stageButton("Chegou no pitch")).getByText("1.234", { exact: true })).toBeVisible();
    expect(stageButton("Chegou no pitch")).toHaveAccessibleName(/^Chegou no pitch: 1\.234/);
    expect(details()).toHaveTextContent("135,31%");
    expect(details()).toHaveTextContent("Chegou no pitch");
  });

  it("shows an unavailable percentage for a zero visit base even with recorded purchases", () => {
    render(<DashboardFunnel stages={stages.map((stage, index) => ({
      ...stage, count: index === stages.length - 1 ? 2 : 0, pct: 0
    }))} />);

    expect(details()).toHaveTextContent("Comprou");
    expect(within(stageButton("Comprou")).getByText("2", { exact: true })).toBeVisible();
    expect(details()).toHaveTextContent("—");
    expect(details()).not.toHaveTextContent(/0%|NaN|Infinity/);
  });

  it("handles removed stages and an empty response without stale details", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<DashboardFunnel stages={stages} />);
    await user.click(stageButton("Clicou na oferta"));
    rerender(<DashboardFunnel stages={[]} />);
    expect(screen.getByText("Nenhuma etapa disponível")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Detalhes da etapa" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Clicou na oferta:/ })).not.toBeInTheDocument();

    rerender(<DashboardFunnel stages={[{ label: "Visitas", count: 4, pct: 100 }]} />);
    expect(stageButton("Visitas")).toHaveAttribute("aria-pressed", "true");
    expect(details()).toHaveTextContent("Visitas");
    expect(within(stageButton("Visitas")).getByText("4", { exact: true })).toBeVisible();
    expect(document.body).not.toHaveTextContent(/NaN|Infinity|undefined/);
  });
});
