export const AUTO_TIMEZONE_VALUE = "__auto__";

export interface TimezoneOption {
  value: string;
  label: string;
}

export const TIMEZONES: ReadonlyArray<TimezoneOption> = [
  { value: AUTO_TIMEZONE_VALUE, label: "Detectar automático (navegador)" },
  { value: "America/Sao_Paulo", label: "São Paulo (BRT)" },
  { value: "America/Recife", label: "Recife (BRT)" },
  { value: "America/Belem", label: "Belém (BRT)" },
  { value: "America/Manaus", label: "Manaus (AMT)" },
  { value: "America/Rio_Branco", label: "Rio Branco (ACT)" },
  { value: "America/Argentina/Buenos_Aires", label: "Buenos Aires" },
  { value: "America/Mexico_City", label: "Mexico City" },
  { value: "America/Bogota", label: "Bogotá" },
  { value: "America/Santiago", label: "Santiago" },
  { value: "Europe/Lisbon", label: "Lisboa" },
  { value: "Europe/Madrid", label: "Madrid" },
  { value: "Europe/London", label: "London" },
  { value: "Europe/Paris", label: "Paris" },
  { value: "Europe/Berlin", label: "Berlin" },
  { value: "Europe/Rome", label: "Roma" },
  { value: "America/New_York", label: "New York" },
  { value: "America/Los_Angeles", label: "Los Angeles" },
  { value: "Asia/Tokyo", label: "Tokyo" },
  { value: "Australia/Sydney", label: "Sydney" }
];

export function resolveAutoTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Sao_Paulo";
  } catch {
    return "America/Sao_Paulo";
  }
}

/**
 * Format a UTC Date in a specific IANA timezone as "dd/MM/yyyy HH:mm".
 *
 * Server components run in the container's timezone (usually UTC), so plain
 * date-fns `format(date, ...)` renders the stored UTC instant, not the webinar's
 * local time — a 20:00 São Paulo event shows as 23:00. This converts explicitly
 * using the webinar's timezone. `__auto__` (browser-detect) has no meaning on the
 * server, so it falls back to São Paulo.
 */
export function formatWebinarDateTime(
  date: Date,
  timeZone: string | null | undefined
): string {
  const tz = !timeZone || timeZone === AUTO_TIMEZONE_VALUE ? "America/Sao_Paulo" : timeZone;
  try {
    const parts = new Intl.DateTimeFormat("pt-BR", {
      timeZone: tz,
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).formatToParts(date);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
    return `${get("day")}/${get("month")}/${get("year")} ${get("hour")}:${get("minute")}`;
  } catch {
    // Invalid timezone string: fall back to São Paulo rather than throwing.
    return formatWebinarDateTime(date, "America/Sao_Paulo");
  }
}
