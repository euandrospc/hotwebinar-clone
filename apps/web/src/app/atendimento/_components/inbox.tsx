"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";

interface Conversation {
  leadId: string;
  leadName: string;
  webinarId: string;
  webinarTitle: string;
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

export function Inbox({ attendantName }: InboxProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationsLoaded, setConversationsLoaded] = useState(false);
  const [webinarFilter, setWebinarFilter] = useState<string>("all");
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [thread, setThread] = useState<ThreadMessage[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const cursorRef = useRef<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/attendant/conversations", { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as { conversations: Conversation[] };
        setConversations(data.conversations);
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

  const webinars = Array.from(new Map(conversations.map((c) => [c.webinarId, c.webinarTitle])).entries());

  const filteredConversations =
    webinarFilter === "all" ? conversations : conversations.filter((c) => c.webinarId === webinarFilter);

  const selectedConversation = conversations.find((c) => c.leadId === selectedLeadId) ?? null;

  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold">Atendimento</h1>
        <p className="text-sm text-muted-foreground">Olá, {attendantName}</p>
      </div>

      <div className="mt-6 grid h-[calc(100vh-180px)] gap-4 lg:grid-cols-[360px_1fr]">
        <div className="flex flex-col overflow-hidden rounded-lg border bg-card">
          <div className="space-y-3 border-b p-4">
            <h2 className="font-medium">Conversas</h2>
            {webinars.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setWebinarFilter("all")}
                  className={`rounded-full px-3 py-1 text-xs ${
                    webinarFilter === "all" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}
                >
                  Todos
                </button>
                {webinars.map(([id, title]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setWebinarFilter(id)}
                    className={`rounded-full px-3 py-1 text-xs ${
                      webinarFilter === id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {title}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex-1 divide-y overflow-y-auto">
            {conversationsLoaded && filteredConversations.length === 0 && (
              <p className="p-4 text-sm text-muted-foreground">Nenhuma conversa ainda.</p>
            )}
            {filteredConversations.map((c) => (
              <button
                key={c.leadId}
                type="button"
                onClick={() => setSelectedLeadId(c.leadId)}
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
                <span className="truncate text-xs text-muted-foreground">{c.webinarTitle}</span>
                <span className="truncate text-xs text-muted-foreground/80">{c.lastText}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col overflow-hidden rounded-lg border bg-card">
          {!selectedConversation && (
            <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-muted-foreground">
              Selecione uma conversa à esquerda para começar.
            </div>
          )}

          {selectedConversation && (
            <>
              <div className="border-b p-4">
                <p className="font-medium">{selectedConversation.leadName}</p>
                <p className="text-xs text-muted-foreground">{selectedConversation.webinarTitle}</p>
              </div>

              <div className="flex-1 space-y-2 overflow-y-auto p-4">
                {thread.map((m) => (
                  <div key={m.id} className={`flex ${m.sender === "team" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
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
        </div>
      </div>
    </div>
  );
}
