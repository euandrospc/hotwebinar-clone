"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import Hls from "hls.js";
import { Button } from "@/components/ui/button";
import { Pause, Play, Volume2, VolumeX, Maximize, Minimize, Settings } from "lucide-react";

interface HlsPlayerProps {
  src: string;
  startOffsetSec: number;
  onTimeUpdate: (sec: number) => void;
  onEnded?: () => void;
  overlayBadge?: ReactNode;
}

interface QualityLevel {
  index: number;
  height: number;
  bitrate: number;
}

export function HlsPlayer({ src, startOffsetSec, onTimeUpdate, onEnded, overlayBadge }: HlsPlayerProps) {
  const ref = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [needsUnmute, setNeedsUnmute] = useState(true);
  const [volume, setVolume] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [levels, setLevels] = useState<QualityLevel[]>([]);
  const [currentLevel, setCurrentLevel] = useState<number>(-1); // -1 = auto
  const [showQuality, setShowQuality] = useState(false);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    let hls: Hls | null = null;
    if (Hls.isSupported()) {
      hls = new Hls({ lowLatencyMode: false });
      hlsRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        const list: QualityLevel[] = (hls?.levels ?? []).map((l, i) => ({
          index: i,
          height: l.height ?? 0,
          bitrate: l.bitrate ?? 0
        }));
        setLevels(list);
        setCurrentLevel(-1);
      });
      hls.on(Hls.Events.LEVEL_SWITCHED, (_e, data) => {
        if (hls?.autoLevelEnabled) {
          setCurrentLevel(-1);
        } else {
          setCurrentLevel(data.level);
        }
      });
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

  function selectLevel(idx: number) {
    if (hlsRef.current) {
      hlsRef.current.currentLevel = idx;
      setCurrentLevel(idx);
    }
    setShowQuality(false);
  }

  function currentLabel(): string {
    if (currentLevel === -1) return "Auto";
    const l = levels.find((x) => x.index === currentLevel);
    return l ? `${l.height}p` : "Auto";
  }

  return (
    <div ref={containerRef} className="relative aspect-video w-full overflow-hidden rounded-lg bg-black">
      <video
        ref={ref}
        playsInline
        muted={muted}
        onTimeUpdate={(e) => onTimeUpdate(e.currentTarget.currentTime)}
        onEnded={() => { setPlaying(false); onEnded?.(); }}
        onClick={togglePlay}
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
          className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 text-white"
        >
          <span className="rounded-md bg-white/90 px-4 py-2 text-sm font-medium text-black">
            Clique para ativar áudio
          </span>
        </button>
      ) : null}

      <div className="absolute bottom-0 left-0 right-0 z-10 flex items-center gap-2 bg-gradient-to-t from-black/70 to-transparent px-3 pb-2 pt-6">
        <Button size="icon" variant="ghost" onClick={togglePlay} aria-label={playing ? "Pausar" : "Tocar"} className="text-white hover:bg-white/10">
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
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
        {levels.length > 0 ? (
          <div className="relative">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowQuality((s) => !s)}
              aria-label="Qualidade"
              className="gap-1 text-white hover:bg-white/10"
            >
              <Settings className="h-4 w-4" />
              <span className="text-xs">{currentLabel()}</span>
            </Button>
            {showQuality ? (
              <div className="absolute bottom-full right-0 mb-2 min-w-[120px] overflow-hidden rounded-md border border-white/20 bg-black/90 text-sm">
                <button
                  type="button"
                  onClick={() => selectLevel(-1)}
                  className={`block w-full px-3 py-1.5 text-left text-white hover:bg-white/10 ${currentLevel === -1 ? "bg-white/10" : ""}`}
                >
                  Auto
                </button>
                {[...levels].sort((a, b) => b.height - a.height).map((l) => (
                  <button
                    key={l.index}
                    type="button"
                    onClick={() => selectLevel(l.index)}
                    className={`block w-full px-3 py-1.5 text-left text-white hover:bg-white/10 ${currentLevel === l.index ? "bg-white/10" : ""}`}
                  >
                    {l.height}p
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
        <Button size="icon" variant="ghost" onClick={toggleFullscreen} aria-label="Tela cheia" className="text-white hover:bg-white/10">
          {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
