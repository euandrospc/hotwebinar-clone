"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { motion } from "framer-motion";
import type * as Highcharts from "highcharts/highmaps";
import brazilTopology from "@/data/maps/br-all.topo.json";
import type { RealtimeMapV5Data } from "@/lib/realtime-map-v5";
import { useRealtimeMotionV5 } from "./realtime-motion-v5";
import styles from "./realtime-users-map-v5.module.css";

const countFormatter = new Intl.NumberFormat("en-US");
const STATE_SERIES_ID = "live-users-by-state";
const BASEMAP_SERIES_ID = "geographic-basemap";
const brazilBounds = {
  type: "MultiPoint",
  coordinates: [[brazilTopology.bbox[0], brazilTopology.bbox[1]], [brazilTopology.bbox[2], brazilTopology.bbox[3]]],
};

function statePoints(data: RealtimeMapV5Data): Highcharts.SeriesMapDataOptions[] {
  return data.states.map((state) => ({
    "hc-key": state.key,
    name: state.name,
    value: state.value,
    custom: { uf: state.uf },
  }));
}

function themeOptions(dark: boolean, basemapAvailable = true): Highcharts.Options {
  const text = dark ? "#d6d9e1" : "#373e4c";
  return {
    colorAxis: {
      minColor: basemapAvailable ? "rgba(83,91,255,0.015)" : "#eef0ff",
      maxColor: basemapAvailable ? "rgba(83,91,255,0.42)" : "#535bff",
      labels: { style: { color: "#515b69", fontSize: "10px" } },
    },
    legend: { itemStyle: { color: "#373e4c" }, title: { style: { color: "#515b69", fontSize: "10px", fontWeight: "400" } } },
    tooltip: {
      backgroundColor: dark ? "#202126" : "#ffffff",
      borderColor: dark ? "#373a44" : "#e3e5eb",
      style: { color: text, fontSize: "12px" },
    },
    mapNavigation: {
      buttonOptions: {
        theme: { fill: dark ? "#202126" : "#ffffff", stroke: dark ? "#373a44" : "#e3e5eb", "stroke-width": 1 },
        style: { color: text, fontSize: "16px", fontWeight: "400" },
      },
    },
    credits: { enabled: false },
    plotOptions: {
      map: {
        borderColor: "rgba(86,82,115,0.28)",
        nullColor: "rgba(83,91,255,0.015)",
      },
    },
  };
}

function chartOptions(data: RealtimeMapV5Data, basemapAvailable: boolean): Highcharts.Options {
  const series: Highcharts.SeriesOptionsType[] = [];
  if (basemapAvailable) series.push({
    type: "tiledwebmap",
    id: BASEMAP_SERIES_ID,
    name: "OpenStreetMap",
    provider: { type: "OpenStreetMap", theme: "Standard" },
    zIndex: 0,
    showInLegend: false,
    accessibility: { enabled: false },
  });
  series.push({
    type: "map",
    id: STATE_SERIES_ID,
    name: "users live",
    mapData: brazilTopology,
    joinBy: "hc-key",
    data: statePoints(data),
    allAreas: true,
    zIndex: 1,
  });
  return {
    chart: {
      map: brazilTopology,
      animation: false,
      backgroundColor: "#aad3df",
      spacing: [0, 0, 32, 0],
      style: { fontFamily: "inherit" },
      reflow: false,
    },
    title: { text: undefined },
    mapView: {
      projection: { name: "WebMercator" },
      fitToGeometry: brazilBounds,
      padding: [24, 16, 60, 16],
      maxZoom: 12,
    },
    mapNavigation: {
      enabled: true,
      enableMouseWheelZoom: true,
      enableDoubleClickZoom: true,
      enableTouchZoom: true,
      buttonOptions: { align: "left", verticalAlign: "top", x: 8, width: 18, height: 18, padding: 4 },
      buttons: { zoomIn: { y: 8 }, zoomOut: { y: 36 } },
    },
    legend: {
      align: "center",
      verticalAlign: "bottom",
      layout: "horizontal",
      floating: true,
      y: -32,
      margin: 6,
      padding: 7,
      backgroundColor: "rgba(255,255,255,0.94)",
      borderColor: "#d5dfe4",
      borderWidth: 1,
      borderRadius: 7,
      symbolWidth: 130,
      symbolHeight: 6,
      title: { text: "users live" },
    },
    colorAxis: {
      min: 0,
      max: Math.max(1, ...data.states.map((state) => state.value ?? 0)),
      allowDecimals: false,
      tickPixelInterval: 55,
    },
    tooltip: {
      headerFormat: "",
      pointFormat: "<b>{point.name} ({point.custom.uf})</b><br/><b>{point.value:,.0f}</b> users live",
      borderRadius: 8,
      shadow: false,
      valueDecimals: 0,
    },
    accessibility: {
      enabled: true,
      description: "Live users mapped to Brazil's 27 states over an OpenStreetMap geographic basemap. Violet intensity represents the number of live users. Users outside Brazil or without a known state are excluded from the map.",
      keyboardNavigation: { enabled: true },
      point: { valueDescriptionFormat: "{point.name}, {point.value} users live." },
    },
    plotOptions: {
      series: { animation: false },
      map: {
        borderWidth: 0.6,
        // The basemap supplies city and state names; avoid covering them with a second label layer.
        dataLabels: { enabled: false },
        states: { hover: { color: "rgba(83,91,255,0.5)", borderColor: "#535bff", borderWidth: 1.2 } },
      },
    },
    series,
    credits: {
      enabled: false,
      // Attribution for both datasets is rendered as accessible links below.
      mapText: "",
      mapTextFull: "",
    },
    responsive: {
      rules: [{ condition: { maxWidth: 400 }, chartOptions: { legend: { symbolWidth: 100 } } }],
    },
  };
}

