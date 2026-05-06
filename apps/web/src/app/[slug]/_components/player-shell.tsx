"use client";
import { useRef, useState } from "react";
import type { PlayerShellProps } from "../_lib/public-types";
import { HlsPlayer } from "./hls-player";
import { ChatPanel } from "./chat-panel";
import { OfferBanner } from "./offer-banner";
import { Tracker } from "./tracker";
import { SalesNotifier } from "./sales-notifier";

export function PlayerShell({
  webinar, video, offer, ownerChat, leadChat, lead, initialOffsetSec, salesNotifications
}: PlayerShellProps) {
  const [currentTimeSec, setCurrentTimeSec] = useState(initialOffsetSec);
  const currentTimeRef = useRef(initialOffsetSec);

  function onTimeUpdate(sec: number) {
    currentTimeRef.current = sec;
    setCurrentTimeSec(sec);
  }

  if (!video?.hlsUrl) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 text-center">
        <p>Vídeo indisponível.</p>
      </main>
    );
  }

  return (
    <main className="grid min-h-screen grid-rows-[auto_1fr] bg-background">
      <header className="flex items-center justify-between border-b p-4">
        {webinar.logoUrl ? <img src={webinar.logoUrl} alt="" className="h-8 object-contain" /> : <div />}
        <span className="text-sm text-muted-foreground">Olá, {lead.name}</span>
      </header>
      <div className="grid gap-4 p-4 md:grid-cols-[2fr_1fr]">
        <div className="space-y-3">
          <HlsPlayer
            src={video.hlsUrl}
            startOffsetSec={initialOffsetSec}
            onTimeUpdate={onTimeUpdate}
          />
          <OfferBanner offer={offer} lead={lead} currentTimeSec={currentTimeSec} />
        </div>
        <ChatPanel
          ownerChat={ownerChat}
          leadChat={leadChat}
          currentTimeSec={currentTimeSec}
          leadName={lead.name}
        />
      </div>
      <Tracker currentTimeRef={currentTimeRef} />
      <SalesNotifier notifications={salesNotifications} currentTimeRef={currentTimeRef} />
    </main>
  );
}
