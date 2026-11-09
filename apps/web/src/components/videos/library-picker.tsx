"use client";
import styles from "@/components/management-v2.module.css";
import { Check } from "@/components/icons";
import { cn } from "@/lib/utils";

function formatDuration(sec: number): string {
  const total = Math.floor(sec);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
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
    return <p className="text-sm text-muted-foreground">Biblioteca vazia. Envie pela aba "Enviar novo".</p>;
  }
  return (
    <div className={styles.libraryGrid}>
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
              "relative", styles.libraryCard
            )}
          >
            <div className="aspect-video bg-muted">
              {thumb ? (
                <img src={thumb} alt={v.name} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                  sem thumbnail
                </div>
              )}
            </div>
            <div className="space-y-1 p-2.5">
              <p className="line-clamp-1 text-xs font-medium">{v.name}</p>
              {v.durationSec ? (
                <p className="text-[10px] text-muted-foreground">
                  {formatDuration(v.durationSec)}
                </p>
              ) : null}
            </div>
            {selected && (
              <div className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#064B3C] text-white shadow-sm">
                <Check className="h-3 w-3" />
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
