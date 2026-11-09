"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight } from "@/components/icons";
import { AreaChart, type TooltipProps } from "@/components/tremor/area-chart";
import type { RealtimeAudienceHistory } from "@/lib/dashboard-realtime-preview";

interface Props {
  webinarId?: string;
  demoOnline?: number;
  demoHistory?: RealtimeAudienceHistory;
  href?: string;
}

interface OnlinePayload {
  online: number;
  byWebinar: Array<{ webinarId: string; online: number }>;
  audience?: RealtimeAudienceHistory;
}

type Connection = "loading" | "ready" | "error";
const POLL_MS = 15_000;
const number = new Intl.NumberFormat("pt-BR");
const decimal = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const clock = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", second: "2-digit" });
const validCount = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

function validHistory(value: RealtimeAudienceHistory | undefined): boolean {
  if (value === undefined) return true;
  return value !== null && value.windowMinutes === 60 && validCount(value.sampleCount)
    && (value.average === null || (Number.isFinite(value.average) && value.average >= 0))
    && (value.peak === null || validCount(value.peak))
    && (value.from === undefined || (typeof value.from === "string" && Number.isFinite(Date.parse(value.from))))
    && (value.to === undefined || (typeof value.to === "string" && Number.isFinite(Date.parse(value.to))))
    && Array.isArray(value.points) && value.points.length === value.sampleCount
    && value.points.every((point) => point && typeof point.at === "string" && Number.isFinite(Date.parse(point.at)) && validCount(point.online));
}

function validPayload(value: unknown): value is OnlinePayload {
  if (!value || typeof value !== "object") return false;
  const payload = value as Partial<OnlinePayload>;
  return validCount(payload.online) && Array.isArray(payload.byWebinar) && payload.byWebinar.every((row) =>
    row && typeof row.webinarId === "string" && validCount(row.online)
  ) && validHistory(payload.audience);
}

export function AudienceHistoryTooltip({ active, payload }: TooltipProps) {
  const point = payload?.[0];
  const observedAt: unknown = point?.payload?.observedAt;
  if (!active || !point || !validCount(point.value) || typeof observedAt !== "string" || !Number.isFinite(Date.parse(observedAt))) return null;

  return (
    <div role="tooltip" className="pointer-events-none w-44 rounded-xl border border-border/70 bg-card px-3.5 py-3 text-foreground shadow-lg shadow-black/[0.07]">
      <p className="text-[10px] text-muted-foreground"><time dateTime={observedAt}>{clock.format(new Date(observedAt))}</time> · Brasília</p>
      <div className="mt-1.5 flex items-baseline gap-1.5"><span className="text-lg font-semibold tabular-nums tracking-tight">{number.format(point.value)}</span><span className="text-xs text-muted-foreground">{point.value === 1 ? "pessoa" : "pessoas"}</span></div>
      <p className="mt-0.5 text-[10px] text-muted-foreground">assistindo nesse momento</p>
    </div>
  );
}

function LiveIndicator({ active, connection }: { active: boolean; connection: Connection }) {
  const reducedMotion = useReducedMotion();
  return (
    <span aria-hidden="true" className={`relative flex size-4 shrink-0 items-center justify-center ${connection === "error" ? "text-amber-600" : connection === "ready" ? "text-emerald-600" : "text-muted-foreground/50"}`}>
      <motion.span className="pointer-events-none absolute inset-0 rounded-full border-[1.25px] border-current border-y-transparent"
        initial={{ opacity: 0.45 }}
        animate={active && !reducedMotion ? { opacity: [0.3, 0.75, 0.3] } : { opacity: 0.45 }}
        transition={active && !reducedMotion ? { duration: 2.8, repeat: Infinity, ease: "easeInOut" } : { duration: 0 }} />
      <span className="absolute inset-[3.5px] rounded-full border-[1.25px] border-current border-y-transparent opacity-80" />
      <span className="size-[3px] rounded-full bg-current" />
    </span>
  );
}

function AudienceSparkline({ history, demo }: { history: RealtimeAudienceHistory | null; demo: boolean }) {
  const hintId = useId();
  // Fixed time slots preserve the actual spacing of observations. A missing
  // recorder interval stays null instead of becoming zero or a synthetic point.
  const cadence = demo ? 120_000 : 15_000;
  const last = history?.points.at(-1);
  const end = history?.to ? Date.parse(history.to) : last ? Date.parse(last.at) : 0;
  const start = end - 3_600_000;
  const points = Array.from({ length: 3_600_000 / cadence + 1 }, (_, index) => ({
    at: String(start + index * cadence), audience: null as number | null, observedAt: null as string | null
  }));
  for (const point of history?.points ?? []) {
    const index = Math.round((Date.parse(point.at) - start) / cadence);
    if (index >= 0 && index < points.length) {
      points[index].audience = point.online;
      points[index].observedAt = point.at;
    }
  }

  return (
    <div role="group" aria-label="Histórico de audiência" aria-describedby={hintId} className="mx-1 h-8 w-12 shrink-0 [@container(min-width:580px)]:w-24 [@container(min-width:800px)]:w-32">
      {history && history.points.length > 1 ? (
        <AreaChart data={points} index="at" categories={["audience"]} colors={["forest"]}
          aria-label="Audiência nos últimos 60 minutos" aria-describedby={hintId}
          className="h-8 w-full [&_.recharts-surface]:rounded [&_.recharts-surface]:outline-none [&_.recharts-surface:focus-visible]:ring-2 [&_.recharts-surface:focus-visible]:ring-emerald-600" minValue={0} maxValue={Math.max(1, ...history.points.map((point) => point.online))}
          showXAxis={false} showYAxis={false} showGridLines={false} showLegend={false}
          showTooltip customTooltip={AudienceHistoryTooltip} tooltipPosition={{ y: 38 }} tooltipAllowEscapeViewBox={{ x: true, y: true }}
          yAxisWidth={0} connectNulls={false} curveType="monotone" accessibilityLayer />
      ) : <span className="flex h-full items-center justify-center text-[10px] text-muted-foreground/70"><span className="hidden [@container(min-width:580px)]:inline">{history?.sampleCount === 1 ? "1 leitura" : "Sem histórico"}</span><span className="[@container(min-width:580px)]:hidden">—</span></span>}
      <span id={hintId} className="sr-only">Últimos 60 minutos. Passe o mouse, toque ou use as setas no gráfico para consultar o horário e a audiência registrada. Escape fecha os detalhes.</span>
    </div>
  );
}

