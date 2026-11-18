import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RealtimeKpiCardsV5 } from "@/components/webinar/realtime-kpi-cards-v5";
import { buildRealtimeKpis } from "@/lib/realtime-kpis-v5";
import { buildWebinarRealtimeSnapshot, type WebinarRealtimeSnapshot } from "@/lib/webinar-realtime-v5";

vi.mock("next-themes", () => ({ useTheme: () => ({ resolvedTheme: "light" }) }));
vi.mock("@mui/x-charts/LineChart", () => ({
  LineChart: () => <svg aria-label="Audience history" />,
  lineClasses: { area: "area", line: "line", mark: "mark" },
}));

const snapshot = () => ({
  ...buildWebinarRealtimeSnapshot([], new Date("2026-11-17T15:00:00.000Z")),
  audience: {
    average: 75.5,
    peak: 120,
    peakAt: "2026-11-17T14:30:00.000Z",
    sampleCount: 3,
    history: { from: "2026-11-17T03:00:00.000Z", to: "2026-11-17T15:00:00.000Z", points: [
      { at: "2026-11-17T14:30:00.000Z", online: 120 },
    ] },
  },
});

afterEach(cleanup);

describe("realtime v5 live indicator", () => {
  it.each([[12, "Viewers live now", "true"], [0, "No viewers live now", "false"]])(
    "keeps the broadcast icon before Live and distinguishes %s active viewers", (online, tooltip, active) => {
      render(<RealtimeKpiCardsV5 kpis={buildRealtimeKpis({ ...snapshot(), online })} />);
      const heading = screen.getByRole("heading", { name: "Live" });
      const indicator = within(heading).getByTitle(tooltip);
      expect(indicator).toHaveAttribute("data-active", active);
      expect(indicator).toHaveAttribute("aria-hidden", "true");
      expect(heading.firstChild).toBe(indicator);
      expect(indicator.nextSibling?.textContent).toBe("Live");
    },
  );

  it("does not indicate live activity when presence is unavailable", () => {
    const kpis = buildRealtimeKpis(snapshot());
    render(<RealtimeKpiCardsV5 kpis={{ ...kpis, live: { ...kpis.live, value: null } }} />);
    const heading = screen.getByRole("heading", { name: "Live" });
    expect(heading.querySelector("svg")).toBeNull();
  });
});

describe("realtime v5 audience peak", () => {
  it("shows the daily peak alongside the average in the existing Audience card, with its observed time and scope", () => {
    render(<RealtimeKpiCardsV5 kpis={buildRealtimeKpis(snapshot())} />);
    const card = within(screen.getByRole("article", { name: "Audience" }));
    expect(screen.getAllByRole("article")).toHaveLength(3);
    expect(card.getByText("75.5")).toBeInTheDocument();
    const peak = card.getByText("Peak").closest("p")!;
    expect(peak).toHaveTextContent("Peak120");
    expect(peak.getAttribute("title")).toContain("Today's highest observed concurrent audience: 120 viewers.");
    expect(peak.getAttribute("title")).toContain("11:30:00 AM");
    expect(peak.getAttribute("title")).toContain("America/Sao_Paulo");
    expect(peak).toHaveAccessibleDescription(peak.getAttribute("title")!);
    expect(within(screen.getByRole("article", { name: "Live" })).queryByText("Peak")).not.toBeInTheDocument();
  });

  it("updates the peak with the snapshot and distinguishes observed zero from no reading", () => {
    const first = snapshot();
    const { rerender } = render(<RealtimeKpiCardsV5 kpis={buildRealtimeKpis(first)} />);
    rerender(<RealtimeKpiCardsV5 kpis={buildRealtimeKpis({ ...first, audience: { ...first.audience, average: 0, peak: 0 } })} />);
    expect(screen.getByText("Peak").closest("p")).toHaveTextContent("Peak0");
    rerender(<RealtimeKpiCardsV5 kpis={buildRealtimeKpis({ ...first, audience: undefined })} />);
    const peak = screen.getByText("Peak").closest("p")!;
    expect(peak).toHaveTextContent("Peak—");
    expect(peak.getAttribute("title")).toContain("peak concurrent audience is unavailable");
  });

  it.each([[201, 224, "-10%"], [150, 100, "+50%"], [100, 100, "0%"], [0, 100, "-100%"], [201, 0, "—"]])(
    "renders the calculated comparison for %s today and %s yesterday", (today, previous, expected) => {
      const source = snapshot();
      render(<RealtimeKpiCardsV5 kpis={buildRealtimeKpis({ ...source, audience: {
        ...source.audience, peak: today,
        yesterday: { peak: previous, peakAt: null, from: "2026-11-16T03:00:00.000Z", to: "2026-11-17T03:00:00.000Z" },
      } })} />);
      const peak = screen.getByText("Peak").closest("p")!;
      expect(within(peak).getByText(expected)).toBeInTheDocument();
      expect(within(peak).getByText("yesterday")).toBeInTheDocument();
      expect(peak.getAttribute("title")).toContain(`Yesterday's full-day peak: ${previous} viewers.`);
      expect(peak.getAttribute("title")).toContain("Compares today so far with the whole previous calendar day");
    },
  );
});

