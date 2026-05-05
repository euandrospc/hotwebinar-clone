"use client";
import type { PlayerLeadMsg, PlayerOwnerMsg } from "../_lib/public-types";
import { OwnerChatStream } from "./owner-chat-stream";
import { LeadChatInput } from "./lead-chat-input";

interface ChatPanelProps {
  ownerChat: PlayerOwnerMsg[];
  leadChat: PlayerLeadMsg[];
  currentTimeSec: number;
  leadName: string;
}

export function ChatPanel({ ownerChat, leadChat, currentTimeSec, leadName }: ChatPanelProps) {
  return (
    <aside className="flex h-full flex-col rounded-md border bg-card p-4">
      <h3 className="mb-3 text-sm font-semibold uppercase text-muted-foreground">Chat ao vivo</h3>
      <div className="flex-1 overflow-y-auto">
        <OwnerChatStream messages={ownerChat} currentTimeSec={currentTimeSec} leadName={leadName} />
      </div>
      <div className="mt-4 border-t pt-3">
        <LeadChatInput initial={leadChat} currentTimeSec={currentTimeSec} />
      </div>
    </aside>
  );
}
