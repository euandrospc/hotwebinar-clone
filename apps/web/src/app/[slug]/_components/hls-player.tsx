"use client";
import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { Button } from "@/components/ui/button";
import { Pause, Play, Volume2, VolumeX } from "lucide-react";

interface HlsPlayerProps {
  src: string;
  startOffsetSec: number;
  onTimeUpdate: (sec: number) => void;
  onEnded?: () => void;
}

export function HlsPlayer({ src, startOffsetSec, onTimeUpdate, onEnded }: HlsPlayerProps) {
  const ref = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [needsUnmute, setNeedsUnmute] = useState(true);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    let hls: Hls | null = null;
    if (Hls.isSupported()) {
      hls = new Hls({ lowLatencyMode: false });
      hls.loadSource(src);
      hls.attachMedia(video);
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
    }
    const onLoaded = () => {
      try { video.currentTime = Math.max(0, startOffsetSec); } catch { /* noop */ }
      void video.play().then(() => setPlaying(true)).catch(() => { /* autoplay blocked */ });
    };
    video.addEventListener("loadedmetadata", onLoaded, { once: true });
    return () => {
      video.removeEventListener("loadedmetadata", onLoaded);
      if (hls) hls.destroy();
    };
  }, [src, startOffsetSec]);

  function togglePlay() {
    const v = ref.current;
    if (!v) return;
    if (v.paused) { void v.play(); setPlaying(true); } else { v.pause(); setPlaying(false); }
  }

  function toggleMute() {
    const v = ref.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
    setNeedsUnmute(false);
  }

  function unmuteOverlayClick() {
    const v = ref.current;
    if (!v) return;
    v.muted = false;
    setMuted(false);
    setNeedsUnmute(false);
    void v.play();
  }

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black">
      <video
        ref={ref}
        playsInline
        muted={muted}
        onTimeUpdate={(e) => onTimeUpdate(e.currentTarget.currentTime)}
        onEnded={() => { setPlaying(false); onEnded?.(); }}
        className="h-full w-full"
        controls={false}
        controlsList="nodownload"
        disablePictureInPicture
      />
      {needsUnmute ? (
        <button
          type="button"
          onClick={unmuteOverlayClick}
          className="absolute inset-0 flex items-center justify-center bg-black/40 text-white"
        >
          <span className="rounded-md bg-white/90 px-4 py-2 text-sm font-medium text-black">
            Clique para ativar áudio
          </span>
        </button>
      ) : null}
      <div className="absolute bottom-2 left-2 flex items-center gap-2">
        <Button size="icon" variant="ghost" onClick={togglePlay} aria-label={playing ? "Pausar" : "Tocar"}>
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
        <Button size="icon" variant="ghost" onClick={toggleMute} aria-label={muted ? "Ativar áudio" : "Silenciar"}>
          {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
