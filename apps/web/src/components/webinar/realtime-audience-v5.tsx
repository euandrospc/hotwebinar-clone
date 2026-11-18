"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useTheme } from "next-themes";
import type * as Highcharts from "highcharts/highmaps";
import type { RealtimeAccessTimeV5Data } from "@/lib/realtime-access-time-v5";
import { useRealtimeMotionV5 } from "./realtime-motion-v5";
import styles from "./realtime-audience-v5.module.css";

type Props = {
  data: RealtimeAccessTimeV5Data;
  timezone: string;
  updatedAt: string;
  available: boolean;
  stale?: boolean;
};

const countFormatter = new Intl.NumberFormat("en-US");
const FRESH_READING_MS = 45_000;
type EndpointPosition = { x: number; y: number; baseline: number; at: number };

function elapsedTime(milliseconds: number): string {
  const seconds = Math.max(0, Math.floor(milliseconds / 1_000));
  return [Math.floor(seconds / 3_600), Math.floor(seconds % 3_600 / 60), seconds % 60]
    .map(value => String(value).padStart(2, "0")).join(":");
}

function audiencePoints(data: RealtimeAccessTimeV5Data, timezone: string): Highcharts.PointOptionsObject[] {
  const dateFormatter = new Intl.DateTimeFormat("en-US", {
    month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit",
    second: "2-digit", hourCycle: "h23", timeZone: timezone, timeZoneName: "short",
  });
  const lastReading = data.points.findLastIndex(point => point.value !== null);
  return data.points.map((point, index) => {
    const visibleMarker = point.value !== null && (index === lastReading
      || data.points[index - 1]?.value == null && data.points[index + 1]?.value == null);
    return {
      x: point.x,
      y: point.value,
      className: visibleMarker ? "realtime-audience-marker-visible" : "realtime-audience-marker-hidden",
      marker: { enabled: visibleMarker },
      custom: {
        timeLabel: dateFormatter.format(point.x),
        countLabel: point.value === null ? "Unavailable" : countFormatter.format(point.value),
        elapsedLabel: data.sessionStart === null ? "" : elapsedTime(point.x - data.sessionStart),
      },
    };
  });
}

function chartDescription(data: RealtimeAccessTimeV5Data, timezone: string) {
  return `Observed concurrent viewers ${data.context === "Session" ? "during this session" : "today"} in ${timezone}. `
    + "Gaps indicate missing readings, not zero viewers. Future times have no readings. "
    + (data.sessionStart === null ? "" : "Elapsed time is measured from the session start, not individual watch time. ")
    + "Use the arrow keys to explore readings.";
}

function dataOptions(data: RealtimeAccessTimeV5Data, timezone: string): Highcharts.Options {
  const hasReadings = data.points.some(point => point.value !== null);
  return {
    time: { timezone },
    xAxis: { min: data.range?.from ?? null, max: data.range?.to ?? null },
    yAxis: { max: hasReadings ? null : 4 },
    tooltip: {
      pointFormat: "{point.custom.timeLabel}<br/><b>{point.custom.countLabel}</b> concurrent viewers"
        + (data.sessionStart === null ? "" : "<br/>{point.custom.elapsedLabel} into session"),
    },
    accessibility: {
      description: chartDescription(data, timezone),
      point: { valueDescriptionFormat: "{point.custom.timeLabel}, {point.custom.countLabel} concurrent viewers."
        + (data.sessionStart === null ? "" : " {point.custom.elapsedLabel} into session.") },
    },
  };
}

function themeOptions(dark: boolean): Highcharts.Options {
  const text = dark ? "#d6d9e1" : "#373e4c";
  const muted = dark ? "#989eab" : "#757b87";
  const border = dark ? "#2b2d34" : "#e3e5eb";
  return {
    xAxis: { lineColor: border, tickColor: border, labels: { style: { color: muted, fontSize: "11px" } } },
    yAxis: { gridLineColor: border, labels: { style: { color: muted, fontSize: "11px" } } },
    tooltip: {
      backgroundColor: dark ? "#202126" : "#ffffff",
      borderColor: dark ? "#373a44" : "#e3e5eb",
      style: { color: text, fontSize: "11px" },
    },
    credits: { enabled: false },
  };
}

