"use client";

import { useEffect, useState } from "react";
// Same cadence as ONLINE_REFRESH_MS in lib/online (server-only module).
const ONLINE_REFRESH_MS = 15_000;

// One shared poll of /api/dashboard/online for every row and the live banner.
const counts = new Map<string, number>();
const subscribers = new Set<() => void>();
let polled = false;
let timer: ReturnType<typeof setInterval> | null = null;

async function poll() {
  try {
    const res = await fetch("/api/dashboard/online", { cache: "no-store" });
    if (!res.ok) return;
    const data = (await res.json()) as { byWebinar: Array<{ webinarId: string; online: number }> };
    // The endpoint only lists webinars with viewers, so an absent webinar means nobody is watching.
    counts.clear();
    for (const w of data.byWebinar) counts.set(w.webinarId, w.online);
    polled = true;
    for (const fn of subscribers) fn();
  } catch { /* Keep the last reading. */ }
}

/** Live "online now" count for a webinar; `initial` is the server snapshot until the first poll lands. */
export function useOnlineCount(webinarId: string, initial: number) {
  const [, force] = useState(0);
  useEffect(() => {
    const fn = () => force((n) => n + 1);
    subscribers.add(fn);
    if (!timer) timer = setInterval(poll, ONLINE_REFRESH_MS);
    return () => {
      subscribers.delete(fn);
      if (!subscribers.size && timer) { clearInterval(timer); timer = null; }
    };
  }, []);
  return polled ? counts.get(webinarId) ?? 0 : initial;
}
