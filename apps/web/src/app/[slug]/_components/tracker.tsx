"use client";
import { useEffect, useRef } from "react";
import { useRealtimeChannel } from "@/lib/hooks/use-realtime-channel";

interface TrackerProps {
  currentTimeRef: React.MutableRefObject<number>;
  leadId: string;
}

export function Tracker({ currentTimeRef, leadId }: TrackerProps) {
  const lastSentSec = useRef<number>(currentTimeRef.current);
  const presence = useRef({ videoSec: currentTimeRef.current, lastProgressAt: 0, lastSentAt: 0, active: false });
  const { status, emitPresence } = useRealtimeChannel({ kind: "lead", clientKey: leadId }, () => {}, () => {
    presence.current.lastSentAt = 0;
  });
  const realtimeStatus = useRef(status);
  realtimeStatus.current = status;

  useEffect(() => {
    const signal = () => {
      const state = presence.current;
      const now = Date.now();
      if (currentTimeRef.current > state.videoSec) state.lastProgressAt = now;
      state.videoSec = currentTimeRef.current;
      const active = !document.hidden && state.lastProgressAt > 0 && now - state.lastProgressAt < 4_000;
      if (active !== state.active || (active && now - state.lastSentAt >= 15_000)) {
        emitPresence(active);
        state.lastSentAt = now;
      }
      state.active = active;
    };
    const timer = setInterval(signal, 1_000);
    document.addEventListener("visibilitychange", signal);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", signal);
      emitPresence(false);
    };
  }, [currentTimeRef, emitPresence]);

  useEffect(() => {
    let cancelled = false;
    const id = setInterval(async () => {
      if (cancelled) return;
      if (document.visibilityState !== "visible") return;
      const now = currentTimeRef.current;
      const delta = Math.min(60, Math.max(0, Math.round(now - lastSentSec.current)));
      if (delta <= 0) return;
      try {
        const res = await fetch("/api/track", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ videoSec: Math.round(now), watchedSecDelta: delta, presenceTransport: realtimeStatus.current === "connected" ? "websocket" : "http" })
        });
        // 429 (throttled) didn't record the delta: keep it for the next tick.
        if (res.ok) lastSentSec.current = now;
      } catch { /* swallow */ }
    }, 30_000);

    const onLeave = () => {
      emitPresence(false);
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
  }, [currentTimeRef, emitPresence]);

  return null;
}