describe("realtime v5 revenue comparison", () => {
  function sales(today: number, yesterday: number): NonNullable<WebinarRealtimeSnapshot["sales"]> {
    return {
      currency: "BRL", timezone: "America/Sao_Paulo",
      today: { from: "2026-11-17T03:00:00.000Z", to: "2026-11-17T15:00:00.000Z", revenueCents: today, count: 1, excludedCount: 0 },
      yesterday: { from: "2026-11-16T03:00:00.000Z", to: "2026-11-17T03:00:00.000Z", revenueCents: yesterday, count: 1, excludedCount: 0 },
      changePct: null,
    };
  }

  it.each([
    [150_000, 100_000, "R$1,500.00", "R$1,000.00", "+50%"],
    [50_000, 100_000, "R$500.00", "R$1,000.00", "-50%"],
    [100_000, 100_000, "R$1,000.00", "R$1,000.00", "0%"],
    [0, 100_000, "R$0.00", "R$1,000.00", "-100%"],
    [100_000, 0, "R$1,000.00", "R$0.00", "—"],
  ])("shows actual yesterday revenue and the computed change for %s versus %s cents", (today, previous, currentAmount, previousAmount, change) => {
    render(<RealtimeKpiCardsV5 kpis={buildRealtimeKpis({ ...snapshot(), sales: sales(today, previous) })} />);
    const card = within(screen.getByRole("article", { name: "Revenue" }));
    expect(card.getAllByText(currentAmount).length).toBeGreaterThan(0);
    const comparison = card.getByText("Yesterday").closest("p")!;
    expect(within(comparison).getByText(previousAmount)).toBeInTheDocument();
    expect(within(comparison).getByText(change)).toBeInTheDocument();
    expect(comparison.getAttribute("title")).toContain("Compares today so far with the whole previous calendar day in America/Sao_Paulo");
    expect(comparison.getAttribute("title")).toContain("gross BRL including order add-ons, before refunds");
    expect(comparison).toHaveAccessibleDescription(comparison.getAttribute("title")!);
  });

  it("updates from snapshots and distinguishes unavailable revenue from a real zero", () => {
    const first = { ...snapshot(), sales: sales(150_000, 100_000) };
    const { rerender } = render(<RealtimeKpiCardsV5 kpis={buildRealtimeKpis(first)} />);
    rerender(<RealtimeKpiCardsV5 kpis={buildRealtimeKpis({ ...first, sales: sales(50_000, 100_000) })} />);
    expect(within(screen.getByRole("article", { name: "Revenue" })).getByText("-50%")).toBeInTheDocument();
    rerender(<RealtimeKpiCardsV5 kpis={buildRealtimeKpis({ ...first, sales: undefined })} />);
    const comparison = within(screen.getByRole("article", { name: "Revenue" })).getByText("Yesterday").closest("p")!;
    expect(within(comparison).getAllByText("—")).toHaveLength(2);
    expect(comparison.getAttribute("title")).toContain("Yesterday's recorded revenue is unavailable");
  });
});