/** The map is client-only; each refresh updates counts without resetting the view. */
export function RealtimeUsersMapV5({ data }: { data: RealtimeMapV5Data }) {
  const id = useId();
  const motionEnabled = useRealtimeMotionV5();
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === "dark";
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<Highcharts.MapChart | null>(null);
  const latestRef = useRef({ data, dark });
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [basemapAvailable, setBasemapAvailable] = useState(true);
  latestRef.current = { data, dark };

  useEffect(() => {
    if (!data.available || !containerRef.current) return;
    let disposed = false;
    let observer: ResizeObserver | undefined;
    const container = containerRef.current;
    let basemapFailed = false;
    setStatus("loading");
    setBasemapAvailable(true);

    function onTileError(event: Event) {
      const target = event.target;
      if (basemapFailed || !(target instanceof Element) || target.tagName.toLowerCase() !== "image"
        || !target.closest(".highcharts-tiledwebmap-series")) return;
      basemapFailed = true;
      setBasemapAvailable(false);
      const chart = chartRef.current;
      (chart?.get(BASEMAP_SERIES_ID) as Highcharts.Series | undefined)?.setVisible(false, false);
      chart?.update(themeOptions(latestRef.current.dark, false), false);
      chart?.redraw(false);
    }
    container.addEventListener("error", onTileError, true);

    async function initialize() {
      try {
        const { default: Highmaps } = await import("highcharts/highmaps");
        let tilesAvailable = true;
        try {
          await import("highcharts/modules/tiledwebmap");
        } catch {
          tilesAvailable = false;
        }
        await import("highcharts/modules/accessibility");
        if (disposed || !containerRef.current) return;
        const current = latestRef.current;
        const chart = Highmaps.mapChart(containerRef.current, Highmaps.merge(
          chartOptions(current.data, tilesAvailable), themeOptions(current.dark, tilesAvailable)
        ));
        chartRef.current = chart;
        setBasemapAvailable(tilesAvailable);
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
      container.removeEventListener("error", onTileError, true);
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [data.available]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !data.available) return;
    const center = chart.mapView?.center;
    const zoom = chart.mapView?.zoom;
    chart.update(themeOptions(dark, basemapAvailable), false);
    (chart.get(STATE_SERIES_ID) as Highcharts.Series | undefined)?.setData(statePoints(data), false, false, true);
    chart.update({ colorAxis: { max: Math.max(1, ...data.states.map((state) => state.value ?? 0)) } }, false);
    if (center && zoom !== undefined) chart.mapView?.setView(center, zoom, false, false);
    chart.redraw(false);
  }, [data, dark, basemapAvailable]);

  function fitBrazil() {
    chartRef.current?.mapView?.zoomBy(undefined, undefined, undefined, false);
  }

  return (
    <section className={styles.card} data-realtime-users-map="v5" aria-labelledby={`${id}-title`}>
      <header className={styles.header}>
        <h2 id={`${id}-title`} className={styles.title}>users live map</h2>
        <span className={styles.country}>Brazil</span>
      </header>
      {data.available ? (
        <>
          <div className={styles.mapWrap}>
            <div ref={containerRef} className={styles.map} data-motion={motionEnabled || undefined} />
            {status === "ready" && <motion.button type="button" className={styles.fitButton} onClick={fitBrazil} whileTap={motionEnabled ? { scale: 0.96 } : undefined} transition={{ duration: motionEnabled ? 0.12 : 0 }} aria-label="Fit Brazil in the map">Fit Brazil</motion.button>}
            {status === "ready" && !basemapAvailable && <p className={styles.basemapNotice} role="status">Geographic background unavailable · State view</p>}
            {status !== "ready" && <p className={styles.state} role="status">{status === "error" ? "Map unavailable" : "Loading map…"}</p>}
            {status === "ready" && <div className={styles.attribution}>
              <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a>
              <span aria-hidden="true">·</span>
              <a href="https://www.naturalearthdata.com/" target="_blank" rel="noreferrer">Natural Earth</a>
            </div>}
          </div>
          <p className={styles.coverage}>
            <span>{countFormatter.format(data.brazilMapped ?? 0)} in Brazil</span>
            <span>{countFormatter.format(data.outsideBrazil ?? 0)} outside Brazil</span>
            <span>{countFormatter.format(data.unmapped ?? 0)} unmapped</span>
          </p>
        </>
      ) : <p className={styles.unavailable}>Live user locations unavailable</p>}
    </section>
  );
}
