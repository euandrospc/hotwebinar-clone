"use client";
import { Check } from "lucide-react";
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
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      {videos.map((v) => {
        const thumb = v.customThumbUrl ?? v.thumbUrl;
        const selected = v.id === selectedId;
        return (
          <button
            key={v.id}
            type="button"
            onClick={() => onSelect(v.id)}
            className={cn(
              "relative overflow-hidden rounded-md border text-left transition",
              selected ? "ring-2 ring-primary" : "hover:border-primary/50"
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
            <div className="p-2">
              <p className="line-clamp-1 text-sm font-medium">{v.name}</p>
              {v.durationSec ? (
                <p className="text-xs text-muted-foreground">
                  {formatDuration(v.durationSec)}
                </p>
              ) : null}
            </div>
            {selected && (
              <div className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Check className="h-4 w-4" />
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
