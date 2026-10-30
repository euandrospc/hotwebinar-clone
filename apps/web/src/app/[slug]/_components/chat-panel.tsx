"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Send } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PlayerLeadMsg, PlayerOwnerMsg } from "../_lib/public-types";
import type { PublicSaleNotification } from "@/lib/public-dto";
import { mergeLeadMessages } from "../_lib/merge-lead-messages";
import { useSimulatedAudience, fmtAudience, type AudienceParams } from "./audience-badge";
import { SalesNotifier } from "./sales-notifier";
import { useRealtimeChannel } from "@/lib/hooks/use-realtime-channel";

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
  audience: AudienceParams;
  ownerChat: PlayerOwnerMsg[];
  leadChat: PlayerLeadMsg[];
  currentTimeSec: number;
  leadName: string;
  leadId: string;
  teamChatName: string;
  baseTimestampMs: number;
  salesNotifications: PublicSaleNotification[];
}

type StreamItem =
  | { kind: "owner"; id: string; authorName: string; text: string; showAtSec: number; isOwner: boolean }
  | { kind: "lead"; id: string; text: string; showAtSec: number; sender: "lead" | "team"; teamName?: string | null };

interface MessageAttempt { text: string; videoSec: number; clientMessageId: string }

function personalize(text: string, leadName: string): string {
  return text.replace(/\{lead\.name\}/g, leadName);
}

