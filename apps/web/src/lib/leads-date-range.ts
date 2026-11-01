/** Shared by the leads list and CSV export. Bounds include the selected final minute. */
export function leadsDateRange(from?: string | null, to?: string | null) {
  if (!from || !to) return undefined;
  const gte = new Date(from);
  const lte = new Date(to);
  if (!Number.isFinite(gte.getTime()) || !Number.isFinite(lte.getTime()) || gte > lte) return undefined;
  lte.setSeconds(59, 999);
  return { gte, lte };
}

/** Default reporting day in the business timezone, independent of the server timezone. */
export function defaultLeadsDateParams(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(now);
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  const day = `${part("year")}-${part("month")}-${part("day")}`;
  return { from: `${day}T00:00:00-03:00`, to: `${day}T23:59:59.999-03:00` };
}
