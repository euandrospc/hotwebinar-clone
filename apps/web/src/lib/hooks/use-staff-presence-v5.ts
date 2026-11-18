"use client";

import { useEffect } from "react";

/** Presence means an authenticated, open Attendance tab with a fresh heartbeat. */
export function useStaffPresenceV5() {
  useEffect(() => {
    const tabId = crypto.randomUUID();
    let active = true;
    let revision = 0;
    let writing = false;
    let disposed = false;
    let revoked = false;

    async function sync() {
      if (writing || revoked) return;
      writing = true;
      try {
        let applied: number;
        do {
          applied = revision;
          const controller = new AbortController();
          const timeout = window.setTimeout(() => controller.abort(), 4_000);
          try {
            const response = await fetch("/api/attendant/presence-v5", {
              method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin",
              body: JSON.stringify({ tabId, active }), cache: "no-store", keepalive: !active, signal: controller.signal,
            });
            if (response.status === 401 || response.status === 403) revoked = true;
          } catch { /* Expiry removes unreachable tabs; never report fabricated online users. */ }
          finally { window.clearTimeout(timeout); }
        } while (applied !== revision && !revoked);
      } finally { writing = false; }
    }

    // Background tabs still serve Attendance; only a page lifecycle exit releases them.
    const visibility = () => { if (active && !disposed) { revision += 1; void sync(); } };
    const leave = () => { active = false; revision += 1; void sync(); };
    const restore = () => { if (!disposed) { active = true; revision += 1; void sync(); } };
    void sync();
    const interval = window.setInterval(() => { if (active && !writing) void sync(); }, 15_000);
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pagehide", leave);
    window.addEventListener("pageshow", restore);
    return () => {
      disposed = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("pagehide", leave);
      window.removeEventListener("pageshow", restore);
      leave();
    };
  }, []);
}
