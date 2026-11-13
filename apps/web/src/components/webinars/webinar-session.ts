import { computePhase, withOccurrence, type RecurringWebinar } from "@/lib/sync";
import { AUTO_TIMEZONE_VALUE, zonedParts } from "@/lib/timezones";

export type WebinarState = "live" | "scheduled" | "paused" | "ended";
export type SessionWebinar = RecurringWebinar & { status: "DRAFT" | "ACTIVE" | "ARCHIVED" };

export interface SessionInfo {
  state: WebinarState;
  /** Occurrence running now or coming next (recurring webinars resolved by withOccurrence). */
  start: Date | null;
  end: Date | null;
}

/** Same phase rule as the public page: only ACTIVE webinars can be live or scheduled. */
export function sessionInfo(w: SessionWebinar, now: Date): SessionInfo {
  const occ = withOccurrence(w, now);
  const base = { start: occ.startDate, end: occ.endDate };
  if (w.status !== "ACTIVE") return { state: "paused", ...base };
  const phase = computePhase(occ, now);
  return { state: phase === "open" ? "live" : phase === "before" ? "scheduled" : "ended", ...base };
}

const tzOf = (tz: string) => (!tz || tz === AUTO_TIMEZONE_VALUE ? "America/Sao_Paulo" : tz);

/** "2h 10min", "45min", "3d 4h". */
export function formatSpan(ms: number) {
  const totalMin = Math.max(0, Math.floor(ms / 60_000));
  const d = Math.floor(totalMin / 1440), h = Math.floor((totalMin % 1440) / 60), m = totalMin % 60;
  if (d) return h ? `${d}d ${h}h` : `${d}d`;
  if (h) return m ? `${h}h ${m}min` : `${h}h`;
  return `${m}min`;
}

export function formatTime(d: Date, tz: string) {
  const p = zonedParts(d, tzOf(tz));
  return `${String(p.h).padStart(2, "0")}:${String(p.mi).padStart(2, "0")}`;
}

/** "Hoje", "Amanhã", "Ontem" or "dd/MM" in the webinar timezone. */
export function formatDay(d: Date, tz: string, now: Date) {
  const a = zonedParts(d, tzOf(tz)), b = zonedParts(now, tzOf(tz));
  const diff = Math.round((Date.UTC(a.y, a.mo, a.d) - Date.UTC(b.y, b.mo, b.d)) / 86_400_000);
  if (diff === 0) return "Hoje";
  if (diff === 1) return "Amanhã";
  if (diff === -1) return "Ontem";
  return `${String(a.d).padStart(2, "0")}/${String(a.mo + 1).padStart(2, "0")}${a.y !== b.y ? `/${a.y}` : ""}`;
}
