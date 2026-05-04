function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let n = bytes / 1024;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i += 1; }
  return `${n.toFixed(2)} ${units[i]}`;
}

export function UsageBar({ usedBytes }: { usedBytes: number }) {
  return (
    <div className="rounded-md border bg-card p-4">
      <p className="text-sm font-medium">Armazenamento</p>
      <p className="mt-1 text-2xl font-semibold">{formatBytes(usedBytes)} usados</p>
    </div>
  );
}
