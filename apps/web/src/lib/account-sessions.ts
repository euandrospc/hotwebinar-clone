/** Readable "Chrome no Windows" label from a session user agent. */
export function describeUserAgent(userAgent: string | null | undefined): { label: string; mobile: boolean } {
  const ua = userAgent ?? "";
  const browser =
    /Edg(e|A|iOS)?\//.test(ua) ? "Edge"
    : /OPR\/|Opera/.test(ua) ? "Opera"
    : /SamsungBrowser\//.test(ua) ? "Samsung Internet"
    : /Firefox\/|FxiOS\//.test(ua) ? "Firefox"
    : /Chrome\/|CriOS\//.test(ua) ? "Chrome"
    : /Safari\//.test(ua) ? "Safari"
    : null;
  const os =
    /iPhone/.test(ua) ? "iPhone"
    : /iPad/.test(ua) ? "iPad"
    : /Android/.test(ua) ? "Android"
    : /Windows/.test(ua) ? "Windows"
    : /CrOS/.test(ua) ? "ChromeOS"
    : /Mac OS X|Macintosh/.test(ua) ? "macOS"
    : /Linux/.test(ua) ? "Linux"
    : null;
  const mobile = /iPhone|iPad|Android|Mobile/.test(ua);
  if (!browser && !os) return { label: "Dispositivo desconhecido", mobile };
  return { label: `${browser ?? "Navegador"}${os ? ` no ${os}` : ""}`, mobile };
}

const UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ["year", 365 * 86_400_000], ["month", 30 * 86_400_000], ["week", 7 * 86_400_000],
  ["day", 86_400_000], ["hour", 3_600_000], ["minute", 60_000]
];

/** "agora", "há 5 minutos", "há 2 dias". */
export function formatLastActive(date: Date, now = new Date()): string {
  const diff = now.getTime() - date.getTime();
  const format = new Intl.RelativeTimeFormat("pt-BR", { numeric: "always" });
  for (const [unit, ms] of UNITS) {
    if (diff >= ms) return format.format(-Math.floor(diff / ms), unit);
  }
  return "agora";
}
