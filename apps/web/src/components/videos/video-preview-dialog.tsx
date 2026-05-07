"use client";
import { useEffect, useRef, useState } from "react";
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
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) { setError(null); return; }
    if (!hlsUrl || !videoRef.current) return;
    const video = videoRef.current;
    let hls: Hls | undefined;
    if (Hls.isSupported()) {
      hls = new Hls({ debug: false });
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (data.fatal) {
          setError(`${data.type}/${data.details}${data.response ? " (HTTP " + data.response.code + ")" : ""}`);
        }
      });
      hls.loadSource(hlsUrl);
      hls.attachMedia(video);
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = hlsUrl;
    } else {
      setError("HLS não suportado neste browser");
    }
    return () => {
      hls?.destroy();
      video.pause();
      video.removeAttribute("src");
      video.load();
    };
  }, [open, hlsUrl]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="truncate">{name}</DialogTitle>
        </DialogHeader>
        {hlsUrl ? (
          <>
            <video
              ref={videoRef}
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
