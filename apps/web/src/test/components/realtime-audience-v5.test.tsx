import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Chart, Options, PointOptionsObject, SeriesAreaOptions } from "highcharts/highmaps";
import { RealtimeAudienceV5 } from "@/components/webinar/realtime-audience-v5";
import type { RealtimeAccessTimeV5Data } from "@/lib/realtime-access-time-v5";

const highcharts = vi.hoisted(() => {
  let options: Options | undefined;
  type PlottedPoint = { x: number; y: number | null; plotX: number; plotY?: number };
  const setData = vi.fn((values: PointOptionsObject[], _redraw?: boolean, _animation?: boolean, _updatePoints?: boolean) => {
    chart.series[0].points = values.map((point, index) => ({
      x: Number(point.x), y: point.y ?? null,
      plotX: index * 40, plotY: point.y === null ? undefined : 200 - (point.y ?? 0),
    }));
  });
  function renderChart() {
    options?.chart?.events?.render?.call(chart as unknown as Chart, new Event("render"));
  }
  const chart = {
    plotLeft: 32, plotTop: 8, plotWidth: 400, plotHeight: 200,
    series: [{ setData, points: [] as PlottedPoint[] }],
    update: vi.fn(), redraw: vi.fn(renderChart), destroy: vi.fn(), reflow: vi.fn(renderChart),
  };
  return {
    chart,
    create: vi.fn((_container: HTMLElement, nextOptions: Options) => {
      options = nextOptions;
      setData((options.series![0] as SeriesAreaOptions).data as PointOptionsObject[]);
      renderChart();
      return chart;
    }),
    // These tests inspect series integrity and lifecycle, not theme merging.
    merge: (options: Options) => options,
    observe: vi.fn(), disconnect: vi.fn(),
    resize: undefined as (() => void) | undefined,
  };
});
const motionState = vi.hoisted(() => ({ enabled: true }));

vi.mock("highcharts/highmaps", () => ({ default: { chart: highcharts.create, merge: highcharts.merge } }));
vi.mock("highcharts/modules/accessibility", () => ({}));
vi.mock("next-themes", () => ({ useTheme: () => ({ resolvedTheme: "light" }) }));
vi.mock("@/components/webinar/realtime-motion-v5", () => ({ useRealtimeMotionV5: () => motionState.enabled }));

const firstAt = "2026-11-17T17:59:30.125Z";
const lastAt = "2026-11-17T18:00:00.250Z";
const points: RealtimeAccessTimeV5Data["points"] = [
  { x: Date.parse(firstAt), at: firstAt, value: 12 },
  { x: Date.parse("2026-11-17T17:59:45.000Z"), at: null, value: null },
  { x: Date.parse(lastAt), at: lastAt, value: 0 },
];
const data: RealtimeAccessTimeV5Data = {
  points,
  range: { from: Date.parse("2026-11-17T17:30:00.000Z"), to: Date.parse("2026-11-17T19:00:00.000Z") },
  sessionStart: Date.parse("2026-11-17T17:30:00.000Z"),
  context: "Session",
  phase: "live",
};
const props = {
  data,
  timezone: "America/Sao_Paulo", updatedAt: "2026-11-17T18:00:15.000Z", available: true,
};
const seriesData = () => (highcharts.create.mock.calls[0][1].series![0] as SeriesAreaOptions).data as PointOptionsObject[];

