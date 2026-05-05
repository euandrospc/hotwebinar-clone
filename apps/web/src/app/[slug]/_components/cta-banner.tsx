"use client";
import { useEffect, useRef } from "react";
import type { PlayerCta } from "../_lib/public-types";

interface CtaBannerProps {
  ctas: PlayerCta[];
  currentTimeSec: number;
  primaryColor: string | null;
}

function pickActive(ctas: PlayerCta[], t: number): PlayerCta | null {
  const candidates = ctas.filter(
    (c) => t >= c.showAtSec && (c.hideAtSec == null || t < c.hideAtSec)
  );
  if (candidates.length === 0) return null;
  return candidates.reduce((best, c) => (c.showAtSec > best.showAtSec ? c : best));
}

export function CtaBanner({ ctas, currentTimeSec, primaryColor }: CtaBannerProps) {
  const active = pickActive(ctas, currentTimeSec);
  const seenRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!active) return;
    if (seenRef.current.has(active.id)) return;
    seenRef.current.add(active.id);
    void fetch("/api/cta-view", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ctaId: active.id })
    }).catch(() => { /* swallow */ });
  }, [active]);

  if (!active) return null;

  function onClick() {
    void fetch("/api/cta-click", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ctaId: active!.id })
    }).catch(() => { /* swallow */ });
    window.open(active!.url, "_blank", "noopener,noreferrer");
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="block w-full rounded-md px-6 py-4 text-center text-base font-semibold text-white shadow"
      style={{ backgroundColor: primaryColor ?? "#16a34a" }}
    >
      {active.label}
    </button>
  );
}
