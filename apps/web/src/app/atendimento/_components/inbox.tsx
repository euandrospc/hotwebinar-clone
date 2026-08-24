"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Send, Menu, LogOut, ArrowLeft, Clock } from "lucide-react";
import { signOut } from "@/lib/auth-client";
import { ADMIN_LOGIN_PATH } from "@/lib/admin-paths";

interface Conversation {
  leadId: string;
  leadName: string;
  webinarId: string;
  webinarTitle: string;
  webinarPhase: string;
  webinarStartDate: string | null;
  lastText: string;
  lastAt: string | null;
  pending: boolean;
  online: boolean;
}

interface ThreadMessage {
  id: string;
  text: string;
  sender: string;
  createdAt: string;
}

interface InboxProps {
  attendantName: string;
}

const CONVERSATIONS_POLL_MS = 4000;
const THREAD_POLL_MS = 4000;

function formatCountdown(startIso: string | null, nowMs: number): string {
  if (!startIso) return "agendado";
  const diff = new Date(startIso).getTime() - nowMs;
  if (diff <= 0) return "começando...";
  const total = Math.floor(diff / 1000);
  const days = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  const clock = `${pad(h)}:${pad(m)}:${pad(s)}`;
  return days > 0 ? `${days}d ${clock}` : clock;
}

