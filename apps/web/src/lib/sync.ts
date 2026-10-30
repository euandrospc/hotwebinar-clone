import { zonedParts, zonedToUtc } from "@/lib/timezones";

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

export interface RecurringWebinar {
  mode: "UNICO" | "JIT";
  startDate: Date | null;
  endDate: Date | null;
  recurring: boolean;
  recurringDays: number[];
  timezone: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * For a recurring UNICO webinar, swap startDate/endDate for the occurrence that is
 * running now or comes next: same local time as startDate, on recurringDays, never
 * before the first startDate. Non-recurring webinars are returned unchanged, so
 * every caller can run its webinar through this before computePhase/offsets.
 */
export function withOccurrence<T extends RecurringWebinar>(w: T, now: Date): T {
  if (w.mode !== "UNICO" || !w.recurring || !w.startDate || !w.endDate) return w;
  const durationMs = w.endDate.getTime() - w.startDate.getTime();
  const tz = !w.timezone || w.timezone === "__auto__" ? "America/Sao_Paulo" : w.timezone;
  const first = zonedParts(w.startDate, tz);
  const today = zonedParts(now < w.startDate ? w.startDate : now, tz);
  // Search from the first eligible date, even when the recurrence starts months ahead.
  // Include yesterday because a session can run past midnight.
  for (let k = -1; k <= 7; k++) {
    const day = new Date(Date.UTC(today.y, today.mo, today.d) + k * DAY_MS);
    if (!w.recurringDays.includes(day.getUTCDay())) continue;
    const start = zonedToUtc(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), first.h, first.mi, first.s, tz);
    if (start < w.startDate) continue;
    const end = new Date(start.getTime() + durationMs);
    if (end > now) return { ...w, startDate: start, endDate: end };
  }
  // No weekday selected (or none ahead): keep the original window, which closes it.
  return w;
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
