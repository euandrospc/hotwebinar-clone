"use client";

import { useEffect, useState } from "react";
import { Radio } from "lucide-react";

const counts = new Map<string, number>();
const subscribers = new Set<() => void>();
let started = false;

function notify() {
  for (const fn of subscribers) fn();
}

async function poll() {
  try {
    const res = await fetch("/api/dashboard/online", { cache: "no-store" });
    if (!res.ok) return;
    const data = (await res.json()) as { byWebinar: Array<{ webinarId: string; online: number }> };
    counts.clear();
    for (const w of data.byWebinar) counts.set(w.webinarId, w.online);
    notify();
  } catch {}
}

function ensureStarted() {
  if (started) return;
  started = true;
  poll();
  setInterval(poll, 15000);
}

export function WebinarOnlineBadge({ webinarId }: { webinarId: string }) {
  const [, force] = useState(0);

  useEffect(() => {
    ensureStarted();
    const fn = () => force((n) => n + 1);
    subscribers.add(fn);
    return () => {
      subscribers.delete(fn);
    };
  }, []);

  const online = counts.get(webinarId) ?? 0;
  if (online === 0) return <span className="text-xs text-muted-foreground/60">—</span>;

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-500">
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-500" />
      </span>
      {online} online
    </span>
  );
}
