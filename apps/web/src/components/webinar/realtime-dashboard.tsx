"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Globe, MapPin, MonitorPlay, Radio, RefreshCw, Smartphone, Users } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { WebinarRealtimeSnapshot } from "@/lib/webinar-realtime";
import { useRealtimeChannel } from "@/lib/hooks/use-realtime-channel";
import type { RealtimeStatus } from "@/lib/realtime-protocol";
import { RealtimeCountdown } from "./realtime-countdown";
import { AudienceSummary } from "@/components/dashboard/audience-summary";
import { DashboardFunnel } from "@/components/dashboard/dashboard-funnel";
import { RealtimeMap } from "./realtime-map";

import styles from "./webinar-operations.module.css";

const REFRESH_MS = 15_000;
const REQUEST_TIMEOUT_MS = 10_000;
const fmt = new Intl.NumberFormat("pt-BR");
const deviceLabels = [
  { key: "desktop", label: "Computador", color: "#064b3c" },
  { key: "mobile", label: "Celular", color: "#83b94d" },
  { key: "tablet", label: "Tablet", color: "#c2db9c" },
  { key: "unknown", label: "Não identificado", color: "#a5b2a5" }
] as const;

function countryName(code: string) {
  try { return new Intl.DisplayNames(["pt-BR"], { type: "region" }).of(code.toUpperCase()) || code; }
  catch { return code; }
}

function Devices({ data }: { data: WebinarRealtimeSnapshot }) {
  let cursor = 0;
  const segments = deviceLabels.map(({ key, color }) => {
    const start = cursor;
    cursor += data.online ? data.devices[key] / data.online * 100 : 0;
    return `${color} ${start}% ${cursor}%`;
  });

  return (
    <section className={styles.surface} aria-label="Dispositivos online">
      <div className="flex items-center gap-2">
        <Smartphone className="h-3.5 w-3.5 text-[#538743] dark:text-[#B5D994]" />
        <h2 className="text-[13px] font-semibold">Dispositivos agora</h2>
      </div>
      <div className="relative mx-auto my-4 flex h-28 w-28 items-center justify-center rounded-full bg-muted" style={data.online ? { background: `conic-gradient(${segments.join(",")})` } : undefined} aria-hidden="true">
        <div className="flex h-[90px] w-[90px] flex-col items-center justify-center rounded-full bg-card">
          <span className="text-2xl font-semibold tabular-nums">{fmt.format(data.online)}</span>
          <span className="text-xs text-muted-foreground">online</span>
        </div>
      </div>
      <ul className="space-y-2.5">
        {deviceLabels.map(({ key, label, color }) => (
          <li key={key} className="flex items-center justify-between gap-3 text-xs">
            <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />{label}</span>
            <span className="whitespace-nowrap tabular-nums"><span className="font-medium">{fmt.format(data.devices[key])}</span><span className="ml-2 text-xs text-muted-foreground">{data.online ? Math.round(data.devices[key] / data.online * 100) : 0}%</span></span>
          </li>
        ))}
      </ul>
      {data.online === 0 && <p className="mt-4 text-xs text-muted-foreground">A distribuição aparece quando alguém estiver assistindo.</p>}
    </section>
  );
}

function LocationsRanking({ data }: { data: WebinarRealtimeSnapshot }) {
  return (
    <section className={styles.surface} aria-label="Localizações online">
      <div className="mb-4 flex items-center gap-2"><Globe className="h-3.5 w-3.5 text-[#538743] dark:text-[#B5D994]" /><h2 className="text-[13px] font-semibold">De onde estão assistindo</h2></div>
      <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
        {[
          { title: "Cidades", rows: data.topCities },
          { title: "Países", rows: data.topCountries.map(({ code, count }) => ({ label: countryName(code), count })) }
        ].map(({ title, rows }) => (
          <div key={title}>
            <h3 className="mb-2 text-xs font-medium text-muted-foreground">{title}</h3>
            {rows.length ? <ul className="space-y-2">{rows.map((row) => <li key={row.label} className="flex justify-between gap-3 text-xs"><span className="truncate">{row.label}</span><span className="tabular-nums">{fmt.format(row.count)}</span></li>)}</ul> : <p className="text-sm text-muted-foreground">Sem localizações disponíveis.</p>}
          </div>
        ))}
      </div>
    </section>
  );
}

