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
const currencyFormatter = new Intl.NumberFormat("en-US", { style: "currency", currency: "BRL", currencyDisplay: "narrowSymbol" });
const dayFormatter = new Intl.DateTimeFormat("en-US", { day: "2-digit", month: "long", timeZone: "UTC" });

type KpiKind = "live" | "audience" | "revenue";

const labels = {
  live: { title: "users live", context: "Viewers actively playing now, deduplicated across tabs. Presence expires after 45 seconds without an update.", history: "Observed audience over the last hour" },
  audience: { title: "Audience", context: "Average of today's observed concurrent-viewer samples, not unique visitors or a full-day projection.", history: "Today's observed concurrent audience" },
  revenue: { title: "Revenue", context: "Dominando Claude Code orders recorded today · gross BRL including order add-ons, before refunds. Uses the order recording date, not the payment date.", history: "Daily recorded course-order revenue this month, including today so far" }
} as const;

function KpiCard({ kind, series, timezone, updatedAt }: {
  kind: KpiKind;
  series: RealtimeKpiSeries;
  timezone: string;
  updatedAt: string;
}) {
  const id = useId().replace(/:/g, "");
  const motionEnabled = useRealtimeMotionV5();
  const gradientId = `realtime-kpi-gradient-${id}`;
  const label = labels[kind];
  const isRevenue = kind === "revenue";
  const formatValue = (value: number | null) => value === null
    ? "—"
    : (isRevenue ? currencyFormatter : countFormatter).format(value);
  const timeFormatter = useMemo(() => new Intl.DateTimeFormat("en-US", {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: timezone
  }), [timezone]);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(new Date(updatedAt));
  const hasHistory = series.points.some((point) => point.value !== null);
  const highestValue = series.points.reduce((highest, point) => Math.max(highest, point.value ?? 0), 0);

  return (
    <article className={styles.card} aria-labelledby={`${id}-title`} data-kpi={kind}>
      <h2 id={`${id}-title`} className={styles.title} title={label.context}>
        {label.title}
        {kind === "live" && series.value !== null && (
          <motion.span
            className={styles.liveDot}
            aria-hidden="true"
            initial={false}
            animate={{ opacity: motionEnabled ? [1, 0.5, 1] : 1 }}
            transition={{ duration: motionEnabled ? 2.8 : 0, repeat: motionEnabled ? Infinity : 0, ease: "easeInOut" }}
          />
        )}
      </h2>
      <div className={styles.body}>
        <div className={styles.summary}>
          <p className={styles.value} title={label.context}>
            <span aria-label={series.value === null ? "Unavailable" : undefined}>
              <RealtimeMotionValueV5 value={series.value}>{formatValue(series.value)}</RealtimeMotionValueV5>
            </span>
          </p>
          <p className="sr-only">{label.context}</p>
        </div>
        <div className={styles.chart}>
          {hasHistory ? (
            <LineChart
              height={42}
              margin={{ top: 5, right: 4, bottom: 5, left: 4 }}
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
            <KpiCard key={kind} kind={kind} series={kpis[kind]} timezone={kpis.timezone} updatedAt={kpis.updatedAt} />
          ))}
        </section>
      </div>
    </ThemeProvider>
  );
}
