"use client";
import { useEffect, useRef } from "react";
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

  useEffect(() => {
    if (!open || !hlsUrl || !videoRef.current) return;
    const video = videoRef.current;
    let hls: Hls | undefined;
    if (Hls.isSupported()) {
      hls = new Hls();
      hls.loadSource(hlsUrl);
      hls.attachMedia(video);
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = hlsUrl;
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
          <video
            ref={videoRef}
            controls
            className="aspect-video w-full rounded bg-black"
          />
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">Vídeo ainda sem HLS disponível.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
