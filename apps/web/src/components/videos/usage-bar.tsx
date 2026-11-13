import Link from "next/link";
import { ArrowRight, Database } from "@/components/icons";
import { formatBytes, formatGb, formatTotalDuration } from "./format";

export function UsageBar({ usedBytes, referenceBytes, referenceLabel, videoCount, totalDurationSec }: {
  usedBytes: number; referenceBytes: number; referenceLabel: string; videoCount: number; totalDurationSec: number;
}) {
  const pct = Math.min(100, (usedBytes / referenceBytes) * 100);
  return (
    <section aria-label="Armazenamento" className="flex w-full flex-col gap-3 rounded-2xl border border-[#1E241F] bg-[#0C0E0C] p-5 lg:w-[420px] lg:shrink-0">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Database aria-hidden="true" className="h-4 w-4 text-[#7C867E]" />
          <h2 className="text-[13px] font-semibold text-[#C9D1CA]">Armazenamento</h2>
        </div>
        <Link href="/dashboard/consumo" className="flex items-center gap-1 rounded text-xs font-semibold text-palco hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-palco">
          Ver consumo <ArrowRight aria-hidden="true" className="h-[13px] w-[13px]" />
        </Link>
      </div>
      <p className="flex items-end gap-1.5">
        <strong className="text-[26px] font-bold leading-[1.1] text-neutral-100 tabular-nums">{usedBytes > 0 ? formatBytes(usedBytes) : "0 GB"}</strong>
        <span className="text-[13px] text-[#7C867E]">de {formatGb(referenceBytes)} {referenceLabel}</span>
      </p>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#1A1F1B]" role="progressbar" aria-label="Uso do armazenamento" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
        <div className="h-full min-w-1.5 rounded-full bg-palco" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-[#7C867E]">
        {videoCount} {videoCount === 1 ? "vídeo" : "vídeos"} · {formatTotalDuration(totalDurationSec)} no total
      </p>
    </section>
  );
}
