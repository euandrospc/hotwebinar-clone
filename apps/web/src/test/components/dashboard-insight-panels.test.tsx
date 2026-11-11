import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DashboardWatchChart, type DashboardWatchData } from "@/components/dashboard/dashboard-watch-chart";

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

describe("Dashboard watch panel", () => {
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

});
