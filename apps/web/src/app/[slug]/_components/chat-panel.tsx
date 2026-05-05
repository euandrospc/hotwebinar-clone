"use client";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PlayerLeadMsg, PlayerOwnerMsg } from "../_lib/public-types";

interface ChatPanelProps {
  ownerChat: PlayerOwnerMsg[];
  leadChat: PlayerLeadMsg[];
  currentTimeSec: number;
  leadName: string;
}

type StreamItem =
  | { kind: "owner"; id: string; authorName: string; text: string; showAtSec: number; isOwner: boolean }
  | { kind: "lead"; id: string; text: string; showAtSec: number };

function personalize(text: string, leadName: string): string {
  return text.replace(/\{lead\.name\}/g, leadName);
}

export function ChatPanel({ ownerChat, leadChat, currentTimeSec, leadName }: ChatPanelProps) {
  const [leadMsgs, setLeadMsgs] = useState<PlayerLeadMsg[]>(leadChat);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const items = useMemo<StreamItem[]>(() => {
    const ownerVisible: StreamItem[] = ownerChat
      .filter((m) => m.showAtSec <= currentTimeSec)
      .map((m) => ({ kind: "owner", id: m.id, authorName: m.authorName, text: m.text, showAtSec: m.showAtSec, isOwner: m.isOwner }));
    const leadItems: StreamItem[] = leadMsgs.map((m) => ({
      kind: "lead",
      id: m.id,
      text: m.text,
      showAtSec: m.videoSec ?? 0
    }));
    return [...ownerVisible, ...leadItems].sort((a, b) => a.showAtSec - b.showAtSec);
  }, [ownerChat, leadMsgs, currentTimeSec]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    const optimistic: PlayerLeadMsg = {
      id: "tmp-" + Date.now(),
      text: trimmed,
      videoSec: Math.round(currentTimeSec),
      createdAt: new Date().toISOString()
    };
    setLeadMsgs((m) => [...m, optimistic]);
    setText("");
    try {
      const res = await fetch("/api/lead-chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: trimmed, videoSec: Math.round(currentTimeSec) })
      });
      if (res.ok) {
        const created = (await res.json()) as PlayerLeadMsg;
        setLeadMsgs((m) => m.map((x) => (x.id === optimistic.id ? created : x)));
      } else {
        setLeadMsgs((m) => m.filter((x) => x.id !== optimistic.id));
      }
    } catch {
      setLeadMsgs((m) => m.filter((x) => x.id !== optimistic.id));
    } finally {
      setSending(false);
    }
  }

  return (
    <aside className="flex h-full flex-col rounded-md border bg-card p-4">
      <h3 className="mb-3 text-sm font-semibold uppercase text-muted-foreground">Chat ao vivo</h3>
      <div className="flex-1 space-y-2 overflow-y-auto">
        {items.map((m) =>
          m.kind === "owner" ? (
            <div key={m.id} className="text-sm">
              <span className={m.isOwner ? "font-semibold text-primary" : "font-semibold"}>
                {m.authorName}:{" "}
              </span>
              <span>{personalize(m.text, leadName)}</span>
            </div>
          ) : (
            <div key={m.id} className="text-sm">
              <span className="font-semibold text-emerald-600">{leadName} (você): </span>
              <span>{m.text}</span>
            </div>
          )
        )}
      </div>
      <form onSubmit={send} className="mt-4 flex gap-2 border-t pt-3">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Mensagem"
          maxLength={500}
        />
        <Button type="submit" disabled={sending || text.trim().length === 0}>Enviar</Button>
      </form>
    </aside>
  );
}
