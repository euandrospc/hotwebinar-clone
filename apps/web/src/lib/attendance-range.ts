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
export function attendanceRange(from?: string | null, to?: string | null, now = new Date()) {
  const first = from || attendanceToday(now);
  const last = to || first;
  if (first > last) throw new Error("invalid_range");
  const start = parseDay(first);
  const end = parseDay(last);
  return {
    from: first, to: last,
    gte: zonedToUtc(start.y, start.mo, start.d, 0, 0, 0, ATTENDANCE_TIMEZONE),
    lt: zonedToUtc(end.y, end.mo, end.d + 1, 0, 0, 0, ATTENDANCE_TIMEZONE)
  };
}