export function Inbox({ attendantName }: InboxProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationsLoaded, setConversationsLoaded] = useState(false);
  const [showActive, setShowActive] = useState(true);
  const [showPending, setShowPending] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [thread, setThread] = useState<ThreadMessage[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [loggingOut, setLoggingOut] = useState(false);
  const [onlineTotal, setOnlineTotal] = useState(0);

  const cursorRef = useRef<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/attendant/conversations", { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as { conversations: Conversation[]; onlineTotal: number };
        setConversations(data.conversations);
        setOnlineTotal(data.onlineTotal ?? 0);
      }
    } catch {
    } finally {
      setConversationsLoaded(true);
    }
  }, []);

  useEffect(() => {
    fetchConversations();
    const timer = setInterval(fetchConversations, CONVERSATIONS_POLL_MS);
    return () => clearInterval(timer);
  }, [fetchConversations]);

  const fetchThread = useCallback(async (leadId: string) => {
    try {
      const params = new URLSearchParams({ leadId });
      if (cursorRef.current) params.set("after", cursorRef.current);
      const res = await fetch(`/api/attendant/thread?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { messages: ThreadMessage[] };
      if (data.messages.length === 0) return;
      cursorRef.current = data.messages[data.messages.length - 1].id;
      setThread((prev) => {
        const seen = new Set(prev.map((m) => m.id));
        return [...prev, ...data.messages.filter((m) => !seen.has(m.id))];
      });
    } catch {}
  }, []);

  useEffect(() => {
    if (!selectedLeadId) return;
    cursorRef.current = null;
    setThread([]);
    fetchThread(selectedLeadId);
    const timer = setInterval(() => fetchThread(selectedLeadId), THREAD_POLL_MS);
    return () => clearInterval(timer);
  }, [selectedLeadId, fetchThread]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: "end" });
  }, [thread]);

  async function handleSend() {
    const leadId = selectedLeadId;
    const trimmed = text.trim();
    if (!leadId || !trimmed || sending) return;
    setSending(true);
    try {
      const res = await fetch("/api/attendant/reply", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ leadId, text: trimmed })
      });
      if (res.ok) {
        setText("");
        fetchThread(leadId);
      }
    } catch {
    } finally {
      setSending(false);
    }
  }

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await signOut();
    } catch {}
    window.location.href = ADMIN_LOGIN_PATH;
  }

  function selectConversation(leadId: string) {
    setSelectedLeadId(leadId);
    setDrawerOpen(false);
  }

  const filteredConversations = useMemo(() => {
    return conversations.filter((c) => {
      const isActive = c.webinarPhase === "open";
      const isPending = c.webinarPhase === "before";
      if (showActive && isActive) return true;
      if (showPending && isPending) return true;
      return false;
    });
  }, [conversations, showActive, showPending]);

  const selectedConversation = conversations.find((c) => c.leadId === selectedLeadId) ?? null;

  return (
    <div className="flex h-[100dvh] flex-col">
      <header className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setDrawerOpen((v) => !v)}
            aria-label="Abrir conversas"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border lg:hidden"
          >
            <Menu className="h-4 w-4" />
          </button>
          <h1 className="text-lg font-semibold sm:text-xl">Atendimento</h1>
          <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-500">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-500" />
            </span>
            {onlineTotal} online
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-muted-foreground sm:inline">Olá, {attendantName}</span>
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Sair</span>
          </button>
        </div>
      </header>

      <div className="relative flex-1 overflow-hidden lg:grid lg:grid-cols-[360px_1fr]">
        {drawerOpen && (
          <button
            type="button"
            aria-label="Fechar"
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 z-20 bg-black/40 lg:hidden"
          />
        )}

        <aside
          className={`absolute inset-y-0 left-0 z-30 flex w-[85%] max-w-[360px] flex-col border-r bg-card transition-transform lg:static lg:z-0 lg:w-auto lg:max-w-none lg:translate-x-0 ${
            drawerOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
          }`}
        >
          <div className="space-y-3 border-b p-4">
            <h2 className="font-medium">Conversas</h2>
            <div className="flex flex-wrap gap-2">
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-xs">
                <input type="checkbox" checked={showActive} onChange={(e) => setShowActive(e.target.checked)} className="accent-primary" />
                Ativos
              </label>
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-xs">
                <input type="checkbox" checked={showPending} onChange={(e) => setShowPending(e.target.checked)} className="accent-primary" />
                Pendentes
              </label>
            </div>
          </div>

          <div className="flex-1 divide-y overflow-y-auto">
            {conversationsLoaded && filteredConversations.length === 0 && (
              <p className="p-4 text-sm text-muted-foreground">Nenhuma conversa neste filtro.</p>
            )}
            {filteredConversations.map((c) => (
              <button
                key={c.leadId}
                type="button"
                onClick={() => selectConversation(c.leadId)}
                className={`flex w-full flex-col gap-1 p-4 text-left transition-colors hover:bg-muted/50 ${
                  selectedLeadId === c.leadId ? "bg-muted" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    {c.online && (
                      <span className="relative flex h-2 w-2 shrink-0">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                      </span>
                    )}
                    <span className="truncate font-medium">{c.leadName}</span>
                  </div>
                  {c.pending && (
                    <span className="shrink-0 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive">
                      pendente
                    </span>
                  )}
                </div>
                <span className="inline-flex max-w-full items-center gap-1 self-start rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground/80">
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${c.webinarPhase === "before" ? "bg-amber-500" : "bg-emerald-500"}`} />
                  <span className="truncate">{c.webinarTitle}</span>
                </span>
                {c.webinarPhase === "before" ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-500">
                    <Clock className="h-3 w-3" />
                    começa em {formatCountdown(c.webinarStartDate, nowMs)}
                  </span>
                ) : (
                  <span className="truncate text-xs text-muted-foreground/80">{c.lastText}</span>
                )}
              </button>
            ))}
          </div>
        </aside>

        <section className="flex h-full flex-col overflow-hidden bg-card">
          {!selectedConversation && (
            <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-muted-foreground">
              Selecione uma conversa para começar.
            </div>
          )}

          {selectedConversation && (
            <>
              <div className="flex items-center gap-2 border-b p-4">
                <button
                  type="button"
                  onClick={() => setDrawerOpen(true)}
                  aria-label="Voltar às conversas"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border lg:hidden"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <div className="min-w-0">
                  <p className="truncate font-medium">{selectedConversation.leadName}</p>
                  <p className="truncate text-xs text-muted-foreground">{selectedConversation.webinarTitle}</p>
                </div>
              </div>

              <div className="flex-1 space-y-2 overflow-y-auto p-4">
                {thread.map((m) => (
                  <div key={m.id} className={`flex ${m.sender === "team" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                        m.sender === "team" ? "bg-primary text-primary-foreground" : "bg-muted"
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words">{m.text}</p>
                      <p
                        className={`mt-1 text-[10px] ${
                          m.sender === "team" ? "text-primary-foreground/70" : "text-muted-foreground"
                        }`}
                      >
                        {new Date(m.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSend();
                }}
                className="flex items-end gap-2 border-t p-4"
              >
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Escreva uma resposta..."
                  rows={2}
                  className="flex-1 resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
                />
                <button
                  type="submit"
                  disabled={!text.trim() || sending}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
