"use client";
import { useRef, useState } from "react";
import type { PlayerShellProps } from "../_lib/public-types";
import { HlsPlayer } from "./hls-player";
import { ChatPanel } from "./chat-panel";
import { OfferBanner } from "./offer-banner";
import { Tracker } from "./tracker";
import { AudienceBadge } from "./audience-badge";

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
    <main className="grid h-dvh min-h-0 w-full grid-rows-[minmax(0,min(42dvh,56.25vw))_minmax(0,1fr)] gap-2 overflow-hidden bg-background p-2 md:grid-cols-[minmax(0,7fr)_minmax(0,3fr)] md:grid-rows-[minmax(0,1fr)] md:gap-3 md:p-3">
      <div className="min-h-0 min-w-0">
        <HlsPlayer
          className="h-full aspect-auto"
          src={video.hlsUrl}
          startOffsetSec={initialOffsetSec}
          onTimeUpdate={onTimeUpdate}
          overlayBadge={
            <AudienceBadge {...audience} showLiveBadge={webinar.audienceLiveBadge} />
          }
        />
      </div>
      <div className="flex min-h-0 min-w-0 flex-col gap-2">
        <OfferBanner offer={offer} lead={lead} currentTimeSec={currentTimeSec} />
        <div className="min-h-0 flex-1">
          <ChatPanel
            key={lead.id}
            audience={audience}
            ownerChat={ownerChat}
            leadChat={leadChat}
            salesNotifications={salesNotifications}
            currentTimeSec={currentTimeSec}
            leadName={lead.name}
            leadId={lead.id}
            teamChatName={teamChatName}
            baseTimestampMs={
              webinar.mode === "UNICO" && webinar.startDate
                ? new Date(webinar.startDate).getTime()
                : new Date(lead.sessionStart).getTime()
            }
          />
        </div>
      </div>
      <Tracker currentTimeRef={currentTimeRef} leadId={lead.id} />
    </main>
  );
}
