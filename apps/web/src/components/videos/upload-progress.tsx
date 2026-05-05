"use client";
import type { UploadState } from "@/lib/hooks/use-presigned-upload";

export function UploadProgress({ state }: { state: UploadState }) {
  if (state.status === "idle") return null;
  let label = "";
  let pct = 0;
  let showBar = true;
  switch (state.status) {
    case "init":
      label = "Preparando...";
      pct = 0;
      break;
    case "uploading":
      label = `Enviando ${state.pct}%`;
      pct = state.pct;
      break;
    case "completing":
      label = "Confirmando upload...";
      pct = 100;
      break;
    case "polling":
      label = `Processando vídeo ${state.pct}%`;
      pct = state.pct;
      break;
    case "ready":
      label = "Pronto!";
      pct = 100;
      break;
    case "failed":
      label = `Erro: ${state.error}`;
      showBar = false;
      break;
  }
  return (
    <div className="mt-2 space-y-1 text-sm">
      <p className={state.status === "failed" ? "text-destructive" : "text-muted-foreground"}>{label}</p>
      {showBar ? (
        <div className="h-2 w-full overflow-hidden rounded bg-muted">
          <div
            className="h-full bg-primary transition-[width] duration-300 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}
