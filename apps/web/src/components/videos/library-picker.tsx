"use client";
import { Check } from "@/components/icons";
import { cn } from "@/lib/utils";

function formatDuration(sec: number): string {
  const total = Math.floor(sec);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${h}:${pad(m)}:${pad(s)}`;
}

export interface LibraryVideo {
  id: string;
  name: string;
  thumbUrl: string | null;
  customThumbUrl: string | null;
  durationSec: number | null;
}

export function LibraryPicker({
  videos,
  selectedId,
  onSelect
}: {
  videos: LibraryVideo[];
  selectedId: string | null;
  onSelect: (videoId: string) => void;
}) {
  if (videos.length === 0) {
    return <p className="rounded-xl border border-dashed border-[#1E241F] px-4 py-8 text-center text-[13px] text-[#7C867E]">Biblioteca vazia. Envie pela aba &quot;Enviar novo&quot;.</p>;
  }
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(min(200px,100%),1fr))] gap-3 sm:grid-cols-[repeat(auto-fill,minmax(200px,220px))]">
      {videos.map((v) => {
        const thumb = v.customThumbUrl ?? v.thumbUrl;
        const selected = v.id === selectedId;
        return (
          <button
            key={v.id}
            type="button"
            onClick={() => onSelect(v.id)}
            aria-pressed={selected}
            className={cn(
              "relative overflow-hidden rounded-xl border bg-[#0F120F] text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-palco/60 motion-reduce:transition-none",
              selected ? "border-palco shadow-[0_0_0_1px_#2BE07A]" : "border-[#1E241F] hover:border-[#2E3630]"
            )}
          >
            <div className="aspect-video bg-[#070807]">
              {thumb ? (
                <img src={thumb} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-[#7C867E]">
                  sem thumbnail
                </div>
              )}
            </div>
            <div className="flex flex-col gap-1 px-3 py-2.5">
              <p className="break-all text-[13px] font-semibold leading-snug text-neutral-100">{v.name}</p>
              <p className="text-xs tabular-nums text-[#7C867E]">
                {v.durationSec ? formatDuration(v.durationSec) : "—"}
              </p>
            </div>
            {selected && (
              <div className="absolute right-3 top-3 flex h-[22px] w-[22px] items-center justify-center rounded-full bg-palco text-palco-ink">
                <Check className="h-[13px] w-[13px]" />
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