function PreviewLink({ count, history = null, connection, href, demo = false }: { count: number | null; history?: RealtimeAudienceHistory | null; connection: Connection; href: string; demo?: boolean }) {
  const historyId = useId();
  const formatted = count === null ? "—" : number.format(count);
  const people = count === 1 ? "pessoa assistindo agora" : "pessoas assistindo agora";
  const status = connection === "loading" ? "Conectando" : connection === "error" ? "Sem conexão" : null;
  const description = connection === "ready"
    ? `${formatted} ${people}`
    : status + (count === null ? "" : `; última leitura: ${formatted} ${people}`);
  const historyDescription = history?.sampleCount
    ? `Últimos 60 min: média ${history.average === null ? "indisponível" : decimal.format(history.average)}; pico ${history.peak === null ? "indisponível" : number.format(history.peak)}. ${number.format(history.sampleCount)} leituras registradas.`
    : "Sem histórico de audiência nos últimos 60 min.";
  const title = (demo
    ? "Prévia local. O painel completo mostra a audiência real, independente do período selecionado."
    : connection === "error"
    ? "Sem conexão. Última leitura desatualizada. Audiência atual independente do período selecionado."
    : "Audiência atual, independente do período selecionado.") + " " + historyDescription;

  return (
    <div className="inline-flex h-10 shrink-0 items-center gap-2 text-foreground">
      <Link href={href} aria-label={`Abrir tempo real: ${description}`} aria-describedby={historyId} title={title}
        className="inline-flex h-10 items-center gap-2 rounded-lg outline-none transition-colors hover:text-emerald-800 focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-4">
      <LiveIndicator active={connection === "ready" && count !== null && count > 0} connection={connection} />
      <span aria-live="polite" className="inline-flex items-baseline gap-1.5">
        <span className="text-base font-semibold tabular-nums tracking-tight sm:text-xl">{formatted}</span>
        <span className="hidden text-xs font-normal text-muted-foreground [@container(min-width:800px)]:inline">
          {status ?? "assistindo agora"}
        </span>
      </span>
      </Link>
      <AudienceSparkline history={history} demo={demo} />
      <span className="hidden items-center gap-4 text-xs [@container(min-width:580px)]:inline-flex">
        <span className="flex items-baseline gap-1.5"><span className="text-muted-foreground">Média</span><span className="font-medium tabular-nums">{history?.average == null ? "—" : decimal.format(history.average)}</span></span>
        <span className="flex items-baseline gap-1.5"><span className="text-muted-foreground">Pico</span><span className="font-medium tabular-nums">{history?.peak == null ? "—" : number.format(history.peak)}</span></span>
      </span>
      <span id={historyId} className="sr-only">{historyDescription}</span>
      <Link href={href} aria-label="Ver painel de tempo real" className="hidden size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-emerald-50 hover:text-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 [@container(min-width:580px)]:inline-flex"><ArrowUpRight aria-hidden="true" className="size-3.5" /></Link>
    </div>
  );
}

function LivePreview({ webinarId, href }: { webinarId?: string; href: string }) {
  const [count, setCount] = useState<number | null>(null);
  const [history, setHistory] = useState<RealtimeAudienceHistory | null>(null);
  const [connection, setConnection] = useState<Connection>("loading");

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;

    async function refresh() {
      controller = new AbortController();
      try {
        const endpoint = webinarId ? `/api/dashboard/online?${new URLSearchParams({ webinarId })}` : "/api/dashboard/online";
        const response = await fetch(endpoint, { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("Audience request failed");
        const payload: unknown = await response.json();
        if (!validPayload(payload)) throw new Error("Invalid audience response");
        if (!active) return;
        // This endpoint only includes webinars with online viewers, so an absent
        // webinar means zero only after a successful, validated response.
        setCount(webinarId ? payload.byWebinar.find((row) => row.webinarId === webinarId)?.online ?? 0 : payload.online);
        setHistory(payload.audience ?? null);
        setConnection("ready");
      } catch {
        if (active) setConnection("error");
      } finally {
        if (active) timer = setTimeout(refresh, POLL_MS);
      }
    }

    void refresh();
    return () => {
      active = false;
      clearTimeout(timer);
      controller?.abort();
    };
  }, [webinarId]);

  return <PreviewLink count={count} history={history} connection={connection} href={href} />;
}

export function DashboardRealtimePreview({ webinarId, demoOnline, demoHistory, href }: Props) {
  const target = href ?? (webinarId ? `/dashboard/webinars/${encodeURIComponent(webinarId)}/realtime` : "/dashboard/online");
  if (demoOnline !== undefined) {
    return <PreviewLink count={validCount(demoOnline) ? demoOnline : null} history={demoHistory} connection={validCount(demoOnline) ? "ready" : "error"} href={target} demo />;
  }
  // Remount on scope changes so a previous webinar's count never flashes as the
  // newly selected webinar, and entering demo mode cancels the live request.
  return <LivePreview key={webinarId ?? "all"} webinarId={webinarId} href={target} />;
}