function chartOptions(data: RealtimeAccessTimeV5Data, timezone: string): Highcharts.Options {
  const scoped = dataOptions(data, timezone);
  return {
    chart: {
      type: "area", animation: false, backgroundColor: "transparent",
      spacing: [8, 6, 22, 0], style: { fontFamily: "inherit" }, reflow: false,
    },
    time: { timezone },
    title: { text: undefined },
    legend: { enabled: false },
    xAxis: {
      type: "datetime", tickPixelInterval: 110, tickLength: 4,
      minPadding: 0, maxPadding: 0, minRange: 0, startOnTick: false, endOnTick: false,
      ...scoped.xAxis,
      dateTimeLabelFormats: { millisecond: "%H:%M:%S", second: "%H:%M:%S", minute: "%H:%M", hour: "%H:%M", day: "%H:%M" },
      crosshair: { color: "#858bff", width: 1, dashStyle: "ShortDot" },
    },
    yAxis: {
      title: { text: undefined }, min: 0, minRange: 1, allowDecimals: false,
      ...scoped.yAxis,
      tickPixelInterval: 48, gridLineWidth: 1,
      labels: { formatter() { return countFormatter.format(Number(this.value)); } },
    },
    tooltip: {
      headerFormat: "",
      ...scoped.tooltip,
      borderRadius: 8, shadow: false, outside: true,
    },
    accessibility: {
      enabled: true,
      ...scoped.accessibility,
      keyboardNavigation: { enabled: true },
      series: { pointDescriptionEnabledThreshold: false },
    },
    plotOptions: {
      series: { animation: false, connectNulls: false, turboThreshold: 0 },
      area: {
        lineWidth: 2, threshold: 0,
        marker: { enabled: false, radius: 3, symbol: "circle", states: { hover: { enabled: true, radius: 4 } } },
        fillColor: {
          linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 },
          stops: [[0, "rgba(83,91,255,0.26)"], [1, "rgba(83,91,255,0)"]],
        },
        states: { hover: { lineWidthPlus: 0 }, inactive: { opacity: 1 } },
      },
    },
    series: [{ type: "area", id: "concurrent-audience", name: "Concurrent viewers", color: "#535bff", data: audiencePoints(data, timezone) }],
    credits: { enabled: false },
  };
}

