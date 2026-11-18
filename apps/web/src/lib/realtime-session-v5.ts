import type { WebinarRealtimeSnapshot } from "@/lib/webinar-realtime-v5";

export type RealtimeSessionMilestoneId = "start" | "pitch" | "offer" | "end";
export type RealtimeSessionMilestoneState = "upcoming" | "reached" | "unavailable" | "disabled" | "per-viewer" | "closed";
export type RealtimeSessionPhase = "upcoming" | "live" | "ended" | "individual" | "unavailable";

export interface RealtimeSessionMilestone {
  id: RealtimeSessionMilestoneId;
  label: string;
  at: number | null;
  state: RealtimeSessionMilestoneState;
  secondsRemaining: number | null;
  detail: string;
}

export interface RealtimeSessionModel {
  phase: RealtimeSessionPhase;
  milestones: RealtimeSessionMilestone[];
  nextId: RealtimeSessionMilestoneId | null;
  /** Elapsed fraction of the configured global start/end window, when known. */
  progress: number | null;
}

type Schedule = WebinarRealtimeSnapshot["schedule"] | null;
const MAX_TIMESTAMP = 8_640_000_000_000_000;
const labels: Record<RealtimeSessionMilestoneId, string> = {
  start: "Start", pitch: "Pitch", offer: "Offer", end: "End",
};

function timestamp(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function validOffset(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function offsetTimestamp(start: number, seconds: number): number | null {
  const at = start + seconds * 1_000;
  return Number.isSafeInteger(at) && Math.abs(at) <= MAX_TIMESTAMP ? at : null;
}

function milestone(
  id: RealtimeSessionMilestoneId,
  state: RealtimeSessionMilestoneState,
  detail: string,
  at: number | null = null,
  secondsRemaining: number | null = null,
): RealtimeSessionMilestone {
  return { id, label: labels[id], state, detail, at, secondsRemaining };
}

function timedMilestone(id: RealtimeSessionMilestoneId, at: number, now: number, reached: string) {
  return now < at
    ? milestone(id, "upcoming", "Upcoming", at, Math.ceil((at - now) / 1_000))
    : milestone(id, "reached", reached, at, 0);
}

function unavailableModel(detail = "Schedule unavailable"): RealtimeSessionModel {
  return {
    phase: "unavailable",
    milestones: (["start", "pitch", "offer", "end"] as const).map(id => milestone(id, "unavailable", detail)),
    nextId: null,
    progress: null,
  };
}

/** Keep hours unbounded: sessions longer than a day must not wrap to 00. */
export function formatCountdown(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) return "—";
  const total = Math.max(0, Math.ceil(seconds));
  const hours = Math.floor(total / 3_600);
  const minutes = Math.floor(total % 3_600 / 60);
  const remainder = total % 60;
  return [hours, minutes, remainder].map(value => String(value).padStart(2, "0")).join(":");
}

/**
 * The server already resolves recurring occurrences. This adapter only reads
 * that frozen schedule and never invents a shared clock for individual playback.
 */
export function buildRealtimeSession(schedule: Schedule, nowMs: number): RealtimeSessionModel {
  if (!schedule || !Number.isFinite(nowMs) || Math.abs(nowMs) > MAX_TIMESTAMP
    || (schedule.mode !== "UNICO" && schedule.mode !== "JIT")) return unavailableModel();

  const start = timestamp(schedule.startDate);
  const end = timestamp(schedule.endDate);
  if (schedule.mode === "UNICO" && start !== null && end !== null && end <= start) {
    return unavailableModel("Invalid session window");
  }
  const ended = end !== null && nowMs >= end;
  const globalPlayback = schedule.mode === "UNICO" && schedule.videoSyncWithStart;
  const beforeStart = schedule.mode === "UNICO" && start !== null && nowMs < start;
  const phase: RealtimeSessionPhase = ended ? "ended"
    : beforeStart ? "upcoming"
      : schedule.mode === "JIT" || !schedule.videoSyncWithStart ? "individual"
        : start === null ? "unavailable" : "live";

  const startMilestone = schedule.mode === "JIT"
    ? milestone("start", "per-viewer", "Per viewer")
    : start === null
      ? milestone("start", "unavailable", schedule.startDate ? "Invalid start time" : "Not configured")
      : timedMilestone("start", start, nowMs, "Started");

  function playbackMilestone(id: "pitch" | "offer", offset: number): RealtimeSessionMilestone {
    if (!globalPlayback) return milestone(id, ended ? "closed" : "per-viewer", ended ? "Session ended" : "Per viewer");
    if (start === null) return milestone(id, "unavailable", "Start time unavailable");
    const at = offsetTimestamp(start, offset);
    if (at === null) return milestone(id, "unavailable", "Invalid time");
    // The public session closes at end, so a milestone exactly at end never runs.
    if (end !== null && at >= end) return milestone(id, "unavailable", "Outside session", at);
    return timedMilestone(id, at, nowMs, id === "pitch" ? "Reached" : "Open");
  }

  const pitchMilestone = schedule.pitchAtSec === null
    ? milestone("pitch", "unavailable", "Not configured")
    : !validOffset(schedule.pitchAtSec)
      ? milestone("pitch", "unavailable", "Invalid time")
      : playbackMilestone("pitch", schedule.pitchAtSec);
  const { offerDisabled, offerShowAtSec, offerHideAtSec } = schedule;

  function offerMilestone(): RealtimeSessionMilestone {
    if (offerDisabled) return milestone("offer", "disabled", "Disabled");
    const show = offerShowAtSec ?? 0;
    const hide = offerHideAtSec;
    if (!validOffset(show) || (hide != null && !validOffset(hide))) return milestone("offer", "unavailable", "Invalid offer window");
    if (hide != null && hide <= show) return milestone("offer", "unavailable", hide === show ? "No offer window" : "Invalid offer window");
    const opening = playbackMilestone("offer", show);
    if (opening.state === "unavailable" || opening.state === "per-viewer" || opening.state === "closed") return opening;
    if (ended) return milestone("offer", "closed", "Session ended", opening.at);
    if (start !== null && hide != null) {
      const hideAt = offsetTimestamp(start, hide);
      if (hideAt === null) return milestone("offer", "unavailable", "Invalid offer window");
      if (nowMs >= hideAt) return milestone("offer", "closed", "Closed", opening.at);
    }
    return opening;
  }

  const endMilestone = end === null
    ? milestone("end", "unavailable", schedule.endDate ? "Invalid end time" : "Not configured")
    : timedMilestone("end", end, nowMs, "Ended");
  const milestones = [startMilestone, pitchMilestone, offerMilestone(), endMilestone];
  const next = ended ? undefined : milestones
    .filter(item => item.state === "upcoming" && item.at !== null)
    .reduce<RealtimeSessionMilestone | undefined>((first, item) => !first || item.at! < first.at! ? item : first, undefined);

  return {
    phase,
    milestones,
    nextId: next?.id ?? null,
    progress: schedule.mode === "UNICO" && start !== null && end !== null
      ? Math.min(1, Math.max(0, (nowMs - start) / (end - start))) : null,
  };
}
