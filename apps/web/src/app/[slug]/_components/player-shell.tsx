"use client";
import { useRef, useState } from "react";
import type { PlayerShellProps } from "../_lib/public-types";
import { HlsPlayer } from "./hls-player";
import { ChatPanel } from "./chat-panel";
import { OfferBanner } from "./offer-banner";
import { Tracker } from "./tracker";
import { SalesNotifier } from "./sales-notifier";
import { AudienceBadge } from "./audience-badge";
import { ThemeToggle } from "@/components/theme-toggle";

export function PlayerShell({
  webinar, video, offer, ownerChat, leadChat, lead, initialOffsetSec, salesNotifications, teamChatName
}: PlayerShellProps) {
  const [currentTimeSec, setCurrentTimeSec] = useState(initialOffsetSec);
  const currentTimeRef = useRef(initialOffsetSec);

  function onTimeUpdate(sec: number) {
    currentTimeRef.current = sec;
    setCurrentTimeSec(sec);
  }

  const audience = {
    mode: webinar.audienceMode,
    min: webinar.audienceMin,
    max: webinar.audienceMax,
    seed: `${webinar.id}:${lead.id}`,
    durationSec: video?.durationSec ?? 3600,
    currentTimeRef
  };

  if (!video?.hlsUrl) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 text-center">
        <p>Vídeo indisponível.</p>
      </main>
    );
  }

  return (
    <main className="grid min-h-screen grid-rows-[auto_1fr] bg-background">
      <header className="flex items-center justify-between gap-4 border-b p-4">
        {webinar.logoUrl ? <img src={webinar.logoUrl} alt="" className="h-8 object-contain" /> : <div />}
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Olá, {lead.name}</span>
          <ThemeToggle />
        </div>
      </header>
      {/* Mobile: video, offer, chat stacked. Desktop: video left; offer on top of the
          chat on the right, chat filling the rest of the viewport height. */}
      <div className="grid gap-3 p-3 md:h-[calc(100dvh-65px)] md:grid-cols-[2fr_1fr] md:grid-rows-[auto_minmax(0,1fr)] md:gap-4 md:p-4">
        <div className="md:row-span-2">
          <HlsPlayer
            src={video.hlsUrl}
            startOffsetSec={initialOffsetSec}
            onTimeUpdate={onTimeUpdate}
            overlayBadge={
              <AudienceBadge {...audience} showLiveBadge={webinar.audienceLiveBadge} />
            }
          />
        </div>
        <div className="md:col-start-2 md:row-start-1">
          <OfferBanner offer={offer} lead={lead} currentTimeSec={currentTimeSec} />
        </div>
        <div className="min-h-0 md:col-start-2 md:row-start-2">
          <ChatPanel
            audience={audience}
            ownerChat={ownerChat}
            leadChat={leadChat}
            currentTimeSec={currentTimeSec}
            leadName={lead.name}
            teamChatName={teamChatName}
            baseTimestampMs={
              webinar.mode === "UNICO" && webinar.startDate
                ? new Date(webinar.startDate).getTime()
                : new Date(lead.sessionStart).getTime()
            }
          />
        </div>
      </div>
      <Tracker currentTimeRef={currentTimeRef} />
      <SalesNotifier notifications={salesNotifications} currentTimeRef={currentTimeRef} />
    </main>
  );
}
