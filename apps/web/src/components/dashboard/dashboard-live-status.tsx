"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const POLL_MS = 15_000;
const number = new Intl.NumberFormat("pt-BR");

/** "Sala ao vivo · N assistindo agora" line above the dashboard title, polled like the realtime preview. */
export function DashboardLiveStatus({ webinarId, demoOnline }: { webinarId?: string; demoOnline?: number }) {
  const [count, setCount] = useState<number | null>(demoOnline ?? null);
  useEffect(() => {
    if (demoOnline !== undefined) return;
    let cancelled = false;
    async function load() {
      try {
        const endpoint = webinarId ? `/api/dashboard/online?${new URLSearchParams({ webinarId })}` : "/api/dashboard/online";
        const response = await fetch(endpoint, { cache: "no-store" });
        if (!response.ok) return;
        const payload = await response.json() as { online: number; byWebinar: Array<{ webinarId: string; online: number }> };
        // The endpoint only lists webinars with viewers, so an absent webinar means nobody is watching.
        if (!cancelled) setCount(webinarId ? payload.byWebinar.find(row => row.webinarId === webinarId)?.online ?? 0 : payload.online);
      } catch { /* Keep the last reading. */ }
    }
    void load();
    const timer = setInterval(load, POLL_MS);
    return () => { cancelled = true; clearInterval(timer); };
  }, [webinarId, demoOnline]);

  const live = (count ?? 0) > 0;
  return <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-neutral-500" aria-live="polite">
    <span className={cn("size-2 rounded-full", live ? "animate-pulse bg-palco motion-reduce:animate-none" : "bg-neutral-600")} aria-hidden="true" />
    {count === null ? "Carregando audiência…" : `${live ? "Sala ao vivo" : "Sala pausada"} · ${number.format(count)} assistindo agora`}
  </p>;
}
