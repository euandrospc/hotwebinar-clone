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
