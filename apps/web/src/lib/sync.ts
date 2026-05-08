export type Phase = "before" | "open" | "closed";

export interface SyncWebinar {
  mode: "UNICO" | "JIT";
  startDate: Date | null;
  endDate: Date | null;
  videoSyncWithStart?: boolean;
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
  // Anchor = webinar start ONLY when sync is enabled in UNICO mode.
  // With sync OFF (or JIT mode) every lead starts fresh from their session.
  const useStartDateAnchor = w.mode === "UNICO" && w.videoSyncWithStart !== false && w.startDate;
  const anchor = useStartDateAnchor ? (w.startDate as Date) : lead.sessionStart;
  const diffSec = Math.floor((now.getTime() - anchor.getTime()) / 1000);
  if (diffSec <= 0) return 0;
  return Math.min(diffSec, videoDurationSec);
}
