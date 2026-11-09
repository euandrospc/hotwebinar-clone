"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Clock } from "@/components/icons";

interface OnlinePayload {
  online: number;
  byWebinar: Array<{ webinarId: string; title: string; online: number }>;
}

const POLL_MS = 15_000;

// Live "online now" count for the admin, polled from /api/dashboard/online.
// Reflects real player heartbeats (see /api/track), not the simulated audience.
export function OnlineNowCard({ webinarId, avgMinutes, compact = false, inline = false }: { webinarId?: string; avgMinutes?: number; compact?: boolean; inline?: boolean } = {}) {
  const [data, setData] = useState<OnlinePayload | null>(null);
  const [stale, setStale] = useState(false);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;

    async function tick() {
      try {
        const res = await fetch("/api/dashboard/online", { cache: "no-store" });
        if (res.ok && alive) {
          setData((await res.json()) as OnlinePayload);
          setStale(false);
        } else if (alive) {
          setStale(true);
        }
      } catch {
        if (alive) setStale(true);
      }
      if (alive) timer = setTimeout(tick, POLL_MS);
    }
    tick();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, []);

  const scoped = webinarId ? data?.byWebinar?.find((w) => w.webinarId === webinarId) : null;
  const online = webinarId ? (scoped?.online ?? 0) : (data?.online ?? 0);
  const top = webinarId ? [] : (data?.byWebinar?.slice(0, 3) ?? []);

  if (inline) return (
    <Link href={webinarId ? `/dashboard/webinars/${webinarId}/realtime` : "/dashboard/online"} className="inline-flex shrink-0 items-center gap-2 rounded-full border border-border/70 bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-emerald-50 hover:text-emerald-800 dark:hover:bg-emerald-950 dark:hover:text-emerald-300" title="Audiência atual, independente do período selecionado">
      <span className={`h-1.5 w-1.5 rounded-full ${stale ? "bg-amber-500" : online > 0 ? "bg-emerald-500" : "bg-muted-foreground/50"}`} />
      {stale ? "Reconectando…" : data ? `${online.toLocaleString("pt-BR")} ao vivo` : "Consultando audiência…"}
      <ArrowRight className="h-3 w-3" />
    </Link>
  );

  return (
    <section className={compact ? "flex flex-col" : "flex h-full flex-col rounded-2xl border border-border/80 bg-card p-6"}>
      <header className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold tracking-tight">Ao vivo agora</h2>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-medium ${stale ? "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300" : "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${stale ? "bg-amber-500" : "bg-emerald-600"}`} />
          {stale ? "Reconectando" : data ? "Tempo real" : "Conectando"}
        </span>
      </header>
      <div className="mt-5 flex items-baseline gap-3">
        <p className={`${compact ? "text-3xl" : "text-5xl"} font-medium tracking-tight tabular-nums`}>{data === null ? "—" : online.toLocaleString("pt-BR")}</p>
        <span className="text-xs text-muted-foreground">pessoas conectadas</span>
      </div>
      {top.length > 0 ? (
        <ul className="my-5 space-y-1">
          {top.map((w) => (
            <li key={w.webinarId}>
              <Link href={`/dashboard/webinars/${w.webinarId}/realtime`} className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 text-xs transition-colors hover:bg-emerald-50 dark:hover:bg-emerald-950">
                <span className="truncate text-muted-foreground">{w.title}</span>
                <span className="font-medium tabular-nums">{w.online}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="my-5 text-xs leading-relaxed text-muted-foreground">{data ? (online > 0 ? "Acompanhe a audiência desta transmissão." : "Nenhum espectador conectado neste momento.") : "Consultando a audiência dos seus webinars…"}</p>
      )}
      <div className="mt-auto border-t border-border/70 pt-4">
        {avgMinutes !== undefined && <div className="mb-4 flex items-center justify-between gap-3 text-xs"><span className="flex items-center gap-2 text-muted-foreground"><Clock className="h-4 w-4" />Tempo médio no período</span><span className="font-medium tabular-nums">{avgMinutes.toLocaleString("pt-BR")} min</span></div>}
        <Link href={webinarId ? `/dashboard/webinars/${webinarId}/realtime` : "/dashboard/online"} className="flex items-center justify-between rounded-md py-1 text-xs font-medium text-emerald-800 hover:text-emerald-600 dark:text-emerald-300">
          Acompanhar em tempo real <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}
