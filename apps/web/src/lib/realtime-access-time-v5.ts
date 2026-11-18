import { buildRealtimeAudiencePoints, buildRealtimeKpis, type RealtimeKpiPoint } from "@/lib/realtime-kpis-v5";
import type { WebinarRealtimeSnapshot } from "@/lib/webinar-realtime-v5";

export interface RealtimeAccessTimeV5Data {
  points: RealtimeKpiPoint[];
  /** Full session window, including the portion that has not happened yet. */
  range: { from: number; to: number } | null;
  /** Shared playback start; never a viewer's individual watch duration. */
  sessionStart: number | null;
  context: "Session" | "Today";
  phase: "upcoming" | "live" | "ended" | "individual" | "unavailable";
}

/** Session access monitoring is separate from the daily Audience KPI. */
export function buildRealtimeAccessTimeV5(snapshot: WebinarRealtimeSnapshot | null): RealtimeAccessTimeV5Data {
  const empty: RealtimeAccessTimeV5Data = {
    points: [], range: null, sessionStart: null, context: "Today", phase: "unavailable",
  };
  if (!snapshot) return empty;
  const cutoff = Date.parse(snapshot.updatedAt);
  if (!Number.isFinite(cutoff)) return empty;
  const schedule = snapshot.schedule;
  const from = Date.parse(schedule?.startDate ?? "");
  const to = Date.parse(schedule?.endDate ?? "");
  if (schedule?.mode === "UNICO" && schedule.videoSyncWithStart
    && Number.isFinite(from) && Number.isFinite(to) && to > from) {
    const history = snapshot.audience?.sessionHistory ?? snapshot.audience?.history;
    return {
      points: buildRealtimeAudiencePoints(history, from, Math.min(cutoff, to)),
      range: { from, to },
      sessionStart: from,
      context: "Session",
      phase: cutoff < from ? "upcoming" : cutoff >= to ? "ended" : "live",
    };
  }
  const individualPlayback = schedule && (schedule.mode === "JIT" || !schedule.videoSyncWithStart);
  const validWindow = schedule?.mode !== "UNICO" || !Number.isFinite(from) || !Number.isFinite(to) || to > from;
  const individualPhase = !validWindow ? "unavailable"
    : Number.isFinite(to) && cutoff >= to ? "ended"
      : schedule?.mode === "UNICO" && Number.isFinite(from) && cutoff < from ? "upcoming" : "individual";
  return {
    ...empty,
    points: buildRealtimeKpis(snapshot).audience.points,
    phase: individualPlayback ? individualPhase : "unavailable",
  };
}
