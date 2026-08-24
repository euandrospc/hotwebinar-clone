"use client";
import { useEffect, useState } from "react";
import { Radio } from "lucide-react";

interface OnlinePayload {
  online: number;
  byWebinar: Array<{ webinarId: string; title: string; online: number }>;
}

const POLL_MS = 15_000;

// Live "online now" count for the admin, polled from /api/dashboard/online.
// Reflects real player heartbeats (see /api/track), not the simulated audience.
export function OnlineNowCard() {
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

  const online = data?.online ?? 0;
  const top = data?.byWebinar?.slice(0, 3) ?? [];

  return (
    <div className="rounded-lg border bg-card p-5">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="relative inline-flex h-6 w-6 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <Radio className="h-3.5 w-3.5" />
          {online > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
            </span>
          )}
        </span>
        <span className="font-medium">Ao vivo agora</span>
        {stale && <span className="text-[10px] text-muted-foreground/60">(reconectando…)</span>}
      </div>
      <p className="mt-4 text-3xl font-semibold tabular-nums">
        {data === null ? "—" : online}
      </p>
      {top.length > 0 && (
        <ul className="mt-3 space-y-1">
          {top.map((w) => (
            <li key={w.webinarId} className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="truncate pr-2">{w.title}</span>
              <span className="tabular-nums">{w.online}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
