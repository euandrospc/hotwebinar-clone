"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useTheme } from "next-themes";
import type * as Highcharts from "highcharts/highmaps";
import { RealtimeMotionValueV5, useRealtimeMotionV5 } from "./realtime-motion-v5";
import styles from "./realtime-breakdown-v5.module.css";

interface BreakdownData {
  available: boolean;
  total: number | null;
  items: Array<{
    key: string;
    label: string;
    count: number;
    percentage: number | null;
    color: string;
  }>;
}

interface RealtimeBreakdownV5Props {
  data: BreakdownData;
  kind: "devices" | "regions";
  title: string;
  context: string;
  description: string;
  totalLabel: string;
  emptyLabel: string;
  unavailableLabel: string;
  percentageScope?: string;
  footer?: ReactNode;
}

const countFormatter = new Intl.NumberFormat("en-US");
const percentFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

function breakdownPoints(data: BreakdownData): Highcharts.PointOptionsObject[] {
  return data.items.map((item) => ({
    id: item.key,
    name: item.label,
    y: item.count,
    color: item.color,
    custom: {
      countLabel: countFormatter.format(item.count),
      percentageLabel: item.percentage === null ? "—" : `${percentFormatter.format(item.percentage)}%`,
    },
  }));
}

function themeOptions(dark: boolean): Highcharts.Options {
  const text = dark ? "#d6d9e1" : "#373e4c";
  const muted = dark ? "#989eab" : "#757b87";
  return {
    tooltip: {
      backgroundColor: dark ? "#202126" : "#ffffff",
      borderColor: dark ? "#373a44" : "#e3e5eb",
      style: { color: text, fontSize: "11px" },
    },
    plotOptions: {
      pie: {
        borderColor: dark ? "#151619" : "#ffffff",
        dataLabels: {
          style: { color: muted },
          format: `<span style="color:${text};font-weight:500">{point.name}:</span> {point.custom.percentageLabel}`,
        },
      },
    },
    credits: { enabled: false },
  };
}

function chartOptions(
  data: BreakdownData,
  kind: RealtimeBreakdownV5Props["kind"],
  description: string,
  percentageScope: string,
  motionEnabled: boolean,
): Highcharts.Options {
  const percentageSuffix = percentageScope ? ` ${percentageScope}` : "";
  return {
    chart: {
      type: "pie",
      animation: motionEnabled ? { duration: 360 } : false,
      backgroundColor: "transparent",
      spacing: [6, 0, 18, 0],
      style: { fontFamily: "inherit" },
      reflow: false,
    },
    title: { text: undefined },
    legend: { enabled: false },
    tooltip: {
      headerFormat: "",
      pointFormat: `<b>{point.name}</b><br/>{point.custom.countLabel} users live · {point.custom.percentageLabel}${percentageSuffix}`,
      borderRadius: 8,
      shadow: false,
      outside: true,
    },
    accessibility: {
      enabled: true,
      description,
      keyboardNavigation: { enabled: true },
      point: { valueDescriptionFormat: `{point.name}, {point.custom.countLabel} users live, {point.custom.percentageLabel}${percentageSuffix}.` },
    },
    plotOptions: {
      series: { animation: motionEnabled ? { duration: 450 } : false },
      pie: {
        innerSize: "70%",
        size: 132,
        center: ["50%", "50%"],
        borderWidth: 2,
        borderRadius: 2,
        dataLabels: {
          enabled: true,
          distance: 14,
          padding: 0,
          connectorPadding: 4,
          connectorWidth: 1,
          connectorShape: "crookedLine",
          softConnector: false,
          filter: { property: "y", operator: ">", value: 0 },
          style: { fontSize: "11px", fontWeight: "400", textOutline: "none" },
        },
        states: {
          hover: { brightness: 0.08, halo: { size: 4, opacity: 0.12 } },
          inactive: { opacity: 0.55 },
        },
      },
    },
    credits: { enabled: false },
    responsive: {
      rules: [{
        condition: { maxWidth: 340 },
        chartOptions: { plotOptions: { pie: { size: 112, dataLabels: { distance: 10, style: { fontSize: "10px" } } } } },
      }],
    },
    series: [{
      type: "pie",
      id: kind === "devices" ? "live-users-by-device" : "live-users-by-region",
      name: "users live",
      data: breakdownPoints(data),
    }],
  };
}

