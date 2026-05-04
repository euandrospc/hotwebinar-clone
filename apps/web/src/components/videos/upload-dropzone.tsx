"use client";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { usePresignedUpload } from "@/lib/hooks/use-presigned-upload";
import { UploadProgress } from "./upload-progress";

export interface UploadDropzoneProps {
  onReady?: (videoId: string) => void;
}

export function UploadDropzone({ onReady }: UploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { state, start } = usePresignedUpload({ onReady });

  function pickFile() {
    inputRef.current?.click();
  }

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void start(file);
  }

  return (
    <div className="space-y-3 rounded-md border-2 border-dashed border-input p-8 text-center">
      <p className="text-sm text-muted-foreground">Selecione um arquivo de vídeo (até 10 GiB)</p>
      <Button type="button" onClick={pickFile} disabled={state.status !== "idle" && state.status !== "failed" && state.status !== "ready"}>
        Escolher arquivo
      </Button>
      <input ref={inputRef} type="file" accept="video/*" hidden onChange={onChange} />
      <UploadProgress state={state} />
    </div>
  );
}
