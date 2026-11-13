"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "@/components/icons";
import { cn } from "@/lib/utils";
import { usePresignedUpload } from "@/lib/hooks/use-presigned-upload";
import { UploadProgress } from "./upload-progress";

/** Inline drag-and-drop upload; same presigned flow as the "Enviar novo vídeo" dialog. */
export function UploadDropCard({ maxLabel }: { maxLabel: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const { state, start } = usePresignedUpload({ onReady: () => router.refresh() });
  const busy = state.status === "init" || state.status === "uploading" || state.status === "completing";

  // Show the new row as soon as the upload is confirmed; page polling then tracks processing.
  const polling = state.status === "polling";
  useEffect(() => { if (polling) router.refresh(); }, [polling, router]);

  function take(file: File | undefined) {
    if (!file || busy) return;
    void start(file);
  }

  return (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); take(e.dataTransfer.files?.[0]); }}
      disabled={busy}
      aria-label="Enviar vídeo: arraste um arquivo ou clique para escolher"
      className={cn(
        "flex min-h-36 w-full flex-1 items-center justify-center gap-4 rounded-2xl border border-palco/25 bg-palco/[0.03] p-5 text-left transition-colors motion-reduce:transition-none",
        "hover:border-palco/50 hover:bg-palco/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-palco disabled:cursor-progress",
        dragging && "border-palco/70 bg-palco/10"
      )}
    >
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-palco/[0.12]">
        <Upload aria-hidden="true" className="h-[22px] w-[22px] text-palco" />
      </span>
      <span className="flex min-w-0 flex-col gap-1">
        <span className="text-[15px] font-semibold text-neutral-100">{dragging ? "Solte para enviar" : "Arraste um vídeo para cá"}</span>
        {state.status === "idle"
          ? <span className="text-[13px] text-[#7C867E]">ou clique para escolher · MP4, MOV ou WEBM até {maxLabel}</span>
          : <span className="w-64 max-w-full" aria-live="polite"><UploadProgress state={state} /></span>}
      </span>
      <input ref={inputRef} type="file" accept="video/*" hidden onChange={(e) => { take(e.target.files?.[0]); e.target.value = ""; }} />
    </button>
  );
}