beforeEach(() => {
  vi.clearAllMocks();
  motionState.enabled = true;
  highcharts.chart.plotLeft = 32;
  highcharts.chart.plotTop = 8;
  highcharts.resize = undefined;
  vi.stubGlobal("ResizeObserver", class {
    constructor(callback: () => void) { highcharts.resize = callback; }
    observe = highcharts.observe;
    disconnect = highcharts.disconnect;
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("realtime accesses over the session timeline", () => {
  it("preserves exact observation timestamps, missing readings and observed zero", async () => {
    render(<RealtimeAudienceV5 {...props} />);
    await waitFor(() => expect(highcharts.create).toHaveBeenCalledTimes(1));
    expect(seriesData().map(point => [point.x, point.y])).toEqual(points.map(point => [point.x, point.value]));
    expect(highcharts.create.mock.calls[0][1].plotOptions?.series?.connectNulls).toBe(false);
    expect(highcharts.create.mock.calls[0][1].time).toMatchObject({ timezone: props.timezone });
    expect(highcharts.create.mock.calls[0][1].xAxis).toMatchObject({ min: data.range!.from, max: data.range!.to });
    expect(seriesData().at(-1)?.x).toBeLessThan(data.range!.to);
    expect(seriesData()[2].custom?.elapsedLabel).toBe("00:30:00");
    expect(highcharts.create.mock.calls[0][1].tooltip?.pointFormat).toContain("into session");
    expect(screen.getByRole("heading", { name: "Accesses × time" })).toBeInTheDocument();
    // Isolated readings remain visible, including zero after a collection gap.
    expect(seriesData().map(point => point.marker?.enabled)).toEqual([true, false, true]);
    expect(document.querySelector("time")).toHaveAttribute("dateTime", lastAt);
    expect(document.querySelector("time")).toHaveTextContent("15:00:00");
  });

  it("updates the existing chart when a new snapshot arrives and releases it on unmount", async () => {
    const { rerender, unmount } = render(<RealtimeAudienceV5 {...props} />);
    await waitFor(() => expect(highcharts.create).toHaveBeenCalledTimes(1));
    const nextAt = "2026-11-17T18:00:15.900Z";
    const nextPoints = [...points, { x: Date.parse(nextAt), at: nextAt, value: 7 }];
    rerender(<RealtimeAudienceV5 {...props} data={{ ...data, points: nextPoints }} updatedAt={nextAt} />);
    expect(highcharts.create).toHaveBeenCalledTimes(1);
    const updated = highcharts.chart.series[0].setData.mock.lastCall![0] as PointOptionsObject[];
    expect(updated.map(point => [point.x, point.y])).toEqual(nextPoints.map(point => [point.x, point.value]));
    expect(updated.at(-1)?.marker?.enabled).toBe(true);
    expect(updated[2].marker?.enabled).toBe(false);
    // A former endpoint must become visually hidden even if accessibility keeps
    // its SVG marker alive, while isolated readings and the new endpoint remain.
    expect(updated.map(point => point.className)).toEqual([
      "realtime-audience-marker-visible", "realtime-audience-marker-hidden",
      "realtime-audience-marker-hidden", "realtime-audience-marker-visible",
    ]);
    expect(highcharts.chart.destroy).not.toHaveBeenCalled();
    expect(highcharts.observe).toHaveBeenCalledTimes(1);
    expect(document.querySelector("[data-live-endpoint]")).toHaveStyle({ left: "152px", top: "201px" });
    unmount();
    expect(highcharts.chart.destroy).toHaveBeenCalledTimes(1);
    expect(highcharts.disconnect).toHaveBeenCalledTimes(1);
  });

  it("pulses at the actual last observation, including zero, and follows chart resizing", async () => {
    render(<RealtimeAudienceV5 {...props} />);
    await waitFor(() => expect(document.querySelector("[data-live-endpoint]")).toHaveAttribute("data-pulsing", "true"));
    const endpoint = document.querySelector("[data-live-endpoint]");
    expect(endpoint).toHaveStyle({ left: "112px", top: "208px" });
    expect(endpoint).toHaveAttribute("aria-hidden", "true");
    expect(seriesData().map(point => [point.x, point.y])).toEqual(points.map(point => [point.x, point.value]));

    highcharts.chart.plotLeft = 52;
    highcharts.chart.plotTop = 18;
    act(() => highcharts.resize?.());
    expect(highcharts.chart.reflow).toHaveBeenCalledTimes(1);
    expect(endpoint).toHaveStyle({ left: "132px", top: "218px" });
    expect(highcharts.create).toHaveBeenCalledTimes(1);
  });

  it("stops the pulse for old, stale, inactive, hidden or reduced-motion readings", async () => {
    const { rerender } = render(<RealtimeAudienceV5 {...props} />);
    const endpoint = () => document.querySelector("[data-live-endpoint]");
    await waitFor(() => expect(endpoint()).toHaveAttribute("data-pulsing", "true"));

    rerender(<RealtimeAudienceV5 {...props} stale />);
    expect(endpoint()).not.toHaveAttribute("data-pulsing");
    rerender(<RealtimeAudienceV5 {...props} updatedAt="2026-11-17T18:00:45.251Z" />);
    expect(endpoint()).not.toHaveAttribute("data-pulsing");
    for (const phase of ["ended", "upcoming", "unavailable"] as const) {
      rerender(<RealtimeAudienceV5 {...props} data={{ ...data, phase }} />);
      expect(endpoint()).not.toHaveAttribute("data-pulsing");
    }
    // The shared hook controls both page visibility and reduced-motion changes.
    motionState.enabled = false;
    rerender(<RealtimeAudienceV5 {...props} />);
    expect(endpoint()).not.toHaveAttribute("data-pulsing");
    motionState.enabled = true;
    rerender(<RealtimeAudienceV5 {...props} />);
    expect(endpoint()).toHaveAttribute("data-pulsing", "true");
    rerender(<RealtimeAudienceV5 {...props} available={false} />);
    expect(endpoint()).not.toBeInTheDocument();
  });

  it("distinguishes missing history from zero and clears the chart when access is revoked", async () => {
    const individual: RealtimeAccessTimeV5Data = { points: [], range: null, sessionStart: null, context: "Today", phase: "individual" };
    const { rerender } = render(<RealtimeAudienceV5 {...props} data={individual} />);
    expect(screen.getByText("No audience readings yet")).toBeInTheDocument();
    expect(highcharts.create).not.toHaveBeenCalled();
    rerender(<RealtimeAudienceV5 {...props} data={{ ...individual, points: [points[2]] }} />);
    await waitFor(() => expect(highcharts.create).toHaveBeenCalledTimes(1));
    expect(seriesData().map(point => point.y)).toEqual([0]);
    expect(document.querySelector("[data-live-endpoint]")).toHaveAttribute("data-pulsing", "true");
    expect(screen.queryByText("No audience readings yet")).not.toBeInTheDocument();
    rerender(<RealtimeAudienceV5 {...props} available={false} />);
    expect(screen.getByText("Audience unavailable")).toBeInTheDocument();
    expect(document.querySelector("time")).not.toBeInTheDocument();
    expect(highcharts.chart.destroy).toHaveBeenCalledTimes(1);
    expect(highcharts.disconnect).toHaveBeenCalledTimes(1);
  });

  it("shows the upcoming session grid without inventing a zero observation and updates its bounds", async () => {
    const upcoming: RealtimeAccessTimeV5Data = { ...data, points: [], phase: "upcoming" };
    const { rerender } = render(<RealtimeAudienceV5 {...props} data={upcoming} />);
    await waitFor(() => expect(highcharts.create).toHaveBeenCalledTimes(1));
    expect(seriesData()).toEqual([]);
    expect(highcharts.create.mock.calls[0][1].xAxis).toMatchObject({ min: data.range!.from, max: data.range!.to });
    expect(highcharts.create.mock.calls[0][1].yAxis).toMatchObject({ min: 0, max: 4 });
    expect(screen.getByText("Waiting for session to start")).toBeInTheDocument();
    expect(document.querySelector("time")).not.toBeInTheDocument();

    const tomorrow = {
      ...upcoming,
      range: { from: data.range!.from + 86_400_000, to: data.range!.to + 86_400_000 },
      sessionStart: data.sessionStart! + 86_400_000,
    };
    rerender(<RealtimeAudienceV5 {...props} data={tomorrow} />);
    expect(highcharts.create).toHaveBeenCalledTimes(1);
    expect(highcharts.chart.update).toHaveBeenCalledWith(expect.objectContaining({
      xAxis: { min: tomorrow.range.from, max: tomorrow.range.to },
    }), false);
    expect(highcharts.chart.series[0].setData.mock.lastCall![0]).toEqual([]);

    rerender(<RealtimeAudienceV5 {...props} data={{ ...tomorrow, phase: "live" }} />);
    expect(screen.getByText("No readings for this session")).toBeInTheDocument();
    expect(highcharts.chart.destroy).not.toHaveBeenCalled();
  });

  it("removes elapsed playback and fixed session bounds for individual sessions", async () => {
    const { rerender } = render(<RealtimeAudienceV5 {...props} />);
    await waitFor(() => expect(highcharts.create).toHaveBeenCalledTimes(1));
    rerender(<RealtimeAudienceV5 {...props} data={{ ...data, range: null, sessionStart: null, context: "Today", phase: "individual" }} />);
    expect(highcharts.create).toHaveBeenCalledTimes(1);
    expect(highcharts.chart.update).toHaveBeenCalledWith(expect.objectContaining({
      xAxis: { min: null, max: null },
      tooltip: { pointFormat: "{point.custom.timeLabel}<br/><b>{point.custom.countLabel}</b> concurrent viewers" },
    }), false);
    const updated = highcharts.chart.series[0].setData.mock.lastCall![0] as PointOptionsObject[];
    expect(updated.every(point => point.custom?.elapsedLabel === "")).toBe(true);
    expect(screen.getByText("Today")).toBeInTheDocument();
  });

  it("does not create a late chart after unmounting during its asynchronous import", async () => {
    const { unmount } = render(<RealtimeAudienceV5 {...props} />);
    unmount();
    await act(async () => { await Promise.resolve(); });
    expect(highcharts.create).not.toHaveBeenCalled();
    expect(highcharts.observe).not.toHaveBeenCalled();
  });
});
