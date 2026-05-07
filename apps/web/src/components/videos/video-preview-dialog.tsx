"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from "@/components/ui/dialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  hlsUrl: string | null;
}

export function VideoPreviewDialog({ open, onOpenChange, name, hlsUrl }: Props) {
  const hlsRef = useRef<Hls | null>(null);
  const videoElRef = useRef<HTMLVideoElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  const setVideoRef = useCallback((el: HTMLVideoElement | null) => {
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    if (videoElRef.current && videoElRef.current !== el) {
      try { videoElRef.current.pause(); videoElRef.current.removeAttribute("src"); videoElRef.current.load(); } catch {}
    }
    videoElRef.current = el;
    if (!el || !hlsUrl) return;
    setError(null);
    if (Hls.isSupported()) {
      const hls = new Hls({ debug: false });
      hlsRef.current = hls;
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (data.fatal) {
          setError(`${data.type}/${data.details}${data.response ? " (HTTP " + data.response.code + ")" : ""}`);
        }
      });
      hls.loadSource(hlsUrl);
      hls.attachMedia(el);
    } else if (el.canPlayType("application/vnd.apple.mpegurl")) {
      el.src = hlsUrl;
    } else {
      setError("HLS não suportado neste browser");
    }
  }, [hlsUrl]);

  useEffect(() => {
    if (!open) {
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
      setError(null);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="truncate">{name}</DialogTitle>
        </DialogHeader>
        {hlsUrl ? (
          <>
            <video
              ref={setVideoRef}
              controls
              autoPlay
              playsInline
              className="aspect-video w-full rounded bg-black"
            />
            {error && (
              <p className="text-xs text-destructive">Erro: {error}</p>
            )}
          </>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">Vídeo ainda sem HLS disponível.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
