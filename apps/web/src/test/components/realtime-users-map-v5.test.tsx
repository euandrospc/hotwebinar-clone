import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Options, SeriesMapOptions } from "highcharts/highmaps";
import { RealtimeUsersMapV5 } from "@/components/webinar/realtime-users-map-v5";
import { buildRealtimeMapV5 } from "@/lib/realtime-map-v5";
import { buildRealtimeKpisV5DemoSnapshot } from "@/lib/realtime-kpis-v5-demo";

const mock = vi.hoisted(() => {
  const basemap = { setData: vi.fn(), setVisible: vi.fn() };
  const states = { setData: vi.fn() };
  const chart = {
    get: vi.fn((id: string) => id === "live-users-by-state" ? states : basemap),
    series: [basemap, states],
    mapView: { center: [-52, -14], zoom: 4.5, setView: vi.fn(), zoomBy: vi.fn() },
    update: vi.fn(), redraw: vi.fn(), destroy: vi.fn(), reflow: vi.fn(),
  };
  return {
    basemap, states, chart, theme: "light",
    create: vi.fn((_container: HTMLElement, _options: Options) => chart),
    merge: (options: Options) => options,
    observe: vi.fn(), disconnect: vi.fn(),
  };
});
vi.mock("highcharts/highmaps", () => ({ default: { mapChart: mock.create, merge: mock.merge } }));
vi.mock("highcharts/modules/tiledwebmap", () => ({}));
vi.mock("highcharts/modules/accessibility", () => ({}));
vi.mock("next-themes", () => ({ useTheme: () => ({ resolvedTheme: mock.theme }) }));

const data = buildRealtimeMapV5(buildRealtimeKpisV5DemoSnapshot());
beforeEach(() => {
  vi.clearAllMocks();
  mock.theme = "light";
  vi.stubGlobal("ResizeObserver", class {
    observe = mock.observe;
    disconnect = mock.disconnect;
  });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("realtime geographic Brazil map", () => {
  it("renders geographic tiles below the same 27 state counts with visible attribution", async () => {
    render(<RealtimeUsersMapV5 data={data} />);
    await waitFor(() => expect(mock.create).toHaveBeenCalledTimes(1));
    const options = mock.create.mock.calls[0][1];
    expect(options.series?.[0]).toMatchObject({ type: "tiledwebmap", id: "geographic-basemap", provider: { type: "OpenStreetMap", theme: "Standard" }, zIndex: 0 });
    const states = options.series?.[1] as SeriesMapOptions;
    expect(states).toMatchObject({ type: "map", id: "live-users-by-state", joinBy: "hc-key", zIndex: 1 });
    expect(states.data).toHaveLength(27);
    expect(options.mapView).toMatchObject({ projection: { name: "WebMercator" }, fitToGeometry: { type: "MultiPoint" } });
    expect(screen.getByRole("link", { name: "© OpenStreetMap contributors" })).toHaveAttribute("href", "https://www.openstreetmap.org/copyright");
    expect(screen.getByRole("link", { name: "Natural Earth" })).toBeInTheDocument();
    expect(screen.getByText("160 in Brazil")).toBeInTheDocument();
    expect(options.credits).toMatchObject({ enabled: true, text: "Highcharts.com" });
  });

  it("updates the state overlay by ID without replacing tiles or changing the user's viewport", async () => {
    const { rerender, unmount } = render(<RealtimeUsersMapV5 data={data} />);
    await waitFor(() => expect(mock.create).toHaveBeenCalledTimes(1));
    const next = { ...data, states: data.states.map(state => ({ ...state, value: (state.value ?? 0) + 1 })) };
    rerender(<RealtimeUsersMapV5 data={next} />);
    expect(mock.chart.get).toHaveBeenCalledWith("live-users-by-state");
    expect(mock.states.setData).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ value: 47, "hc-key": "br-sp" })]), false, false, true);
    expect(mock.basemap.setData).not.toHaveBeenCalled();
    expect(mock.create).toHaveBeenCalledTimes(1);
    expect(mock.chart.mapView.setView).toHaveBeenCalledWith([-52, -14], 4.5, false, false);
    fireEvent.click(screen.getByRole("button", { name: "Fit Brazil in the map" }));
    expect(mock.chart.mapView.zoomBy).toHaveBeenCalledWith(undefined, undefined, undefined, false);
    unmount();
    expect(mock.chart.destroy).toHaveBeenCalledTimes(1);
    expect(mock.disconnect).toHaveBeenCalledTimes(1);
  });

  it("keeps natural tiles when switching theme and removes the map when access is unavailable", async () => {
    const { rerender } = render(<RealtimeUsersMapV5 data={data} />);
    await waitFor(() => expect(mock.create).toHaveBeenCalledTimes(1));
    mock.theme = "dark";
    rerender(<RealtimeUsersMapV5 data={data} />);
    expect(mock.chart.update).toHaveBeenCalledWith(expect.objectContaining({ colorAxis: expect.objectContaining({ minColor: "rgba(83,91,255,0.015)", maxColor: "rgba(83,91,255,0.42)" }) }), false);
    expect(mock.basemap.setVisible).not.toHaveBeenCalled();
    expect(mock.create).toHaveBeenCalledTimes(1);
    rerender(<RealtimeUsersMapV5 data={buildRealtimeMapV5(null)} />);
    expect(screen.getByText("Live user locations unavailable")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Fit Brazil in the map" })).not.toBeInTheDocument();
    expect(mock.chart.destroy).toHaveBeenCalledTimes(1);
  });

  it("preserves local state metrics and reports a failed geographic background", async () => {
    render(<RealtimeUsersMapV5 data={data} />);
    await waitFor(() => expect(mock.create).toHaveBeenCalledTimes(1));
    const container = mock.create.mock.calls[0][0];
    const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
    group.classList.add("highcharts-tiledwebmap-series");
    const tile = document.createElementNS("http://www.w3.org/2000/svg", "image");
    group.append(tile);
    container.append(group);
    fireEvent.error(tile);
    expect(await screen.findByText("Geographic background unavailable · State view")).toBeInTheDocument();
    expect(mock.basemap.setVisible).toHaveBeenCalledWith(false, false);
    expect(screen.getByText("160 in Brazil")).toBeInTheDocument();
    expect(mock.create).toHaveBeenCalledTimes(1);
    expect(mock.chart.update).toHaveBeenCalledWith(expect.objectContaining({ colorAxis: expect.objectContaining({ maxColor: "#535bff" }) }), false);
  });
});