export function RealtimeDashboard({ webinarId, title, initialData }: {
  webinarId: string;
  title: string;
  initialData: WebinarRealtimeSnapshot;
}) {
  const [data, setData] = useState(initialData);
  const [stale, setStale] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const refresh = useRef<() => void>(() => {});
  const liveRefresh = useRef<ReturnType<typeof setTimeout>>();
  const channelStatus = useRef<RealtimeStatus>("connecting");
  const { status } = useRealtimeChannel({ kind: "webinar", webinarId }, (event) => {
    if ((event.type !== "presence" && event.type !== "funnel") || event.webinarId !== webinarId) return;
    // A bounded batch cannot be postponed indefinitely by continuous traffic.
    if (liveRefresh.current) return;
    liveRefresh.current = setTimeout(() => {
      liveRefresh.current = undefined;
      refresh.current();
    }, 150);
  }, () => refresh.current());
  channelStatus.current = status;

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | null = null;
    let refreshQueued = false;

    async function tick() {
      if (!alive || document.hidden) return;
      if (controller) { refreshQueued = true; return; }
      refreshQueued = false;
      clearTimeout(timer);
      const requestController = new AbortController();
      controller = requestController;
      const timeout = setTimeout(() => requestController.abort(), REQUEST_TIMEOUT_MS);
      let failed = false;
      setRefreshing(true);
      try {
        const response = await fetch(`/api/webinars/${webinarId}/realtime`, { cache: "no-store", signal: requestController.signal });
        if (!response.ok) throw new Error("Snapshot unavailable");
        const next: WebinarRealtimeSnapshot = await response.json();
        if (alive) { setData(next); setStale(false); }
      } catch {
        failed = true;
        if (alive) setStale(true);
      } finally {
        clearTimeout(timeout);
        controller = null;
        if (alive) {
          setRefreshing(false);
          if (!document.hidden) timer = setTimeout(tick, refreshQueued ? 150 : channelStatus.current === "connected" && !failed ? 60_000 : REFRESH_MS);
        }
      }
    }

    function visibilityChanged() {
      clearTimeout(timer);
      clearTimeout(liveRefresh.current);
      liveRefresh.current = undefined;
      if (!document.hidden) void tick();
    }

    refresh.current = () => void tick();
    timer = setTimeout(tick, REFRESH_MS);
    document.addEventListener("visibilitychange", visibilityChanged);
    window.addEventListener("focus", visibilityChanged);
    return () => {
      alive = false;
      clearTimeout(timer);
      clearTimeout(liveRefresh.current);
      liveRefresh.current = undefined;
      controller?.abort();
      document.removeEventListener("visibilitychange", visibilityChanged);
      window.removeEventListener("focus", visibilityChanged);
    };
  }, [webinarId]);

  return (
    <div className="min-w-0 space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight">Tempo real</h1>
          <p className="mt-1 text-xs text-muted-foreground">{title}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right text-xs text-muted-foreground" role="status">
            <p className={cn("flex items-center justify-end gap-1.5 font-medium", stale ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400")}>
              <span className="h-1.5 w-1.5 rounded-full bg-current" />{stale ? "Reconectando…" : status === "connected" ? "Conectado ao vivo" : "Atualização automática"}
            </p>
            <p className="mt-1">{status === "connected" ? "Última leitura" : "A cada 15 s"} · <time dateTime={data.updatedAt} suppressHydrationWarning>{new Date(data.updatedAt).toLocaleTimeString("pt-BR")}</time></p>
          </div>
          <Button variant="outline" size="icon" className="h-[34px] w-[34px] rounded-lg" onClick={() => refresh.current()} disabled={refreshing} aria-label="Atualizar agora" title="Atualizar agora">
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin motion-reduce:animate-none")} />
          </Button>
        </div>
      </header>

      <RealtimeCountdown data={data} />

      {stale && <div role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">Não foi possível atualizar. Exibindo a última leitura; tentaremos novamente automaticamente.</div>}

      <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { label: "Pessoas ao vivo", value: data.online, icon: Radio, hint: "Espectadores conectados agora", primary: true },
          { label: "No mapa", value: data.located, icon: MapPin, hint: "Com localização aproximada disponível" },
          { label: "Sem localização", value: data.unlocated, icon: MonitorPlay, hint: "Também incluídos no total ao vivo" }
        ].map(({ label, value, icon: Icon, hint, primary }) => (
          <section key={label} aria-label={label} className={cn(styles.surface, primary && styles.heroMetric)}>
            <div className={styles.metricLabel}><Icon className="h-3.5 w-3.5 text-[#538743] dark:text-[#B5D994]" /><h2>{label}</h2></div>
            <p className={styles.metricValue}>{fmt.format(value)}</p>
            <p className={styles.metricHint}>{hint}</p>
          </section>
        ))}
      </div>

      {data.audience && <AudienceSummary data={data.audience} period="Hoje" />}

      {data.funnel && <div className="space-y-2">
        <DashboardFunnel stages={data.funnel} />
        <p className="text-xs text-muted-foreground">Hoje · fuso horário do webinar · atualizado automaticamente com o painel.</p>
      </div>}

      <div className="grid min-w-0 grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-4">
          <section className="min-w-0 overflow-hidden rounded-2xl border border-border/70 bg-card shadow-[0_2px_8px_-5px_rgba(31,62,38,0.12)]" aria-label="Mapa ao vivo">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 px-4 py-3">
              <h2 className="text-[13px] font-semibold">Onde está o público agora</h2>
              <span className="text-xs text-muted-foreground">{fmt.format(data.located)} no mapa · localização aproximada</span>
            </div>
            <RealtimeMap locations={data.locations} />
          </section>
          <LocationsRanking data={data} />
        </div>
        <div className="min-w-0 space-y-4">
          <Devices data={data} />
          <div className={styles.surface}>
            <h2 className="text-[13px] font-semibold">Acompanhe cada espectador</h2>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">Veja quem está online, o tempo assistido e a interação com a oferta.</p>
            <Button asChild variant="outline" className="mt-3 h-[34px] w-full rounded-lg text-xs"><Link href={`/dashboard/online?webinarId=${webinarId}`}><Users className="h-4 w-4" /> Ver espectadores</Link></Button>
          </div>
          <p className="px-1 text-xs leading-relaxed text-muted-foreground">A presença é confirmada pela atividade do player nos últimos 45 segundos. Quem sai deixa de aparecer nas próximas atualizações.</p>
        </div>
      </div>
    </div>
  );
}
