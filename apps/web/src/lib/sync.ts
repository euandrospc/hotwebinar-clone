export type Phase = "before" | "open" | "closed";

export interface SyncWebinar {
  mode: "UNICO" | "JIT";
  startDate: Date | null;
  endDate: Date | null;
}

export interface SyncLead {
  sessionStart: Date;
}

export function computePhase(w: SyncWebinar, now: Date): Phase {
  // endDate hard-closes BOTH modes (UNICO + JIT) once it passes.
  if (w.endDate && now >= w.endDate) return "closed";
  if (w.mode !== "UNICO") return "open";
  if (!w.startDate) return "open";
  if (now < w.startDate) return "before";
  return "open";
}

export function computeInitialOffset(
  w: SyncWebinar,
  lead: SyncLead,
  now: Date,
  videoDurationSec: number | null
): number {
  if (videoDurationSec == null || videoDurationSec <= 0) return 0;
  const anchor = w.mode === "UNICO" && w.startDate ? w.startDate : lead.sessionStart;
  const diffSec = Math.floor((now.getTime() - anchor.getTime()) / 1000);
  if (diffSec <= 0) return 0;
  return Math.min(diffSec, videoDurationSec);
}