/** Session access curve; refreshes arrive through the existing dashboard snapshot. */
export function RealtimeAudienceV5({ data, timezone, updatedAt, available, stale = false }: Props) {
  const id = useId();
  const motionEnabled = useRealtimeMotionV5();
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === "dark";
  const hasReadings = available && data.points.some(point => point.value !== null);
  const canRenderChart = available && (hasReadings || data.range !== null);
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<Highcharts.Chart | null>(null);
  const latestRef = useRef({ data, timezone, dark });
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [endpoint, setEndpoint] = useState<EndpointPosition | null>(null);
  latestRef.current = { data, timezone, dark };
  const timeFormatter = useMemo(() => new Intl.DateTimeFormat("en-US", {
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23", timeZone: timezone, timeZoneName: "short",
  }), [timezone]);
  const lastReading = data.points.findLast(point => point.value !== null);
  const readingAge = lastReading ? Date.parse(updatedAt) - lastReading.x : Number.NaN;
  const liveReading = available && !stale && Number.isFinite(readingAge) && readingAge >= 0 && readingAge <= FRESH_READING_MS
    && (data.phase === "live" || data.context === "Today" && data.phase === "individual");
  const showEndpoint = status === "ready" && hasReadings && endpoint !== null && endpoint.at === lastReading?.x;
  const pulseActive = showEndpoint && liveReading && motionEnabled;
  const emptyLabel = data.phase === "upcoming" ? "Waiting for session to start"
    : data.context === "Session" ? "No readings for this session" : "No audience readings yet";

  useEffect(() => {
    if (!canRenderChart || !containerRef.current) return;
    let disposed = false;
    let observer: ResizeObserver | undefined;
    setStatus("loading");
    setEndpoint(null);

    function positionEndpoint(chart: Highcharts.Chart) {
      if (disposed) return;
      const last = latestRef.current.data.points.findLast(point => point.value !== null);
      const point = chart.series[0]?.points.findLast(point => point.x === last?.x && point.y !== null);
      const { plotX, plotY } = point ?? {};
      const next = last && typeof plotX === "number" && typeof plotY === "number"
        && Number.isFinite(plotX) && Number.isFinite(plotY)
        && plotX >= 0 && plotX <= chart.plotWidth && plotY >= 0 && plotY <= chart.plotHeight
        ? { x: chart.plotLeft + plotX, y: chart.plotTop + plotY, baseline: chart.plotTop + chart.plotHeight, at: last.x }
        : null;
      setEndpoint(previous => previous?.x === next?.x && previous?.y === next?.y
        && previous?.baseline === next?.baseline && previous?.at === next?.at ? previous : next);
    }

    async function initialize() {
      try {
        const { default: Highcharts } = await import("highcharts/highmaps");
        await import("highcharts/modules/accessibility");
        if (disposed || !containerRef.current) return;
        const current = latestRef.current;
        const options = chartOptions(current.data, current.timezone);
        options.chart = { ...options.chart, events: { render() { positionEndpoint(this); } } };
        const chart = Highcharts.chart(containerRef.current, Highcharts.merge(
          options, themeOptions(current.dark)
        ));
        chartRef.current = chart;
        observer = new ResizeObserver(() => chart.reflow());
        observer.observe(containerRef.current);
        setStatus("ready");
      } catch {
        if (!disposed) setStatus("error");
      }
    }
    void initialize();
    return () => {
      disposed = true;
      observer?.disconnect();
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [canRenderChart]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !canRenderChart) return;
    // Update theme and scope separately to preserve both sets of nested options.
    chart.update(themeOptions(dark), false);
    chart.update(dataOptions(data, timezone), false);
    chart.series[0].setData(audiencePoints(data, timezone), false, false, true);
    chart.redraw(false);
  }, [data, timezone, dark, canRenderChart]);

  return (
    <section className={styles.card} data-realtime-audience="v5" aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`}>
      <header className={styles.header}>
        <div className={styles.heading}>
          <h2 id={`${id}-title`} className={styles.title}>Accesses × time</h2>
          <span className={styles.context}>{data.context}</span>
        </div>
        {available && lastReading && (
          <span className={styles.reading} title={`Snapshot updated ${timeFormatter.format(new Date(updatedAt))}`}>
            {stale ? "Updates unavailable · " : "Last reading "}
            <time dateTime={lastReading.at ?? new Date(lastReading.x).toISOString()}>{timeFormatter.format(lastReading.x)}</time>
          </span>
        )}
      </header>
      <p id={`${id}-description`} className="sr-only">{chartDescription(data, timezone)}</p>
      {canRenderChart ? (
        <div className={styles.chartWrap}>
          <div ref={containerRef} className={styles.chart} />
          {showEndpoint && (
            <div
              className={styles.endpoint}
              style={{ left: endpoint.x, top: endpoint.y }}
              data-live-endpoint="true"
              data-pulsing={pulseActive || undefined}
              aria-hidden="true"
            >
              {liveReading && endpoint.baseline > endpoint.y && <span className={styles.endpointGuide} style={{ height: endpoint.baseline - endpoint.y }} />}
              <motion.span
                className={styles.endpointHalo}
                initial={false}
                animate={pulseActive ? { scale: [0.45, 1.1], opacity: [0.3, 0] } : { scale: 1, opacity: 0 }}
                transition={pulseActive ? { duration: 2.4, repeat: Infinity, ease: "easeOut" } : { duration: 0 }}
              />
              <span className={styles.endpointDot} />
            </div>
          )}
          {status !== "ready" && <p className={styles.state} role="status">{status === "error" ? "Audience chart unavailable" : "Loading audience…"}</p>}
          {status === "ready" && !hasReadings && <p className={styles.emptyReading} role="status">{emptyLabel}</p>}
        </div>
      ) : <p className={styles.empty}>{available ? emptyLabel : "Audience unavailable"}</p>}
    </section>
  );
}