export function ChatPanel({ audience, ownerChat, leadChat, currentTimeSec, leadName, leadId, teamChatName, baseTimestampMs, salesNotifications }: ChatPanelProps) {
  const [leadMsgs, setLeadMsgs] = useState<PlayerLeadMsg[]>(() =>
    leadChat.map((x) => (x.videoSec == null ? { ...x, videoSec: currentTimeSec } : x))
  );
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState<MessageAttempt[]>([]);
  const retryRef = useRef<MessageAttempt | null>(null);
  const confirmedRequests = useRef(new Set<string>());
  const sendingRef = useRef(false);
  const aliveRef = useRef(true);
  const syncController = useRef<AbortController | null>(null);
  const sendController = useRef<AbortController | null>(null);
  // Leads see the simulated audience (same number as the player badge), never the real count.
  const online = useSimulatedAudience(audience);
  const maxSecRef = useRef(currentTimeSec);
  if (currentTimeSec > maxSecRef.current) maxSecRef.current = currentTimeSec;
  const visibleSec = maxSecRef.current;

  const receive = useCallback((messages: PlayerLeadMsg[]) => {
    for (const message of messages) {
      if (message.clientMessageId) confirmedRequests.current.add(message.clientMessageId);
    }
    const stamped = messages.map((message) => message.videoSec == null ? { ...message, videoSec: maxSecRef.current } : message);
    setLeadMsgs((previous) => mergeLeadMessages(previous, stamped));
    setFailedAttempts((previous) => previous.filter((attempt) => !confirmedRequests.current.has(attempt.clientMessageId)));
  }, []);

  const resync = useCallback(async () => {
    syncController.current?.abort();
    const controller = new AbortController();
    syncController.current = controller;
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await fetch("/api/lead-chat", { cache: "no-store", signal: controller.signal });
      if (!response.ok) return;
      const body = (await response.json()) as { messages: PlayerLeadMsg[] };
      if (aliveRef.current && !controller.signal.aborted) receive(body.messages);
    } catch { /* The channel status and fallback handle temporary disconnections. */ }
    finally { clearTimeout(timeout); }
  }, [receive]);

  const { status } = useRealtimeChannel(
    { kind: "lead", clientKey: leadId },
    (event) => { if (event.type === "chat" && event.leadId === leadId) receive([event.message]); },
    () => { void resync(); }
  );

  useEffect(() => {
    aliveRef.current = true;
    return () => { aliveRef.current = false; syncController.current?.abort(); sendController.current?.abort(); };
  }, []);

  useEffect(() => {
    // A slow reconciliation also recovers a missed Redis publish while the socket stayed open.
    const timer = setInterval(() => { if (!document.hidden) void resync(); }, status === "connected" ? 60_000 : 4_000);
    return () => clearInterval(timer);
  }, [resync, status]);

  const items = useMemo<StreamItem[]>(() => {
    const ownerVisible: StreamItem[] = ownerChat
      .filter((m) => m.showAtSec <= visibleSec)
      .map((m) => ({ kind: "owner", id: m.id, authorName: m.authorName, text: m.text, showAtSec: m.showAtSec, isOwner: m.isOwner }));
    const leadItems: StreamItem[] = leadMsgs.map((m) => ({
      kind: "lead",
      id: m.id,
      text: m.text,
      showAtSec: m.videoSec ?? 0,
      sender: m.sender,
      teamName: m.teamName
    }));
    return [...ownerVisible, ...leadItems].sort((a, b) => a.showAtSec - b.showAtSec);
  }, [ownerChat, leadMsgs, visibleSec]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || sendingRef.current) return;
    const attempt = retryRef.current?.text === trimmed ? retryRef.current : {
      text: trimmed, videoSec: Math.round(currentTimeSec), clientMessageId: crypto.randomUUID()
    };
    await sendAttempt(attempt);
  }

  async function sendAttempt(attempt: MessageAttempt) {
    if (sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    setFailedAttempts((previous) => previous.filter((failed) => failed.clientMessageId !== attempt.clientMessageId));
    retryRef.current = attempt;
    const optimistic: PlayerLeadMsg = {
      id: "tmp-" + attempt.clientMessageId,
      clientMessageId: attempt.clientMessageId,
      text: attempt.text,
      sender: "lead",
      videoSec: attempt.videoSec,
      createdAt: new Date().toISOString()
    };
    setLeadMsgs((messages) => mergeLeadMessages(messages, [optimistic]));
    setText((draft) => draft.trim() === attempt.text ? "" : draft);
    const controller = new AbortController();
    sendController.current = controller;
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const res = await fetch("/api/lead-chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify(attempt)
      });
      if (!res.ok) throw new Error("send_failed");
      const created = (await res.json()) as PlayerLeadMsg;
      if (!aliveRef.current) return;
      receive([created]);
      retryRef.current = null;
    } catch {
      if (!aliveRef.current) return;
      setLeadMsgs((messages) => messages.filter((message) => message.id !== optimistic.id));
      if (confirmedRequests.current.has(attempt.clientMessageId)) {
        retryRef.current = null;
      } else {
        setText((draft) => draft || attempt.text);
        setFailedAttempts((previous) => [...previous.filter((failed) => failed.clientMessageId !== attempt.clientMessageId), attempt]);
      }
    } finally {
      clearTimeout(timeout);
      sendController.current = null;
      sendingRef.current = false;
      if (aliveRef.current) setSending(false);
    }
  }

  const scrollRef = useRef<HTMLDivElement>(null);
  // Stick to the newest message unless the lead scrolled up. The box keeps
  // resizing after load (window height, offer image above it on desktop), so a
  // one-shot scroll on mount left it at the first message.
  const stickToBottom = useRef(true);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    };
    const ro = new ResizeObserver(() => {
      if (stickToBottom.current) el.scrollTop = el.scrollHeight;
    });
    el.addEventListener("scroll", onScroll, { passive: true });
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", onScroll);
      ro.disconnect();
    };
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const id = requestAnimationFrame(() => {
      if (stickToBottom.current) el.scrollTop = el.scrollHeight;
    });
    return () => cancelAnimationFrame(id);
  }, [items.length]);

  return (
    <aside aria-label="Chat do webinar" className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border bg-card text-xs md:text-sm">
      <div className="flex shrink-0 items-center gap-2 border-b px-2 py-2 md:px-4 md:py-3">
        <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" aria-hidden />
        <h3 className="truncate text-xs font-semibold md:text-sm">Chat</h3>
        <span className="text-[10px] text-muted-foreground" aria-label="Conexão do chat">
          {status === "connected" ? "Conectado" : status === "fallback" ? "Atualização periódica" : "Reconectando…"}
        </span>
        {audience.mode !== "NONE" ? (
          <span className="ml-auto text-[10px] text-muted-foreground">{fmtAudience.format(online)} online</span>
        ) : null}
      </div>
      <div ref={scrollRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto px-2 py-2 md:space-y-3 md:px-4 md:py-3">
        {items.map((m) => {
          const ts = formatClock(baseTimestampMs, m.showAtSec);
          const teamLabel = (m.kind === "lead" && m.teamName) || teamChatName;
          const author = m.kind === "owner" ? m.authorName : m.sender === "team" ? teamLabel : leadName;
          const initial = (author.trim()[0] ?? "?").toUpperCase();

          if (m.kind === "lead" && m.sender === "team") {
            return (
              <div key={m.id} className="flex gap-2">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-500 text-[11px] font-semibold text-white">
                  {initial}
                </span>
                <div className="min-w-0 flex-1 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-xs font-semibold text-red-500 md:text-sm">{teamLabel}</span>
                    <span className="ml-auto shrink-0 text-[10px] tabular-nums text-muted-foreground">{ts}</span>
                  </div>
                  <p className="mt-0.5 break-words text-sm leading-snug">{m.text}</p>
                </div>
              </div>
            );
          }

          const isYou = m.kind === "lead";
          return (
            <div key={m.id} className="group flex gap-2">
              <span
                className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                  isYou ? "bg-emerald-500 text-white" : "bg-muted text-zinc-400"
                }`}
              >
                {initial}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="truncate text-xs font-semibold text-zinc-400 md:text-sm">
                    {isYou ? (
                      <>
                        {leadName} <span className="text-[10px] font-normal text-muted-foreground">(você)</span>
                      </>
                    ) : (
                      author
                    )}
                  </span>
                  <span className="text-[10px] tabular-nums text-muted-foreground opacity-60 group-hover:opacity-100">{ts}</span>
                </div>
                <p className="break-words text-sm leading-snug">{m.kind === "owner" ? personalize(m.text, leadName) : m.text}</p>
              </div>
            </div>
          );
        })}
      </div>
      <SalesNotifier notifications={salesNotifications} currentTimeRef={audience.currentTimeRef} />
      {failedAttempts.length > 0 && <div role="alert" className="max-h-36 shrink-0 space-y-2 overflow-y-auto border-t px-3 py-2 text-xs text-destructive">
        <p>Não foi possível confirmar o envio. Suas mensagens foram mantidas.</p>
        {failedAttempts.map((attempt) => <div key={attempt.clientMessageId} className="flex items-start gap-2">
          <p className="min-w-0 flex-1 whitespace-pre-wrap break-words">{attempt.text}</p>
          <Button type="button" variant="outline" size="sm" disabled={sending} onClick={() => void sendAttempt(attempt)} aria-label={`Reenviar: ${attempt.text}`}>Reenviar</Button>
        </div>)}
      </div>}
      <form onSubmit={send} className="flex shrink-0 gap-1 border-t px-2 py-2 md:gap-2 md:px-3 md:py-3">
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