/** Shared live-distribution chart, with percentages supplied by each population. */
export function RealtimeBreakdownV5({
  data, kind, title, context, description, totalLabel, emptyLabel,
  unavailableLabel, percentageScope = "", footer,
}: RealtimeBreakdownV5Props) {
  const id = useId();
  const motionEnabled = useRealtimeMotionV5();
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === "dark";
  const hasUsers = data.available && (data.total ?? 0) > 0;
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<Highcharts.Chart | null>(null);
  const latestRef = useRef({ data, dark, motionEnabled });
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  latestRef.current = { data, dark, motionEnabled };

  useEffect(() => {
    if (!hasUsers || !containerRef.current) return;
    let disposed = false;
    let observer: ResizeObserver | undefined;
    setStatus("loading");

    async function initialize() {
      try {
        // Use the map's existing runtime instead of loading a second Highcharts core.
        const { default: Highcharts } = await import("highcharts/highmaps");
        await import("highcharts/modules/accessibility");
        if (disposed || !containerRef.current) return;
        const current = latestRef.current;
        const chart = Highcharts.chart(containerRef.current, Highcharts.merge(
          chartOptions(current.data, kind, description, percentageScope, current.motionEnabled), themeOptions(current.dark)
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
  }, [hasUsers, kind, description, percentageScope]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !hasUsers) return;
    chart.update(themeOptions(dark), false);
    const animation = motionEnabled ? { duration: 320 } : false;
    chart.series[0].setData(breakdownPoints(data), false, animation, true);
    chart.redraw(animation);
  }, [data, dark, hasUsers, motionEnabled]);

  return (
    <section
      className={styles.card}
      data-realtime-devices={kind === "devices" ? "v5" : undefined}
      data-realtime-regions={kind === "regions" ? "v5" : undefined}
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-description`}
    >
      <header className={styles.header}>
        <h2 id={`${id}-title`} className={styles.title}>{title}</h2>
        <span className={styles.period}>{context}</span>
      </header>
      <p id={`${id}-description`} className="sr-only">{description}</p>
      {data.available ? (
        <div className={styles.body}>
          <div className={styles.chartWrap}>
            {hasUsers ? (
              <>
                <div ref={containerRef} className={styles.chart} />
                {status === "ready" ? (
                  <div className={styles.total} aria-hidden="true">
                    <RealtimeMotionValueV5 value={data.total} className={styles.totalValue}>{countFormatter.format(data.total ?? 0)}</RealtimeMotionValueV5>
                    <span className={styles.totalLabel}>{totalLabel}</span>
                  </div>
                ) : <p className={styles.state} role="status">{status === "error" ? "Chart unavailable" : "Loading chart…"}</p>}
              </>
            ) : (
              <div className={styles.empty}>
                <span className={styles.totalValue}>0</span>
                <span className={styles.totalLabel}>{emptyLabel}</span>
              </div>
            )}
          </div>
          <ul className="sr-only" aria-label={kind === "devices" ? "Live users by device" : "Live users by region in Brazil"}>
            {data.items.map((item) => (
              <li key={item.key} data-device={kind === "devices" ? item.key : undefined} data-region={kind === "regions" ? item.key : undefined}>
                {item.label}: {countFormatter.format(item.count)} users live, {item.percentage === null ? "percentage unavailable" : `${percentFormatter.format(item.percentage)}%${percentageScope ? ` ${percentageScope}` : ""}`}.
              </li>
            ))}
          </ul>
        </div>
      ) : <p className={styles.unavailable}>{unavailableLabel}</p>}
      {data.available && footer ? <p className={styles.footer}>{footer}</p> : null}
    </section>
  );
}
