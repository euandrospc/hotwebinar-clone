"use client";

import { useEffect, useRef, useState } from "react";
import { Globe, MapPin, MonitorPlay, Radio, RefreshCw, Smartphone } from "@/components/icons";
import { cn } from "@/lib/utils";
import type { WebinarRealtimeSnapshot } from "@/lib/webinar-realtime";
import { useRealtimeChannel } from "@/lib/hooks/use-realtime-channel";
import type { RealtimeStatus } from "@/lib/realtime-protocol";
import { RealtimeCountdown } from "./realtime-countdown";
import { AudienceSummary } from "@/components/dashboard/audience-summary";
import { DashboardFunnel } from "@/components/dashboard/dashboard-funnel";
import { RealtimeMap } from "./realtime-map";
import { AdminPageHeader } from "@/components/admin/admin-page";

const card = "min-w-0 rounded-2xl border border-[#1E241F] bg-[#0C0E0C]";

const REFRESH_MS = 15_000;
const REQUEST_TIMEOUT_MS = 10_000;
const fmt = new Intl.NumberFormat("pt-BR");
const deviceLabels = [
  { key: "desktop", label: "Computador", color: "#0E4A35" },
  { key: "mobile", label: "Celular", color: "#6FBF4A" },
  { key: "tablet", label: "Tablet", color: "#B6F09A" },
  { key: "unknown", label: "Não identificado", color: "#9AA39C" }
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
    <section className={cn(card, "flex flex-col gap-3.5 p-[18px]")} aria-label="Dispositivos online">
      <div className="flex items-center gap-2">
        <Smartphone className="h-3.5 w-3.5 text-[#C9D1CA]" aria-hidden="true" />
        <h2 className="text-[13px] font-semibold text-neutral-100">Dispositivos agora</h2>
      </div>
      <div className="relative mx-auto my-1.5 flex h-[90px] w-[90px] items-center justify-center rounded-full bg-[#1A1F1B]" style={data.online ? { background: `conic-gradient(${segments.join(",")})` } : undefined} aria-hidden="true">
        <div className="flex h-[76px] w-[76px] flex-col items-center justify-center rounded-full bg-[#0C0E0C]">
          <span className="text-lg font-semibold leading-tight tabular-nums text-neutral-100">{fmt.format(data.online)}</span>
          <span className="text-[10px] text-[#7C867E]">online</span>
        </div>
      </div>
      <ul className="space-y-3">
        {deviceLabels.map(({ key, label, color }) => (
          <li key={key} className="flex items-center justify-between gap-3 text-xs">
            <span className="flex items-center gap-2 text-neutral-100"><span className="h-2 w-2 rounded-full" style={{ background: color }} />{label}</span>
            <span className="whitespace-nowrap text-[11px] tabular-nums text-[#9AA39C]"><span>{fmt.format(data.devices[key])}</span><span className="ml-2">{data.online ? Math.round(data.devices[key] / data.online * 100) : 0}%</span></span>
          </li>
        ))}
      </ul>
      {data.online === 0 && <p className="text-[11px] text-[#7C867E]">A distribuição aparece quando alguém estiver assistindo.</p>}
    </section>
  );
}

