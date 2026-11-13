const GB = 1024 ** 3;

export function formatBytes(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  if (n < 1024) return `${n} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let cur = n / 1024; let i = 0;
  while (cur >= 1024 && i < units.length - 1) { cur /= 1024; i += 1; }
  return `${cur.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} ${units[i]}`;
}

export const formatGb = (bytes: number) => `${(bytes / GB).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} GB`;

export function formatDuration(sec: number | null): string {
  if (!sec) return "—";
  const total = Math.floor(sec);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

export function formatTotalDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}

/** Keeps the start and the extension visible, like "original_video_6a00f5…0a6b40.mp4". */
export function middleTruncate(name: string, max = 36): string {
  if (name.length <= max) return name;
  const tail = 12;
  return `${name.slice(0, max - tail - 1)}…${name.slice(-tail)}`;
}
