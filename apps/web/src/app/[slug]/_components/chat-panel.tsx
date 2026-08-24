"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PlayerLeadMsg, PlayerOwnerMsg } from "../_lib/public-types";
import { mergeLeadMessages } from "../_lib/merge-lead-messages";

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
  teamChatName: string;
  baseTimestampMs: number;
}

type StreamItem =
  | { kind: "owner"; id: string; authorName: string; text: string; showAtSec: number; isOwner: boolean }
  | { kind: "lead"; id: string; text: string; showAtSec: number; sender: "lead" | "team" };

function personalize(text: string, leadName: string): string {
  return text.replace(/\{lead\.name\}/g, leadName);
}

export function ChatPanel({ ownerChat, leadChat, currentTimeSec, leadName, teamChatName, baseTimestampMs }: ChatPanelProps) {
  const [leadMsgs, setLeadMsgs] = useState<PlayerLeadMsg[]>(leadChat);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [windowHeight, setWindowHeight] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const leadMsgsRef = useRef<PlayerLeadMsg[]>(leadMsgs);
  useEffect(() => {
    leadMsgsRef.current = leadMsgs;
  }, [leadMsgs]);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const maxSecRef = useRef(currentTimeSec);
  if (currentTimeSec > maxSecRef.current) maxSecRef.current = currentTimeSec;
  const visibleSec = maxSecRef.current;

  const items = useMemo<StreamItem[]>(() => {
    const ownerVisible: StreamItem[] = ownerChat
      .filter((m) => m.showAtSec <= visibleSec)
      .map((m) => ({ kind: "owner", id: m.id, authorName: m.authorName, text: m.text, showAtSec: m.showAtSec, isOwner: m.isOwner }));
    const leadItems: StreamItem[] = leadMsgs.map((m) => ({
      kind: "lead",
      id: m.id,
      text: m.text,
      showAtSec: m.videoSec ?? 0,
      sender: m.sender
    }));
    return [...ownerVisible, ...leadItems].sort((a, b) => a.showAtSec - b.showAtSec);
  }, [ownerChat, leadMsgs, visibleSec]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    const optimistic: PlayerLeadMsg = {
      id: "tmp-" + Date.now(),
      text: trimmed,
      sender: "lead",
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

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      const last = leadMsgsRef.current[leadMsgsRef.current.length - 1];
      const after = last && !last.id.startsWith("tmp-") ? `?after=${last.id}` : "";
      try {
        const res = await fetch(`/api/lead-chat${after}`, { cache: "no-store" });
        if (res.ok && alive) {
          const json = (await res.json()) as { messages: PlayerLeadMsg[] };
          if (json.messages.length) setLeadMsgs((m) => mergeLeadMessages(m, json.messages));
        }
      } catch {}
      if (alive) timer = setTimeout(poll, 4000);
    }
    timer = setTimeout(poll, 4000);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, []);

  const scrollRef = useRef<HTMLDivElement>(null);
  const initialScrollDone = useRef(false);
  useEffect(() => {
    const handleResize = () => {
      setWindowHeight(window.innerHeight);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);


  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    // Wait for layout (height set after windowHeight resolves) so scrollHeight is real.
    const id = requestAnimationFrame(() => {
      if (!el) return;
      if (!initialScrollDone.current) {
        if (items.length === 0 || el.clientHeight === 0) return;
        el.scrollTop = el.scrollHeight;
        initialScrollDone.current = true;
        return;
      }
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
      if (nearBottom) el.scrollTop = el.scrollHeight;
    });
    return () => cancelAnimationFrame(id);
  }, [items.length, windowHeight]);

  return (
    <aside className="flex flex-col overflow-hidden rounded-lg border bg-card text-xs md:h-full md:text-sm"
      style={{
        maxHeight: `${isMobile ? (windowHeight -340) : (windowHeight - 94)}px`
      }}
    >
      <div className="flex items-center gap-2 border-b px-2 py-2 md:px-4 md:py-3">
        <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" aria-hidden />
        <h3 className="truncate text-xs font-semibold md:text-sm">Chat</h3>
        <span className="ml-auto text-[10px] text-muted-foreground">{items.length}</span>
      </div>
      <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto px-2 py-2 md:space-y-3 md:px-4 md:py-3">
        {items.map((m) => {
          const ts = formatClock(baseTimestampMs, m.showAtSec);
          if (m.kind === "owner") {
            const nameColor = m.isOwner ? "text-primary" : colorFromName(m.authorName);
            return (
              <div key={m.id} className="group flex flex-col">
                <div className="flex items-baseline gap-2">
                  <span className={`truncate text-xs font-semibold md:text-sm ${nameColor}`}>{m.authorName}</span>
                  <span className="text-[10px] tabular-nums text-muted-foreground opacity-60 group-hover:opacity-100">{ts}</span>
                </div>
                <p className="break-words text-sm leading-snug">{personalize(m.text, leadName)}</p>
              </div>
            );
          }
          if (m.sender === "team") {
            return (
              <div key={m.id} className="group flex flex-col">
                <div className="flex items-baseline gap-2">
                  <span className="truncate text-xs font-semibold text-primary md:text-sm">{teamChatName}</span>
                  <span className="text-[10px] tabular-nums text-muted-foreground opacity-60 group-hover:opacity-100">{ts}</span>
                </div>
                <p className="break-words text-sm leading-snug">{m.text}</p>
              </div>
            );
          }
          return (
            <div key={m.id} className="group flex flex-col">
              <div className="flex items-baseline gap-2">
                <span className="truncate text-xs font-semibold text-emerald-500 md:text-sm">{leadName} <span className="text-[10px] font-normal text-muted-foreground">(você)</span></span>
                <span className="text-[10px] tabular-nums text-muted-foreground opacity-60 group-hover:opacity-100">{ts}</span>
              </div>
              <p className="break-words text-sm leading-snug">{m.text}</p>
            </div>
          );
        })}
      </div>
      <form onSubmit={send} className="flex gap-1 border-t px-2 py-2 md:gap-2 md:px-3 md:py-3">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Diga algo..."
          maxLength={500}
          className="h-8 flex-1 text-xs md:h-10 md:text-sm"
        />
        <Button type="submit" size="icon" disabled={sending || text.trim().length === 0} aria-label="Enviar" className="h-8 w-8 md:h-10 md:w-10">
          <Send className="h-3.5 w-3.5 md:h-4 md:w-4" />
        </Button>
      </form>
    </aside>
  );
}
