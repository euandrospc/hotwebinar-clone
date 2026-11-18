"use client";

import { useId, useMemo } from "react";
import { motion } from "framer-motion";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { LineChart, lineClasses } from "@mui/x-charts/LineChart";
import { useTheme } from "next-themes";
import type { RealtimeKpis, RealtimeKpiSeries } from "@/lib/realtime-kpis-v5";
import { RealtimeMotionValueV5, useRealtimeMotionV5 } from "./realtime-motion-v5";
import styles from "./realtime-kpi-cards-v5.module.css";

const countFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
const changeFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0, signDisplay: "exceptZero" });
const currencyFormatter = new Intl.NumberFormat("en-US", { style: "currency", currency: "BRL", currencyDisplay: "narrowSymbol" });
const dayFormatter = new Intl.DateTimeFormat("en-US", { day: "2-digit", month: "long", timeZone: "UTC" });

type KpiKind = "live" | "audience" | "revenue";

const labels = {
  live: { title: "Live", context: "Viewers actively playing now, deduplicated across tabs. Presence expires after 45 seconds without an update.", history: "Observed audience over the last hour" },
  audience: { title: "Audience", context: "Average of today's observed concurrent-viewer samples, not unique visitors or a full-day projection.", history: "Today's observed concurrent audience" },
  revenue: { title: "Revenue", context: "Dominando Claude Code orders recorded today · gross BRL including order add-ons, before refunds. Uses the order recording date, not the payment date.", history: "Daily recorded course-order revenue this month, including today so far" }
} as const;

