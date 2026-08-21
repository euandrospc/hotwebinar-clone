"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import Hls from "hls.js";
import { Button } from "@/components/ui/button";
import { Volume2, VolumeX, Maximize, Minimize } from "lucide-react";

interface HlsPlayerProps {
  src: string;
  startOffsetSec: number;
  onTimeUpdate: (sec: number) => void;
  onEnded?: () => void;
  overlayBadge?: ReactNode;
}

export function HlsPlayer({ src, startOffsetSec, onTimeUpdate, onEnded, overlayBadge }: HlsPlayerProps) {
  const ref = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [muted, setMuted] = useState(true);
  const [needsUnmute, setNeedsUnmute] = useState(true);
  const [volume, setVolume] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    let hls: Hls | null = null;
    if (Hls.isSupported()) {
      hls = new Hls({ lowLatencyMode: false });
      hlsRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(video);
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
    }
    const onLoaded = () => {
      try { video.currentTime = Math.max(0, startOffsetSec); } catch { /* noop */ }
      void video.play().catch(() => { /* autoplay blocked */ });
    };
    video.addEventListener("loadedmetadata", onLoaded, { once: true });
    return () => {
      video.removeEventListener("loadedmetadata", onLoaded);
      if (hls) { hls.destroy(); hlsRef.current = null; }
    };
  }, [src, startOffsetSec]);

  useEffect(() => {
    function onFullscreenChange() {
      setIsFullscreen(Boolean(document.fullscreenElement));
    }
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

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

  function changeVolume(value: number) {
    const v = ref.current;
    if (!v) return;
    v.volume = value;
    setVolume(value);
    if (value > 0 && v.muted) {
      v.muted = false;
      setMuted(false);
      setNeedsUnmute(false);
    }
  }

  function toggleFullscreen() {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      void el.requestFullscreen().catch(() => undefined);
    } else {
      void document.exitFullscreen().catch(() => undefined);
    }
  }

  return (
    <div ref={containerRef} className="relative aspect-video w-full overflow-hidden rounded-lg bg-black">
      <video
        ref={ref}
        playsInline
        muted={muted}
        onTimeUpdate={(e) => onTimeUpdate(e.currentTarget.currentTime)}
        onEnded={() => onEnded?.()}
        className="h-full w-full"
        controls={false}
        controlsList="nodownload"
        disablePictureInPicture
      />

      {overlayBadge ? (
        <div className="pointer-events-none absolute left-3 top-3 z-10">
          <div className="pointer-events-auto">{overlayBadge}</div>
        </div>
      ) : null}

      {needsUnmute ? (
        <button
          type="button"
          onClick={unmuteOverlayClick}
          className="group absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/60 backdrop-blur-sm"
          aria-label="Ativar áudio"
        >
          <span className="relative flex h-20 w-20 items-center justify-center">
            <span className="absolute inset-0 animate-ping rounded-full bg-red-600/60" aria-hidden />
            <span className="absolute inset-2 animate-pulse rounded-full bg-red-600/80" aria-hidden />
            <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-red-600 text-white shadow-lg ring-4 ring-white/30 transition-transform group-hover:scale-110">
              <Volume2 className="h-7 w-7" />
            </span>
          </span>
          <span className="rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-zinc-900 shadow">
            Clique para ativar o som
          </span>
        </button>
      ) : null}

      <div className="absolute bottom-0 left-0 right-0 z-10 flex items-center gap-2 bg-gradient-to-t from-black/70 to-transparent px-3 pb-2 pt-6">
        <Button size="icon" variant="ghost" onClick={toggleMute} aria-label={muted ? "Ativar áudio" : "Silenciar"} className="text-white hover:bg-white/10">
          {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </Button>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={muted ? 0 : volume}
          onChange={(e) => changeVolume(parseFloat(e.target.value))}
          aria-label="Volume"
          className="h-1 w-24 cursor-pointer accent-white"
        />
        <div className="flex-1" />
        <Button size="icon" variant="ghost" onClick={toggleFullscreen} aria-label="Tela cheia" className="text-white hover:bg-white/10">
          {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
