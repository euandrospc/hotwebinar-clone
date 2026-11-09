import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AudienceHistoryTooltip, DashboardRealtimePreview } from "@/components/dashboard/dashboard-realtime-preview";
import type { RealtimeAudienceHistory } from "@/lib/dashboard-realtime-preview";
import type { TooltipProps } from "@/components/tremor/area-chart";

const fetchMock = vi.fn();
const response = (body: unknown, ok = true) => ({ ok, json: async () => body });
const snapshot = { online: 30, byWebinar: [{ webinarId: "one", online: 12 }, { webinarId: "two", online: 18 }] };
const history: RealtimeAudienceHistory = {
  average: 12, peak: 16, sampleCount: 3, windowMinutes: 60,
  points: [8, 16, 12].map((online, index) => ({ at: new Date(Date.UTC(2026, 0, 1, 12, 0, index * 15)).toISOString(), online }))
};
const metric = (name: "Média" | "Pico") => within(screen.getByText(name).parentElement!);
const counterLink = () => screen.getByRole("link", { name: /^Abrir tempo real:/ });
const settle = async () => { await act(async () => { await Promise.resolve(); }); };

beforeEach(() => {
  vi.useFakeTimers();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("dashboard realtime preview", () => {
  it("renders demonstration counts immediately without fetching and supports an explicit destination", () => {
    const demoHistory: RealtimeAudienceHistory = {
      average: 171.5, peak: 196, sampleCount: 2, windowMinutes: 60,
      points: [{ at: "2026-01-01T11:58:00Z", online: 147 }, { at: "2026-01-01T12:00:00Z", online: 196 }]
    };
    const { rerender } = render(<DashboardRealtimePreview demoOnline={196} demoHistory={demoHistory} href="/preview/live" />);
    expect(screen.getByRole("link", { name: "Abrir tempo real: 196 pessoas assistindo agora" })).toHaveAttribute("href", "/preview/live");
    expect(metric("Média").getByText("171,5")).toBeInTheDocument();
    expect(metric("Pico").getByText("196")).toBeInTheDocument();
    expect(counterLink()).toHaveAttribute("title", expect.stringContaining("média 171,5; pico 196"));
    expect(fetchMock).not.toHaveBeenCalled();
    rerender(<DashboardRealtimePreview demoOnline={0} />);
    expect(screen.getByRole("link", { name: "Abrir tempo real: 0 pessoas assistindo agora" })).toHaveAttribute("href", "/dashboard/online");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows loading, then scopes a valid response and accepts a genuine zero", async () => {
    fetchMock.mockResolvedValue(response({ ...snapshot, audience: history }));
    const { rerender } = render(<DashboardRealtimePreview webinarId="one" />);
    expect(screen.getByText("Conectando")).toBeInTheDocument();
    expect(screen.queryByText("0")).not.toBeInTheDocument();
    await settle();
    expect(screen.getByRole("link", { name: "Abrir tempo real: 12 pessoas assistindo agora" })).toHaveAttribute("href", "/dashboard/webinars/one/realtime");
    expect(fetchMock).toHaveBeenCalledWith("/api/dashboard/online?webinarId=one", expect.objectContaining({ cache: "no-store", signal: expect.any(AbortSignal) }));
    expect(metric("Média").getByText("12")).toBeInTheDocument();
    expect(metric("Pico").getByText("16")).toBeInTheDocument();
    fetchMock.mockResolvedValue(response({ ...snapshot, audience: { average: null, peak: null, sampleCount: 0, points: [], windowMinutes: 60 } }));
    rerender(<DashboardRealtimePreview webinarId="absent" />);
    expect(screen.getByText("Conectando")).toBeInTheDocument();
    await settle();
    expect(screen.getByRole("link", { name: "Abrir tempo real: 0 pessoas assistindo agora" })).toBeInTheDocument();
    expect(metric("Média").getByText("—")).toBeInTheDocument();
    expect(metric("Pico").getByText("—")).toBeInTheDocument();
    expect(counterLink()).toHaveAttribute("title", expect.stringContaining("Sem histórico"));
  });

  it("keeps unavailable and malformed responses from becoming a false zero", async () => {
    fetchMock.mockRejectedValueOnce(new Error("Offline")).mockResolvedValueOnce(response({ online: 0, byWebinar: null }));
    render(<DashboardRealtimePreview />);
    await settle();
    expect(screen.getByText("Sem conexão")).toBeInTheDocument();
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
    expect(screen.queryByText("0")).not.toBeInTheDocument();
    await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
    expect(screen.getByText("Sem conexão")).toBeInTheDocument();
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("polls, preserves the last count and history during failure and recovers on the next refresh", async () => {
    fetchMock.mockResolvedValueOnce(response({ ...snapshot, audience: history }))
      .mockRejectedValueOnce(new TypeError("Network request failed"))
      .mockResolvedValueOnce(response({ online: 8, byWebinar: [] }));
    render(<DashboardRealtimePreview />);
    await settle();
    expect(screen.getByText("30")).toBeInTheDocument();
    expect(metric("Média").getByText("12")).toBeInTheDocument();
    expect(metric("Pico").getByText("16")).toBeInTheDocument();
    await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
    expect(screen.getByText("30")).toBeInTheDocument();
    expect(screen.getByText("Sem conexão")).toBeInTheDocument();
    expect(metric("Média").getByText("12")).toBeInTheDocument();
    expect(metric("Pico").getByText("16")).toBeInTheDocument();
    expect(counterLink()).toHaveAttribute("title", expect.stringContaining("desatualizada"));
    await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
    expect(screen.getByRole("link", { name: "Abrir tempo real: 8 pessoas assistindo agora" })).toBeInTheDocument();
    expect(screen.queryByText("Sem conexão")).not.toBeInTheDocument();
    expect(metric("Média").getByText("—")).toBeInTheDocument();
    expect(metric("Pico").getByText("—")).toBeInTheDocument();
  });

  it("aborts outstanding requests on unmount and prevents later polling", async () => {
    let complete!: (value: unknown) => void;
    fetchMock.mockImplementation(() => new Promise((resolve) => { complete = resolve; }));
    const { unmount } = render(<DashboardRealtimePreview webinarId="one" />);
    const signal = fetchMock.mock.calls[0][1].signal as AbortSignal;
    expect(signal.aborted).toBe(false);
    unmount();
    expect(signal.aborted).toBe(true);
    await act(async () => { complete(response(snapshot)); });
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("cancels live polling when switching to demonstration and restarts when leaving it", async () => {
    fetchMock.mockResolvedValue(response(snapshot));
    const { rerender } = render(<DashboardRealtimePreview />);
    await settle();
    const signal = fetchMock.mock.calls[0][1].signal as AbortSignal;
    rerender(<DashboardRealtimePreview demoOnline={196} />);
    expect(signal.aborted).toBe(true);
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByText("196")).toBeInTheDocument();
    rerender(<DashboardRealtimePreview />);
    expect(screen.getByText("Conectando")).toBeInTheDocument();
    await settle();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(screen.getByText("30")).toBeInTheDocument();
  });

  it("keeps chart inspection separate from the two navigation links", () => {
    const { container } = render(<DashboardRealtimePreview demoOnline={12} demoHistory={history} href="/preview/live" />);
    const chart = container.querySelector('[tremor-id="tremor-raw"]');
    expect(chart).not.toBeNull();
    expect(chart!.closest("a")).toBeNull();
    expect(counterLink()).toHaveAttribute("href", "/preview/live");
    expect(screen.getByRole("link", { name: "Ver painel de tempo real" })).toHaveAttribute("href", "/preview/live");
    const navigate = vi.fn((event: Event) => event.preventDefault());
    for (const link of screen.getAllByRole("link")) link.addEventListener("click", navigate);
    fireEvent.click(chart!);
    expect(navigate).not.toHaveBeenCalled();
  });
});

function tooltipProps(value: number | null, observedAt: string | null): TooltipProps {
  return {
    active: true, label: String(Date.parse("2026-11-05T12:00:00Z")),
    payload: [{
      category: "audience", value: value as number, index: String(Date.parse("2026-11-05T12:00:00Z")), color: "forest",
      payload: { audience: value, observedAt }
    }]
  };
}

describe("audience history tooltip", () => {
  it("shows the recorded time in Brasília, not the rounded chart slot, and preserves the observed count", () => {
    render(<AudienceHistoryTooltip {...tooltipProps(196, "2026-11-05T12:00:07Z")} />);
    expect(screen.getByText(/09:00:07/)).toBeInTheDocument();
    expect(screen.queryByText(/09:00:00/)).not.toBeInTheDocument();
    expect(screen.getByText("196")).toBeInTheDocument();
  });

  it("shows a genuine zero observation", () => {
    render(<AudienceHistoryTooltip {...tooltipProps(0, "2026-11-05T12:15:22Z")} />);
    expect(screen.getByText(/09:15:22/)).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("does not invent a metric for absent observations or an inactive tooltip", () => {
    const { container, rerender } = render(<AudienceHistoryTooltip active={true} payload={[]} label="missing" />);
    expect(container).toBeEmptyDOMElement();
    rerender(<AudienceHistoryTooltip {...tooltipProps(null, "2026-11-05T12:00:07Z")} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<AudienceHistoryTooltip {...tooltipProps(196, null)} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<AudienceHistoryTooltip {...tooltipProps(196, "2026-11-05T12:00:07Z")} active={false} />);
    expect(container).toBeEmptyDOMElement();
  });
});
