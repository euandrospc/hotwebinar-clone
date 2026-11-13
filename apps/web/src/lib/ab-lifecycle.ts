import type { AbExperimentDto } from "./ab-tests";
import { zonedParts, zonedToUtc } from "./timezones";

export type AbCollectionPhase = "SCHEDULED" | "COLLECTING" | "MATURING" | "COMPLETE";
export const AB_REPORT_TIMEZONE = "America/Sao_Paulo";

/** Calendar-day collection, inclusive at the end, in the report's fixed timezone. */
export function abRecurringRange(from: string | Date, durationDays: number) {
  const date = new Date(from);
  if (!Number.isFinite(date.getTime()) || !Number.isInteger(durationDays) || durationDays < 1) {
    throw new RangeError("Período de acompanhamento inválido.");
  }
  const { y, mo, d } = zonedParts(date, AB_REPORT_TIMEZONE);
  const startedAt = zonedToUtc(y, mo, d, 0, 0, 0, AB_REPORT_TIMEZONE);
  const lastDay = new Date(Date.UTC(y, mo, d + durationDays));
  const endExclusive = zonedToUtc(lastDay.getUTCFullYear(), lastDay.getUTCMonth(), lastDay.getUTCDate(), 0, 0, 0, AB_REPORT_TIMEZONE);
  return { startedAt, endsAt: new Date(endExclusive.getTime() - 1) };
}

/** No scheduler or read-time database mutation is needed to close collection. */
export function abCollectionPhase(
  experiment: Pick<AbExperimentDto, "startedAt" | "endsAt" | "conversionWindowHours">,
  now: Date | number = new Date()
): AbCollectionPhase {
  const time = typeof now === "number" ? now : now.getTime();
  const start = experiment.startedAt ? Date.parse(experiment.startedAt) : null;
  const end = experiment.endsAt ? Date.parse(experiment.endsAt) : null;
  if (start === null || !Number.isFinite(start) || time < start) return "SCHEDULED";
  if (end === null || !Number.isFinite(end) || time <= end) return "COLLECTING";
  if (time < end + experiment.conversionWindowHours * 3_600_000) return "MATURING";
  return "COMPLETE";
}
