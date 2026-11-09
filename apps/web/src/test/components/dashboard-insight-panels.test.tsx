import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DashboardWatchChart, type DashboardWatchData } from "@/components/dashboard/dashboard-watch-chart";
import { DashboardSupportOverview } from "@/components/dashboard/dashboard-support-overview";

afterEach(cleanup);

const watch: DashboardWatchData = {
  averageWatchedSeconds: 125,
  totalWatchedSeconds: 1250,
  viewerCount: 10,
  pitchAtSeconds: 180,
  retention: [
    { positionSeconds: 0, label: "00:00", viewers: 10, percentage: 100 },
    { positionSeconds: 180, label: "03:00", viewers: 4, percentage: 40 },
    { positionSeconds: 300, label: "05:00", viewers: 1, percentage: 10 }
  ]
};

describe("Dashboard watch and support panels", () => {
  it("distinguishes accumulated average from reach and changes the chart unit", async () => {
    const user = userEvent.setup();
    const { container } = render(<DashboardWatchChart watch={watch} />);
    expect(screen.getByText("2 min 5 s")).toBeInTheDocument();
    expect(screen.getByText("Média acumulada por pessoa")).toBeInTheDocument();
    expect(screen.getByText("Alcance ao longo do vídeo")).toBeInTheDocument();
    expect(screen.getByText("Pitch em 03:00")).toBeInTheDocument();
    expect(container.querySelector('[tremor-id="tremor-raw"]')).toHaveAttribute("aria-label", expect.stringContaining("em percentual"));

    await user.click(screen.getByRole("button", { name: "Pessoas" }));
    expect(screen.getByRole("button", { name: "Pessoas" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Percentual" })).toHaveAttribute("aria-pressed", "false");
    expect(container.querySelector('[tremor-id="tremor-raw"]')).toHaveAttribute("aria-label", expect.stringContaining("em pessoas"));
  });

  it("does not turn an unavailable watch average into zero or draw fictional reach", () => {
    const { container } = render(<DashboardWatchChart watch={{ averageWatchedSeconds: null, totalWatchedSeconds: 0, viewerCount: 0, retention: [], pitchAtSeconds: null }} />);
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.getByText("Sem reprodução registrada neste período.")).toBeInTheDocument();
    expect(container.querySelector('[tremor-id="tremor-raw"]')).toBeNull();
    expect(screen.queryByText(/Pitch em/)).not.toBeInTheDocument();
  });

  it("keeps channel overlap and unavailable first replies honest and links to the supported route", () => {
    render(<DashboardSupportOverview webinarId="test-webinar" support={{ human: { conversations: 5, replies: 12, averageFirstReplySeconds: null }, ai: { conversations: 4, replies: 9, averageFirstReplySeconds: 0 }, uniqueConversations: 7 }} />);
    const human = within(screen.getByRole("group", { name: "Equipe humana" }));
    const ai = within(screen.getByRole("group", { name: "Agentes de IA" }));
    expect(human.getByText("5")).toBeInTheDocument();
    expect(human.getByText("12")).toBeInTheDocument();
    expect(human.getByText("—")).toBeInTheDocument();
    expect(ai.getByText("4")).toBeInTheDocument();
    expect(ai.getByText("0 s")).toBeInTheDocument();
    expect(screen.getByText(/7 conversas com mensagens no período/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver conversas" })).toHaveAttribute("href", "/atendimento");
  });
});
