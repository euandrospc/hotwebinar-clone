"use client";
import { useEffect, useState } from "react";
import { simulateAudienceAt, type AudienceMode } from "@/lib/audience-sim";

interface Props {
  mode: AudienceMode;
  min: number;
  max: number;
  showLiveBadge: boolean;
  seed: string;
  durationSec: number;
  currentTimeRef: React.RefObject<number>;
}

const fmt = new Intl.NumberFormat("pt-BR");

export function AudienceBadge({
  mode,
  min,
  max,
  showLiveBadge,
  seed,
  durationSec,
  currentTimeRef,
}: Props) {
  const [count, setCount] = useState<number>(() =>
    mode === "NONE"
      ? 0
      : simulateAudienceAt(currentTimeRef.current ?? 0, durationSec, min, max, seed, mode)
  );

  useEffect(() => {
    if (mode === "NONE" || mode === "FIXED") return;
    const id = setInterval(() => {
      const t = currentTimeRef.current ?? 0;
      setCount(simulateAudienceAt(t, durationSec, min, max, seed, mode));
    }, 5000);
    return () => clearInterval(id);
  }, [mode, min, max, seed, durationSec, currentTimeRef]);

  if (mode === "NONE") return null;

  return (
    <div className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium">
      {showLiveBadge ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-red-600">
          <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" aria-hidden />
          AO VIVO
        </span>
      ) : null}
      <span className="tabular-nums">{fmt.format(count)} assistindo</span>
    </div>
  );
}
