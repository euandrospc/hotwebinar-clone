"use client";
import { useEffect, useRef } from "react";

interface TrackerProps {
  currentTimeRef: React.MutableRefObject<number>;
}

export function Tracker({ currentTimeRef }: TrackerProps) {
  const lastSentSec = useRef<number>(currentTimeRef.current);

  useEffect(() => {
    let cancelled = false;
    const id = setInterval(async () => {
      if (cancelled) return;
      if (document.visibilityState !== "visible") return;
      const now = currentTimeRef.current;
      const delta = Math.min(60, Math.max(0, Math.round(now - lastSentSec.current)));
      if (delta <= 0) return;
      try {
        await fetch("/api/track", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ videoSec: Math.round(now), watchedSecDelta: delta })
        });
        lastSentSec.current = now;
      } catch { /* swallow */ }
    }, 30_000);

    const onLeave = () => {
      const data = JSON.stringify({ videoSec: Math.round(currentTimeRef.current) });
      try {
        navigator.sendBeacon("/api/track-leave", new Blob([data], { type: "application/json" }));
      } catch { /* swallow */ }
    };
    window.addEventListener("beforeunload", onLeave);
    window.addEventListener("pagehide", onLeave);

    return () => {
      cancelled = true;
      clearInterval(id);
      window.removeEventListener("beforeunload", onLeave);
      window.removeEventListener("pagehide", onLeave);
    };
  }, [currentTimeRef]);

  return null;
}