function KpiCard({ kind, series, timezone, updatedAt, peak, revenue }: {
  kind: KpiKind;
  series: RealtimeKpiSeries;
  timezone: string;
  updatedAt: string;
  peak?: Pick<RealtimeKpis["audience"], "peak" | "peakAt" | "yesterdayPeak" | "peakChangePct">;
  revenue?: Pick<RealtimeKpis["revenue"], "yesterdayValue" | "changePct">;
}) {
  const id = useId().replace(/:/g, "");
  const motionEnabled = useRealtimeMotionV5();
  const gradientId = `realtime-kpi-gradient-${id}`;
  const label = labels[kind];
  const isRevenue = kind === "revenue";
  const liveActive = kind === "live" && series.value !== null && series.value > 0;
  const animateLive = liveActive && motionEnabled;
  const hasComparison = kind === "audience" || isRevenue;
  const formatValue = (value: number | null) => value === null
    ? "—"
    : (isRevenue ? currencyFormatter : countFormatter).format(value);
  const timeFormatter = useMemo(() => new Intl.DateTimeFormat("en-US", {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: timezone
  }), [timezone]);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(new Date(updatedAt));
  const hasHistory = series.points.some((point) => point.value !== null);
  const highestValue = series.points.reduce((highest, point) => Math.max(highest, point.value ?? 0), 0);
  const peakReadingContext = peak?.peak == null
    ? `Today's peak concurrent audience is unavailable. Times in ${timezone}.`
    : `Today's highest observed concurrent audience: ${countFormatter.format(peak.peak)} viewers.${peak.peakAt ? ` First recorded at ${timeFormatter.format(new Date(peak.peakAt))}.` : ""} Times in ${timezone}. Gaps are not counted as zero.`;
  const comparisonContext = peak?.yesterdayPeak == null
    ? "Yesterday's peak is unavailable; percentage change cannot be calculated."
    : `Yesterday's full-day peak: ${countFormatter.format(peak.yesterdayPeak)} viewers.${peak.yesterdayPeak === 0 ? " Percentage change is unavailable because the baseline is zero." : ""}`;
  const peakContext = `${peakReadingContext} ${comparisonContext} Compares today so far with the whole previous calendar day in ${timezone}.`;
  const change = peak?.peakChangePct == null ? "—" : `${changeFormatter.format(peak.peakChangePct)}%`;
  const trend = change.startsWith("-") ? "down" : change.startsWith("+") ? "up" : "flat";
  const revenueChange = revenue?.changePct == null ? "—" : `${changeFormatter.format(revenue.changePct)}%`;
  const revenueTrend = revenueChange.startsWith("-") ? "down" : revenueChange.startsWith("+") ? "up" : "flat";
  const revenueComparisonContext = revenue?.yesterdayValue == null
    ? "Yesterday's recorded revenue is unavailable; percentage change cannot be calculated."
    : `Yesterday's full-day recorded revenue: ${currencyFormatter.format(revenue.yesterdayValue)}.${revenue.yesterdayValue === 0 ? " Percentage change is unavailable because the baseline is zero." : ""}`;
  const revenueContext = `${labels.revenue.context} ${revenueComparisonContext} Compares today so far with the whole previous calendar day in ${timezone}.${revenue?.changePct != null ? ` Today's revenue changed ${revenueChange} versus yesterday.` : ""}`;

  return (
    <article className={styles.card} aria-labelledby={`${id}-title`} data-kpi={kind}>
      <h2 id={`${id}-title`} className={styles.title} title={label.context}>
        {kind === "live" && series.value !== null && (
          <span
            className={styles.liveIndicator}
            data-active={liveActive}
            aria-hidden="true"
            title={liveActive ? "Viewers live now" : "No viewers live now"}
          >
            <svg viewBox="0 0 16 16" fill="none" focusable="false">
              <motion.path
                d="M3.3 3.3C.7 5.9.7 10.1 3.3 12.7M12.7 3.3C15.3 5.9 15.3 10.1 12.7 12.7"
                stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"
                initial={false}
                animate={{ opacity: animateLive ? [0.15, 0.85, 0.15] : 0.45, scale: animateLive ? [0.88, 1, 1.04] : 1 }}
                transition={{ duration: animateLive ? 1.8 : 0, delay: animateLive ? 0.25 : 0, repeat: animateLive ? Infinity : 0, ease: "easeInOut" }}
                style={{ transformOrigin: "center", transformBox: "fill-box" }}
              />
              <motion.path
                d="M5.6 5.6C4.3 6.9 4.3 9.1 5.6 10.4M10.4 5.6C11.7 6.9 11.7 9.1 10.4 10.4"
                stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"
                initial={false}
                animate={{ opacity: animateLive ? [0.4, 1, 0.4] : 0.75 }}
                transition={{ duration: animateLive ? 1.8 : 0, repeat: animateLive ? Infinity : 0, ease: "easeInOut" }}
              />
              <motion.circle
                cx="8" cy="8" r="1.6" fill="currentColor"
                initial={false}
                animate={{ opacity: animateLive ? [1, 0.7, 1] : 1 }}
                transition={{ duration: animateLive ? 1.8 : 0, repeat: animateLive ? Infinity : 0, ease: "easeInOut" }}
              />
            </svg>
          </span>
        )}
        {label.title}
      </h2>
      <div className={styles.body}>
        <div className={styles.summary}>
          <p className={styles.value} title={label.context}>
            <span aria-label={series.value === null ? "Unavailable" : undefined}>
              <RealtimeMotionValueV5 value={series.value}>{formatValue(series.value)}</RealtimeMotionValueV5>
            </span>
          </p>
          <p className="sr-only">{label.context}</p>
          {kind === "audience" && (
            <>
              <p className={styles.peak} title={peakContext} aria-describedby={`${id}-peak-description`}>
                <span>Peak</span>
                <span className={styles.peakValue}>
                  <RealtimeMotionValueV5 value={peak?.peak ?? null}>{formatValue(peak?.peak ?? null)}</RealtimeMotionValueV5>
                </span>
                <span className={styles.peakComparison}>
                  <span>vs</span>
                  <span className={styles.peakChange} data-trend={trend}>{change}</span>
                  <span>yesterday</span>
                </span>
              </p>
              <p className="sr-only" id={`${id}-peak-description`}>{peakContext}</p>
            </>
          )}
          {isRevenue && (
            <>
              <p className={styles.peak} title={revenueContext} aria-describedby={`${id}-revenue-description`}>
                <span>Yesterday</span>
                <span className={styles.peakValue}>
                  <RealtimeMotionValueV5 value={revenue?.yesterdayValue ?? null}>{formatValue(revenue?.yesterdayValue ?? null)}</RealtimeMotionValueV5>
                </span>
                <span className={styles.peakComparison}>
                  <span>vs</span>
                  <span className={styles.peakChange} data-trend={revenueTrend}>{revenueChange}</span>
                </span>
              </p>
              <p className="sr-only" id={`${id}-revenue-description`}>{revenueContext}</p>
            </>
          )}
        </div>
        <div className={styles.chart}>
          {hasHistory ? (
            <LineChart
              height={hasComparison ? 26 : 42}
              margin={{ top: hasComparison ? 2 : 5, right: 4, bottom: hasComparison ? 2 : 5, left: 4 }}
              xAxis={[{
                data: series.points.map((point) => new Date(point.x)),
                scaleType: "time",
                position: "none",
                valueFormatter: (value: Date) => isRevenue
                  ? `${dayFormatter.format(value)}${value.toISOString().slice(0, 10) === today ? " · today so far" : ""}`
                  : timeFormatter.format(value)
              }]}
              yAxis={[{ position: "none", min: 0, max: highestValue > 0 ? highestValue * 1.15 : 1 }]}
              series={[{
                id: kind,
                label: isRevenue ? "Revenue" : "Viewers",
                data: series.points.map((point) => point.value),
                color: "#535bff",
                curve: "linear",
                area: true,
                connectNulls: false,
                showMark: ({ index }) => series.points[index - 1]?.value == null && series.points[index + 1]?.value == null,
                valueFormatter: (value, context) => {
                  const count = series.points[context.dataIndex]?.count;
                  return isRevenue && value !== null && count !== undefined
                    ? `${formatValue(value)} · ${count} ${count === 1 ? "sale" : "sales"}`
                    : formatValue(value);
                }
              }]}
              hideLegend
              skipAnimation
              axisHighlight={{ x: "none", y: "none" }}
              slotProps={{ tooltip: { trigger: "axis" } }}
              title={label.history}
              desc={`${label.history}. ${isRevenue ? "Gross daily amounts in BRL." : `Times in ${timezone}.`} Use the arrow keys to explore readings. Gaps indicate missing readings.`}
              sx={{
                [`& .${lineClasses.area}`]: { fill: `url(#${gradientId})` },
                [`& .${lineClasses.line}`]: { strokeWidth: 2.5 },
                [`& .${lineClasses.mark}`]: { strokeWidth: 0, r: 3 },
                "& .MuiChartsSurface-root:focus-visible": { outline: "2px solid #535bff", outlineOffset: 2, borderRadius: "6px" }
              }}
            >
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#535bff" stopOpacity={0.26} />
                  <stop offset="100%" stopColor="#535bff" stopOpacity={0} />
                </linearGradient>
              </defs>
            </LineChart>
          ) : <p className={styles.empty}>No history</p>}
        </div>
      </div>
    </article>
  );
}

export function RealtimeKpiCardsV5({ kpis }: { kpis: RealtimeKpis }) {
  const { resolvedTheme } = useTheme();
  const theme = useMemo(() => createTheme({
    palette: { mode: resolvedTheme === "dark" ? "dark" : "light", primary: { main: "#535bff" } },
    typography: { fontFamily: "inherit", fontSize: 12 },
    shape: { borderRadius: 10 }
  }), [resolvedTheme]);

  return (
    <ThemeProvider theme={theme}>
      <div className={styles.container}>
        <section className={styles.row} aria-label="Realtime metrics">
          {(["live", "audience", "revenue"] as const).map((kind) => (
            <KpiCard key={kind} kind={kind} series={kpis[kind]} timezone={kpis.timezone} updatedAt={kpis.updatedAt}
              peak={kind === "audience" ? kpis.audience : undefined}
              revenue={kind === "revenue" ? kpis.revenue : undefined} />
          ))}
        </section>
      </div>
    </ThemeProvider>
  );
}
