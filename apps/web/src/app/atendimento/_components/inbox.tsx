"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Send, Menu, LogOut, ArrowLeft, Clock, MessageSquare, ChevronDown, Phone } from "lucide-react";
import { signOut } from "@/lib/auth-client";
import { ADMIN_LOGIN_PATH } from "@/lib/admin-paths";

interface Conversation {
  leadId: string;
  leadName: string;
  leadPhone: string | null;
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

function initialOf(name: string): string {
  return (name.trim()[0] ?? "?").toUpperCase();
}

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
  const [filter, setFilter] = useState<string>("active");
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

  const webinars = useMemo(() => {
    const map = new Map<string, { id: string; title: string; phase: string }>();
    for (const c of conversations) {
      if (!map.has(c.webinarId)) map.set(c.webinarId, { id: c.webinarId, title: c.webinarTitle, phase: c.webinarPhase });
    }
    return [...map.values()].sort((a, b) => a.title.localeCompare(b.title));
  }, [conversations]);

  const filteredConversations = useMemo(() => {
    return conversations.filter((c) => {
      if (filter === "active") return c.webinarPhase === "open";
      if (filter === "pending") return c.webinarPhase === "before";
      return c.webinarId === filter;
    });
  }, [conversations, filter]);

  const selectedConversation = conversations.find((c) => c.leadId === selectedLeadId) ?? null;

  return (
    <div className="flex h-screen [height:100dvh] flex-col bg-background">
      <header className="flex items-center justify-between gap-2 border-b bg-card px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setDrawerOpen((v) => !v)}
            aria-label="Abrir conversas"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border hover:bg-muted lg:hidden"
          >
            <Menu className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <MessageSquare className="h-4 w-4" />
            </span>
            <div className="leading-tight">
              <h1 className="text-base font-semibold sm:text-lg">Atendimento</h1>
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-500" />
                </span>
                {onlineTotal} online agora
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-muted-foreground sm:inline">Olá, {attendantName}</span>
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Sair</span>
          </button>
        </div>
      </header>

      <div className="relative flex-1 overflow-hidden lg:grid lg:grid-cols-[380px_1fr]">
        {drawerOpen && (
          <button
            type="button"
            aria-label="Fechar"
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 z-20 bg-black/40 lg:hidden"
          />
        )}

        <aside
          className={`absolute inset-y-0 left-0 z-30 flex min-h-0 w-[88%] max-w-[380px] flex-col border-r bg-card transition-transform lg:static lg:z-0 lg:w-auto lg:max-w-none lg:translate-x-0 ${
            drawerOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
          }`}
        >
          <div className="space-y-2 border-b p-4">
            <label className="text-xs font-medium text-muted-foreground">Responder o webinário</label>
            <div className="relative">
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="w-full appearance-none rounded-lg border bg-background px-3 py-2 pr-9 text-base outline-none focus:ring-1 focus:ring-ring sm:text-sm"
              >
                <option value="active">Todos ativos</option>
                <option value="pending">Todos pendentes</option>
                {webinars.length > 0 && <option disabled>──────────</option>}
                {webinars.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.phase === "before" ? "⏳ " : w.phase === "open" ? "🔴 " : ""}
                    {w.title}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {conversationsLoaded && filteredConversations.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-2 p-10 text-center">
                <MessageSquare className="h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">Nenhuma conversa neste filtro.</p>
              </div>
            )}
            <div className="space-y-1">
              {filteredConversations.map((c) => (
                <button
                  key={c.leadId}
                  type="button"
                  onClick={() => selectConversation(c.leadId)}
                  className={`flex w-full items-start gap-3 rounded-lg p-3 text-left transition-colors ${
                    selectedLeadId === c.leadId ? "bg-primary/10 ring-1 ring-primary/30" : "hover:bg-muted"
                  }`}
                >
                  <span className="relative mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-foreground/70">
                    {initialOf(c.leadName)}
                    {c.online && (
                      <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card bg-emerald-500" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium">{c.leadName}</span>
                      {c.pending && (
                        <span className="shrink-0 rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold text-red-500">
                          pendente
                        </span>
                      )}
                    </div>
                    {c.leadPhone ? (
                      <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Phone className="h-2.5 w-2.5" />
                        {c.leadPhone}
                      </span>
                    ) : null}
                    <span className="mt-0.5 inline-flex max-w-full items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground/70">
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${c.webinarPhase === "before" ? "bg-amber-500" : "bg-emerald-500"}`} />
                      <span className="truncate">{c.webinarTitle}</span>
                    </span>
                    {c.webinarPhase === "before" ? (
                      <span className="mt-1 flex items-center gap-1 text-xs font-medium text-amber-500">
                        <Clock className="h-3 w-3" />
                        começa em {formatCountdown(c.webinarStartDate, nowMs)}
                      </span>
                    ) : (
                      <p className="mt-1 truncate text-xs text-muted-foreground">{c.lastText}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </aside>

        <section className="flex h-full min-h-0 flex-col overflow-hidden">
          {!selectedConversation && (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
                <MessageSquare className="h-6 w-6 text-muted-foreground/50" />
              </span>
              <p className="text-sm text-muted-foreground">Selecione uma conversa para começar.</p>
            </div>
          )}

          {selectedConversation && (
            <>
              <div className="flex items-center gap-3 border-b bg-card p-4">
                <button
                  type="button"
                  onClick={() => setDrawerOpen(true)}
                  aria-label="Voltar às conversas"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border hover:bg-muted lg:hidden"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-foreground/70">
                  {initialOf(selectedConversation.leadName)}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-medium">{selectedConversation.leadName}</p>
                  <p className="truncate text-xs text-muted-foreground">{selectedConversation.webinarTitle}</p>
                  {selectedConversation.leadPhone ? (
                    <a
                      href={`tel:${selectedConversation.leadPhone}`}
                      className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <Phone className="h-3 w-3" />
                      {selectedConversation.leadPhone}
                    </a>
                  ) : null}
                </div>
              </div>

              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-background p-4">
                {thread.map((m) => (
                  <div key={m.id} className={`flex ${m.sender === "team" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm shadow-sm ${
                        m.sender === "team"
                          ? "rounded-br-sm bg-primary text-primary-foreground"
                          : "rounded-bl-sm border bg-card"
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words">{m.text}</p>
                      <p
                        className={`mt-1 text-right text-[10px] ${
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
                className="flex items-end gap-2 border-t bg-card p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
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
                  rows={1}
                  className="max-h-32 min-h-[44px] flex-1 resize-none rounded-xl border bg-background px-3.5 py-2.5 text-base outline-none focus:ring-1 focus:ring-ring sm:text-sm"
                />
                <button
                  type="submit"
                  disabled={!text.trim() || sending}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-opacity disabled:opacity-50"
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