function LocationsRanking({ data }: { data: WebinarRealtimeSnapshot }) {
  return (
    <section className={cn(card, "flex flex-col gap-3.5 p-[18px]")} aria-label="Localizações online">
      <div className="flex items-center gap-2"><Globe className="h-3.5 w-3.5 text-[#C9D1CA]" aria-hidden="true" /><h2 className="text-[13px] font-semibold text-neutral-100">De onde estão assistindo</h2></div>
      <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
        {[
          { title: "Cidades", rows: data.topCities },
          { title: "Países", rows: data.topCountries.map(({ code, count }) => ({ label: countryName(code), count })) }
        ].map(({ title, rows }) => (
          <div key={title}>
            <h3 className="mb-2 text-xs font-normal text-[#9AA39C]">{title}</h3>
            {rows.length ? <ul className="space-y-2">{rows.map((row) => <li key={row.label} className="flex justify-between gap-3 text-xs text-neutral-100"><span className="truncate">{row.label}</span><span className="tabular-nums text-[#9AA39C]">{fmt.format(row.count)}</span></li>)}</ul> : <p className="text-xs text-[#6E776F]">Sem localizações disponíveis.</p>}
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

  const live = stale ? "Reconectando…" : status === "connected" ? "Conectado ao vivo" : "Atualização automática";

  return (
    <div className="min-w-0 space-y-7 font-palco">
      <AdminPageHeader
        title="Tempo real"
        description={title}
        actions={<div className="flex items-center gap-3">
          <div className="flex flex-col items-end gap-1 text-right" role="status">
            <p className={cn("flex items-center gap-1.5 text-xs font-semibold", stale ? "text-[#F5B742]" : "text-palco")}>
              <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />{live}
            </p>
            <p className="text-[11px] text-[#7C867E]">{status === "connected" ? "Última leitura" : "A cada 15 s"} · <time dateTime={data.updatedAt} suppressHydrationWarning>{new Date(data.updatedAt).toLocaleTimeString("pt-BR")}</time></p>
          </div>
          <button type="button" className="inline-flex h-[34px] w-[34px] items-center justify-center rounded-[10px] border border-[#1E241F] text-[#C9D1CA] transition-colors hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-palco disabled:opacity-60 motion-reduce:transition-none" onClick={() => refresh.current()} disabled={refreshing} aria-label="Atualizar agora" title="Atualizar agora">
            <RefreshCw aria-hidden="true" className={cn("h-3.5 w-3.5", refreshing && "animate-spin motion-reduce:animate-none")} />
          </button>
        </div>}
      />

      {stale && <div role="alert" className="rounded-xl border border-[#F5B742]/30 bg-[#F5B742]/10 p-3 text-sm text-[#F5B742]">Não foi possível atualizar. Exibindo a última leitura; tentaremos novamente automaticamente.</div>}

      {/* Mobile flattens both columns so the map comes right after the counters. */}
      <div className="flex min-w-0 flex-col gap-3 lg:grid lg:grid-cols-[minmax(0,1.23fr)_minmax(0,1fr)] lg:items-start lg:gap-4">
        <div className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-3">
          <div className="grid min-w-0 grid-cols-2 gap-2.5 sm:grid-cols-3">
            {[
              { label: "Pessoas ao vivo", value: data.online, icon: Radio, hint: "Espectadores conectados agora", primary: true },
              { label: "No mapa", value: data.located, icon: MapPin, hint: "Com localização aproximada disponível" },
              { label: "Sem localização", value: data.unlocated, icon: MonitorPlay, hint: "Também incluídos no total ao vivo" }
            ].map(({ label, value, icon: Icon, hint, primary }) => (
              <section key={label} aria-label={label} className={cn("flex min-w-0 flex-col gap-2 rounded-2xl border p-3.5", primary ? "col-span-2 border-palco/25 bg-[linear-gradient(135deg,#1E6B47,#0E3826)] sm:col-span-1" : "border-[#1E241F] bg-[#0C0E0C]")}>
                <div className="flex items-center gap-1.5"><Icon aria-hidden="true" className={cn("h-3 w-3 shrink-0", primary ? "text-[#B6F09A]" : "text-[#7C867E]")} /><h2 className={cn("min-w-0 text-[11px] font-normal", primary ? "text-[#DDF7D0]" : "text-[#9AA39C]")}>{label}</h2></div>
                <p className="text-[22px] font-semibold leading-tight tabular-nums text-neutral-100">{fmt.format(value)}</p>
                <p className={cn("text-[10px] leading-snug", primary ? "text-[#B6F09A]" : "text-[#6E776F]")}>{hint}</p>
              </section>
            ))}
          </div>

          <div className="order-2 min-w-0 empty:hidden"><RealtimeCountdown data={data} /></div>

          {data.audience && <div className="order-3 min-w-0 [&>section]:gap-3.5 [&>section]:p-[18px]"><AudienceSummary data={data.audience} period="Hoje" /></div>}

          {data.funnel && <div className="order-4 min-w-0"><DashboardFunnel stages={data.funnel} /></div>}

          <div className="order-5 min-w-0"><Devices data={data} /></div>
        </div>

        <div className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-4">
          <section className="relative order-1 h-[360px] min-w-0 overflow-hidden rounded-2xl border border-[#1E241F] bg-[#0C0E0C] sm:h-[460px] lg:h-[660px]" aria-label="Mapa ao vivo">
            <RealtimeMap locations={data.locations} />
          </section>
          <div className="order-6 min-w-0"><LocationsRanking data={data} /></div>
        </div>
      </div>
    </div>
  );
}
