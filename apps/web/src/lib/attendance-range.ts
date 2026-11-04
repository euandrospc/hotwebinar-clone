import { zonedParts, zonedToUtc } from "@/lib/timezones";

export const ATTENDANCE_TIMEZONE = "America/Sao_Paulo";
export function attendanceToday(now = new Date()) {
  const { y, mo, d } = zonedParts(now, ATTENDANCE_TIMEZONE);
  return `${y}-${String(mo + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
function parseDay(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("invalid_range");
  const [y, month, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, month - 1, d));
  if (date.toISOString().slice(0, 10) !== value) throw new Error("invalid_range");
  return { y, mo: month - 1, d };
}
export function attendanceRange(from?: string | null, to?: string | null, now = new Date(), times?: { fromTime?: string | null; toTime?: string | null }) {
  const first = from || attendanceToday(now);
  const last = to || first;
  if (first > last) throw new Error("invalid_range");
  const start = parseDay(first);
  const end = parseDay(last);
  const fromTime = times?.fromTime || "00:00";
  const toTime = times?.toTime || "23:59";
  const validTime = /^([01]\d|2[0-3]):[0-5]\d$/;
  if (!validTime.test(fromTime) || !validTime.test(toTime)) throw new Error("invalid_range");
  const [startHour, startMinute] = fromTime.split(":").map(Number);
  const [endHour, endMinute] = toTime.split(":").map(Number);
  const gte = zonedToUtc(start.y, start.mo, start.d, startHour, startMinute, 0, ATTENDANCE_TIMEZONE);
  // Include the entire selected final minute, as in the dashboard picker.
  const lt = new Date(zonedToUtc(end.y, end.mo, end.d, endHour, endMinute, 0, ATTENDANCE_TIMEZONE).getTime() + 60_000);
  if (gte >= lt) throw new Error("invalid_range");
  return { from: first, to: last, gte, lt };
}
