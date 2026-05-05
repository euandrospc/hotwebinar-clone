"use client";
import { useCallback, useRef, useState } from "react";

export type UploadState =
  | { status: "idle" }
  | { status: "init" }
  | { status: "uploading"; pct: number }
  | { status: "completing" }
  | { status: "polling"; videoId: string; pct: number }
  | { status: "ready"; videoId: string }
  | { status: "failed"; error: string; videoId?: string };

export interface UsePresignedUploadOptions {
  onReady?: (videoId: string) => void;
}

export function usePresignedUpload(opts: UsePresignedUploadOptions = {}) {
  const [state, setState] = useState<UploadState>({ status: "idle" });
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  const start = useCallback(async (file: File) => {
    setState({ status: "init" });
    try {
      const initRes = await fetch("/api/upload/init", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: file.name, sizeBytes: file.size, mimeType: file.type })
      });
      if (!initRes.ok) {
        const data = (await initRes.json().catch(() => null)) as { message?: string; error?: string } | null;
        throw new Error(data?.message ?? data?.error ?? `init failed (${initRes.status})`);
      }
      const { videoId, uploadUrl } = (await initRes.json()) as { videoId: string; uploadUrl: string };

      setState({ status: "uploading", pct: 0 });
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhrRef.current = xhr;
        xhr.open("PUT", uploadUrl);
        xhr.setRequestHeader("Content-Type", file.type);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            setState({ status: "uploading", pct: Math.round((e.loaded / e.total) * 100) });
          }
        };
        xhr.onerror = () => reject(new Error("network_error"));
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`upload failed (${xhr.status})`));
        };
        xhr.send(file);
      });

      setState({ status: "completing" });
      const completeRes = await fetch("/api/upload/complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ videoId })
      });
      if (!completeRes.ok) {
        const data = (await completeRes.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? `complete failed (${completeRes.status})`);
      }

      setState({ status: "polling", videoId, pct: 0 });

      // Poll status every 3s up to 60 minutes.
      const deadline = Date.now() + 60 * 60 * 1000;
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 3000));
        const res = await fetch("/api/videos");
        if (!res.ok) continue;
        const data = (await res.json()) as { videos: Array<{ id: string; status: string; progress?: number; errorMessage?: string }> };
        const me = data.videos.find((v) => v.id === videoId);
        if (!me) continue;
        setState({ status: "polling", videoId, pct: me.progress ?? 0 });
        if (me.status === "READY") {
          setState({ status: "ready", videoId });
          opts.onReady?.(videoId);
          return;
        }
        if (me.status === "FAILED") {
          setState({ status: "failed", error: me.errorMessage ?? "transcode failed", videoId });
          return;
        }
      }
      setState({ status: "failed", error: "timeout", videoId });
    } catch (err) {
      setState({ status: "failed", error: err instanceof Error ? err.message : String(err) });
    }
  }, [opts]);

  const reset = useCallback(() => {
    xhrRef.current?.abort();
    xhrRef.current = null;
    setState({ status: "idle" });
  }, []);

  return { state, start, reset };
}
