"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PlayerLeadMsg, PlayerOwnerMsg } from "../_lib/public-types";

const TIME_FMT = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });
function formatClock(baseMs: number, sec: number): string {
  const d = new Date(baseMs + Math.max(0, Math.floor(sec)) * 1000);
  return TIME_FMT.format(d);
}

function colorFromName(name: string): string {
  const palette = [
    "text-red-500",
    "text-orange-500",
    "text-amber-500",
    "text-emerald-500",
    "text-teal-500",
    "text-sky-500",
    "text-indigo-500",
    "text-fuchsia-500",
    "text-pink-500",
    "text-rose-500"
  ];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

interface ChatPanelProps {
  ownerChat: PlayerOwnerMsg[];
  leadChat: PlayerLeadMsg[];
  currentTimeSec: number;
  leadName: string;
  baseTimestampMs: number;
}

type StreamItem =
  | { kind: "owner"; id: string; authorName: string; text: string; showAtSec: number; isOwner: boolean }
  | { kind: "lead"; id: string; text: string; showAtSec: number };

function personalize(text: string, leadName: string): string {
  return text.replace(/\{lead\.name\}/g, leadName);
}

export function ChatPanel({ ownerChat, leadChat, currentTimeSec, leadName, baseTimestampMs }: ChatPanelProps) {
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

  const scrollRef = useRef<HTMLDivElement>(null);
  const initialScrollDone = useRef(false);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (!initialScrollDone.current) {
      el.scrollTop = el.scrollHeight;
      initialScrollDone.current = true;
      return;
    }
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (nearBottom) el.scrollTop = el.scrollHeight;
  }, [items.length]);

  return (
    <aside className="flex h-full max-h-[calc(100vh-8rem)] flex-col overflow-hidden rounded-lg border bg-card">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" aria-hidden />
        <h3 className="text-sm font-semibold">Chat ao vivo</h3>
        <span className="ml-auto text-xs text-muted-foreground">{items.length}</span>
      </div>
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {items.map((m) => {
          const ts = formatClock(baseTimestampMs, m.showAtSec);
          if (m.kind === "owner") {
            const nameColor = m.isOwner ? "text-primary" : colorFromName(m.authorName);
            return (
              <div key={m.id} className="group flex flex-col">
                <div className="flex items-baseline gap-2">
                  <span className={`text-sm font-semibold ${nameColor}`}>{m.authorName}</span>
                  <span className="text-[10px] tabular-nums text-muted-foreground opacity-60 group-hover:opacity-100">{ts}</span>
                </div>
                <p className="break-words text-sm leading-snug">{personalize(m.text, leadName)}</p>
              </div>
            );
          }
          return (
            <div key={m.id} className="group flex flex-col">
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-semibold text-emerald-500">{leadName} <span className="text-[10px] font-normal text-muted-foreground">(você)</span></span>
                <span className="text-[10px] tabular-nums text-muted-foreground opacity-60 group-hover:opacity-100">{ts}</span>
              </div>
              <p className="break-words text-sm leading-snug">{m.text}</p>
            </div>
          );
        })}
      </div>
      <form onSubmit={send} className="flex gap-2 border-t px-3 py-3">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Diga algo..."
          maxLength={500}
          className="flex-1"
        />
        <Button type="submit" size="icon" disabled={sending || text.trim().length === 0} aria-label="Enviar">
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </aside>
  );
}
