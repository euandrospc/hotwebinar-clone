"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { copyConversationScreenshot } from "@/lib/conversation-screenshot";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { DashboardRangePicker } from "@/components/dashboard/dashboard-range-picker";
import { attendanceToday, ATTENDANCE_TIMEZONE } from "@/lib/attendance-range";
import { Send, ArrowLeft, ArrowRight, Clock, MessageSquare, ChevronDown, Phone, Copy, CheckCircle2, Sparkles, UserCheck, Users, Filter, MoreHorizontal, Image as ImageIcon } from "@/components/icons";
import { signOut } from "@/lib/auth-client";
import { ADMIN_LOGIN_PATH } from "@/lib/admin-paths";
import { useRealtimeChannel } from "@/lib/hooks/use-realtime-channel";
import { mergeLeadMessages } from "@/app/[slug]/_lib/merge-lead-messages";
import type { PlayerLeadMsg } from "@/app/[slug]/_lib/public-types";

import { ConversationMessages } from "./conversation-messages";
import { WorkspaceHeader } from "./workspace-header";
import styles from "./inbox.module.css";

interface Conversation {
  closedAt: string | null;
  aiEnabled: boolean;
  aiPaused: boolean;
  aiName: string;
  aiError: string | null;
  aiPending: boolean;
  assignedAttendantId: string | null;
  assignedAttendantName: string | null;
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

type ThreadMessage = PlayerLeadMsg;

interface InboxProps {
  attendantName: string;
  attendantId?: string;
  initialDate?: string;
  isAdmin?: boolean;
}

interface ReplyAttempt {
  text: string;
  clientMessageId: string;
}

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

export function Inbox({ attendantName, attendantId, initialDate, isAdmin = false }: InboxProps) {
  const searchParams = useSearchParams();
  const urlLeadId = searchParams.get("leadId");
  const [linkedConversation, setLinkedConversation] = useState<Conversation | null>(null);
  const [linkError, setLinkError] = useState("");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationsLoaded, setConversationsLoaded] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const [tab, setTab] = useState("all");
  const [from, setFrom] = useState(initialDate ?? attendanceToday());
  const [fromTime, setFromTime] = useState("00:00");
  const [toTime, setToTime] = useState("23:59");
  const [to, setTo] = useState(initialDate ?? attendanceToday());
  const [attendant, setAttendant] = useState("all");
  const [attendants, setAttendants] = useState<Array<{ id: string; name: string }>>([]);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferTarget, setTransferTarget] = useState("");
  const [controlBusy, setControlBusy] = useState(false);
  const [controlError, setControlError] = useState("");
  const rangeQuery = useRef("");
  rangeQuery.current = new URLSearchParams({ from, to, fromTime, toTime }).toString();
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(urlLeadId);
  const [threads, setThreads] = useState<Record<string, ThreadMessage[]>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [sendingLeads, setSendingLeads] = useState<Record<string, boolean>>({});
  const [failedAttempts, setFailedAttempts] = useState<Record<string, ReplyAttempt[]>>({});
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [loggingOut, setLoggingOut] = useState(false);
  const [onlineTotal, setOnlineTotal] = useState(0);
  const selectedRef = useRef<string | null>(selectedLeadId);
  selectedRef.current = selectedLeadId;
  const alive = useRef(true);
  const conversationController = useRef<AbortController | null>(null);
  const conversationFetching = useRef(false);
  const conversationRefreshQueued = useRef(false);
  const threadController = useRef<AbortController | null>(null);
  const eventRefreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryAttempts = useRef(new Map<string, ReplyAttempt>());
  const inFlightSends = useRef(new Set<string>());
  const sendControllers = useRef(new Map<string, AbortController>());
  const confirmedRequests = useRef(new Set<string>());
  const [copyingScreenshot, setCopyingScreenshot] = useState(false);
  const screenshotBusy = useRef(false);
  const conversationHeaderRef = useRef<HTMLDivElement>(null);
  const threadScrollRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);

  const thread = selectedLeadId ? (threads[selectedLeadId] ?? []) : [];
  const text = selectedLeadId ? (drafts[selectedLeadId] ?? "") : "";
  const sending = selectedLeadId ? !!sendingLeads[selectedLeadId] : false;
  const failedReplies = selectedLeadId ? (failedAttempts[selectedLeadId] ?? []) : [];

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      conversationController.current?.abort();
      threadController.current?.abort();
      for (const controller of sendControllers.current.values()) controller.abort();
      if (eventRefreshTimer.current) clearTimeout(eventRefreshTimer.current);
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const receive = useCallback((leadId: string, messages: ThreadMessage[]) => {
    for (const message of messages) if (message.clientMessageId) confirmedRequests.current.add(message.clientMessageId);
    setThreads((previous) => ({ ...previous, [leadId]: mergeLeadMessages(previous[leadId] ?? [], messages) }));
    setFailedAttempts((previous) => ({ ...previous, [leadId]: (previous[leadId] ?? []).filter((attempt) => !confirmedRequests.current.has(attempt.clientMessageId)) }));
  }, []);

  const fetchLinkedConversation = useCallback(async (leadId: string, signal?: AbortSignal) => {
    try {
      const res = await fetch(`/api/attendant/conversations?${new URLSearchParams({ leadId })}`, { cache: "no-store", signal: signal ?? AbortSignal.timeout(10_000) });
      if (!res.ok) throw new Error();
      const data = await res.json() as { conversations: Conversation[] };
      if (!alive.current || signal?.aborted || selectedRef.current !== leadId) return;
      setLinkedConversation(data.conversations[0] ?? null);
      setLinkError(data.conversations.length ? "" : "Conversa não encontrada ou indisponível.");
    } catch {
      if (alive.current && !signal?.aborted && selectedRef.current === leadId) setLinkError("Não foi possível abrir a conversa. Tente novamente.");
    }
  }, []);

  const fetchConversations = useCallback(async () => {
    if (!alive.current) return;
    if (conversationFetching.current) { conversationRefreshQueued.current = true; return; }
    conversationFetching.current = true;
    const controller = new AbortController();
    conversationController.current = controller;
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const res = await fetch(`/api/attendant/conversations?${rangeQuery.current}`, { cache: "no-store", signal: controller.signal });
      if (!res.ok) return;
      const data = (await res.json()) as { conversations: Conversation[]; onlineTotal: number; attendants?: Array<{ id: string; name: string }> };
      if (!alive.current || controller.signal.aborted) return;
      setConversations(data.conversations);
      if (selectedRef.current && !data.conversations.some(c => c.leadId === selectedRef.current)) void fetchLinkedConversation(selectedRef.current);
      setAttendants(data.attendants ?? []);
      setOnlineTotal(data.onlineTotal ?? 0);
    } catch {
      // Retry through reconnect or the fallback timer.
    } finally {
      clearTimeout(timeout);
      conversationFetching.current = false;
      if (alive.current && !controller.signal.aborted) setConversationsLoaded(true);
      if (alive.current && conversationRefreshQueued.current) {
        conversationRefreshQueued.current = false;
        void fetchConversations();
      }
    }
  }, [fetchLinkedConversation]);

  const fetchThread = useCallback(async (leadId: string) => {
    threadController.current?.abort();
    const controller = new AbortController();
    threadController.current = controller;
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const params = new URLSearchParams({ leadId });
      const res = await fetch(`/api/attendant/thread?${params.toString()}`, { cache: "no-store", signal: controller.signal });
      if (!res.ok) return;
      const data = (await res.json()) as { messages: ThreadMessage[] };
      if (alive.current && !controller.signal.aborted && selectedRef.current === leadId) receive(leadId, data.messages);
    } catch { /* A changed conversation aborts its old request. */ }
    finally { clearTimeout(timeout); }
  }, [receive]);

  const refreshConversationsSoon = useCallback(() => {
    if (eventRefreshTimer.current) return;
    eventRefreshTimer.current = setTimeout(() => {
      eventRefreshTimer.current = null;
      void fetchConversations();
    }, 150);
  }, [fetchConversations]);

  const { status } = useRealtimeChannel(
    { kind: "staff" },
    (event) => {
      if (event.type === "chat") {
        if (event.message.clientMessageId) confirmedRequests.current.add(event.message.clientMessageId);
        if (event.leadId === selectedRef.current) receive(event.leadId, [event.message]);
        setConversations((previous) => previous.map((conversation) => conversation.leadId === event.leadId
          ? { ...conversation, lastText: event.message.text, lastAt: event.message.createdAt, pending: event.message.sender === "lead" }
          : conversation).sort((a, b) => (b.lastAt ?? "").localeCompare(a.lastAt ?? "")));
        refreshConversationsSoon();
      } else if (event.type === "presence" || event.type === "conversation") refreshConversationsSoon();
    },
    () => {
      void fetchConversations();
      if (selectedRef.current) void fetchThread(selectedRef.current);
    }
  );

  useEffect(() => {
    setConversationsLoaded(false);
    setConversations([]);
    conversationController.current?.abort();
    void fetchConversations();
  }, [from, to, fromTime, toTime, fetchConversations]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (document.hidden) return;
      void fetchConversations();
      if (selectedRef.current) void fetchThread(selectedRef.current);
    }, status === "connected" ? 60_000 : 4_000);
    return () => clearInterval(timer);
  }, [fetchConversations, fetchThread, status]);

  useEffect(() => {
    selectedRef.current = urlLeadId;
    setSelectedLeadId(urlLeadId);
    setLinkedConversation(null);
    setLinkError("");
    if (!urlLeadId) return;
    const controller = new AbortController();
    void fetchLinkedConversation(urlLeadId, controller.signal);
    return () => controller.abort();
  }, [urlLeadId, fetchLinkedConversation]);

  useEffect(() => {
    stickToBottom.current = true;
    if (selectedLeadId) void fetchThread(selectedLeadId);
    return () => threadController.current?.abort();
  }, [selectedLeadId, fetchThread]);

  useEffect(() => {
    const element = threadScrollRef.current;
    if (!element) return;
    const onScroll = () => { stickToBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < 80; };
    const observer = new ResizeObserver(() => {
      if (stickToBottom.current) element.scrollTop = element.scrollHeight;
    });
    element.addEventListener("scroll", onScroll, { passive: true });
    observer.observe(element);
    return () => { element.removeEventListener("scroll", onScroll); observer.disconnect(); };
  }, [selectedLeadId]);

  useEffect(() => {
    const element = threadScrollRef.current;
    if (!element) return;
    const frame = requestAnimationFrame(() => {
      if (stickToBottom.current) element.scrollTop = element.scrollHeight;
    });
    return () => cancelAnimationFrame(frame);
  }, [thread.length, selectedLeadId]);

  async function handleSend() {
    const leadId = selectedRef.current;
    const trimmed = text.trim();
    if (!leadId || !trimmed || inFlightSends.current.has(leadId)) return;
    const priorAttempt = retryAttempts.current.get(leadId);
    const attempt = priorAttempt?.text === trimmed ? priorAttempt : { text: trimmed, clientMessageId: crypto.randomUUID() };
    await sendAttempt(leadId, attempt);
  }

  async function sendAttempt(leadId: string, attempt: ReplyAttempt) {
    if (inFlightSends.current.has(leadId)) return;
    inFlightSends.current.add(leadId);
    setSendingLeads((previous) => ({ ...previous, [leadId]: true }));
    setFailedAttempts((previous) => ({ ...previous, [leadId]: (previous[leadId] ?? []).filter((failed) => failed.clientMessageId !== attempt.clientMessageId) }));
    retryAttempts.current.set(leadId, attempt);
    const optimistic: ThreadMessage = {
      id: `tmp-${attempt.clientMessageId}`, clientMessageId: attempt.clientMessageId,
      text: attempt.text, sender: "team", teamName: attendantName, videoSec: null, createdAt: new Date().toISOString()
    };
    setThreads((previous) => ({ ...previous, [leadId]: mergeLeadMessages(previous[leadId] ?? [], [optimistic]) }));
    setDrafts((previous) => ({ ...previous, [leadId]: previous[leadId]?.trim() === attempt.text ? "" : (previous[leadId] ?? "") }));
    const controller = new AbortController();
    sendControllers.current.set(leadId, controller);
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const res = await fetch("/api/attendant/reply", {
        method: "POST", headers: { "content-type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({ leadId, ...attempt })
      });
      if (!res.ok) throw new Error("send_failed");
      const created = (await res.json()) as ThreadMessage;
      if (!alive.current) return;
      receive(leadId, [created]);
      retryAttempts.current.delete(leadId);
      refreshConversationsSoon();
    } catch {
      if (!alive.current) return;
      setThreads((previous) => ({ ...previous, [leadId]: (previous[leadId] ?? []).filter((message) => message.id !== optimistic.id) }));
      if (confirmedRequests.current.has(attempt.clientMessageId)) {
        retryAttempts.current.delete(leadId);
      } else {
        setDrafts((previous) => ({ ...previous, [leadId]: previous[leadId] || attempt.text }));
        setFailedAttempts((previous) => ({ ...previous, [leadId]: [...(previous[leadId] ?? []).filter((failed) => failed.clientMessageId !== attempt.clientMessageId), attempt] }));
      }
    } finally {
      clearTimeout(timeout);
      sendControllers.current.delete(leadId);
      inFlightSends.current.delete(leadId);
      if (alive.current) setSendingLeads((previous) => ({ ...previous, [leadId]: false }));
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
    selectedRef.current = leadId;
    threadController.current?.abort();
    setSelectedLeadId(leadId);
    setLinkError("");
    setControlError("");
    setTransferOpen(false);
    const url = new URL(window.location.href);
    url.searchParams.set("leadId", leadId);
    window.history.replaceState(null, "", url);
    setDrawerOpen(false);
  }

  async function copyConversationLink() {
    if (!selectedLeadId) return;
    const url = new URL("/atendimento", window.location.origin);
    url.searchParams.set("leadId", selectedLeadId);
    try {
      await navigator.clipboard.writeText(url.toString());
      toast.success("Link da conversa copiado");
    } catch {
      toast.error("Não foi possível copiar. Copie o endereço na barra do navegador.");
    }
  }

  async function copyScreenshot() {
    if (screenshotBusy.current || !conversationHeaderRef.current || !threadScrollRef.current) return;
    screenshotBusy.current = true;
    setCopyingScreenshot(true);
    try {
      await copyConversationScreenshot({ header: conversationHeaderRef.current, messages: threadScrollRef.current });
      toast.success("Print copiado! Cole com Ctrl+V ou Cmd+V.");
    } catch (error) {
      toast.error(error instanceof DOMException && error.name === "NotAllowedError"
        ? "O navegador bloqueou a cópia. Permita o acesso à área de transferência e tente novamente."
        : error instanceof Error ? error.message : "Não foi possível copiar o print. Tente novamente.");
    } finally {
      screenshotBusy.current = false;
      if (alive.current) setCopyingScreenshot(false);
    }
  }

  const webinars = useMemo(() => {
    const map = new Map<string, { id: string; title: string; phase: string }>();
    for (const c of conversations) {
      if (!map.has(c.webinarId)) map.set(c.webinarId, { id: c.webinarId, title: c.webinarTitle, phase: c.webinarPhase });
    }
    return [...map.values()].sort((a, b) => a.title.localeCompare(b.title));
  }, [conversations]);

  const scopedConversations = conversations.filter(c => {
    if (filter !== "all" && c.webinarId !== filter) return false;
    if (attendant === "unassigned") return !c.assignedAttendantId;
    return attendant === "all" || c.assignedAttendantId === attendant;
  });
  function matchesTab(c: Conversation, value: string) {
    if (value === "closed") return !!c.closedAt;
    if (value === "all") return true;
    return !c.closedAt && (value === "pending" ? c.pending : !c.pending);
  }
  const filteredConversations = scopedConversations.filter(c => matchesTab(c, tab));

  async function changeControl(action: "takeover" | "resume" | "close" | "reopen" | "transfer", targetId?: string) {
    const leadId = selectedRef.current;
    if (!leadId || controlBusy) return;
    setControlBusy(true); setControlError("");
    try {
      const response = await fetch("/api/attendant/control", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ leadId, action, ...(targetId ? { attendantId: targetId } : {}) })
      });
      if (!response.ok) throw new Error();
      await fetchConversations();
      await fetchLinkedConversation(leadId);
      if (selectedRef.current === leadId) {
        setTransferOpen(false);
        if (action === "close") setTab("closed");
        if (action === "reopen") setTab("all");
      }
      if (action === "transfer") toast.success("Atendimento transferido");
      if (action === "close") toast.success("Atendimento encerrado");
    } catch { setControlError("Não foi possível alterar o atendimento. Tente novamente."); }
    finally { setControlBusy(false); }
  }

  const selectedConversation = conversations.find((c) => c.leadId === selectedLeadId) ?? (linkedConversation?.leadId === selectedLeadId ? linkedConversation : null);

  return (
    <div className={styles.workspace}>
      <WorkspaceHeader attendantName={attendantName} isAdmin={isAdmin} status={status} onlineTotal={onlineTotal}
        drawerOpen={drawerOpen} onToggleConversations={() => setDrawerOpen(value => !value)}
        onLogout={handleLogout} loggingOut={loggingOut} />

      <div className={styles.layout}>
        <button type="button" aria-label="Fechar conversas" aria-hidden={!drawerOpen} tabIndex={-1}
          data-ui-motion="drawer-overlay" data-state={drawerOpen ? "open" : "closed"}
          onClick={() => setDrawerOpen(false)} className="absolute inset-0 z-20 rounded-2xl bg-black/25 backdrop-blur-[2px] lg:hidden" />
        <aside id="attendant-conversations" aria-label="Conversas" data-ui-motion="drawer" data-state={drawerOpen ? "open" : "closed"}
          className={`${styles.panel} ${styles.list} ${drawerOpen ? "translate-x-0" : "-translate-x-[110%] lg:translate-x-0"}`}>
          <div className={styles.listHeading}>
            <h2>Conversas</h2>
            <div className="ml-auto flex items-center gap-1">
              <Popover>
                <PopoverTrigger asChild><button type="button" aria-label="Filtros das conversas" title="Filtros das conversas" className={`${styles.button} ${styles.quietButton}`}><Filter />{(filter !== "all" || attendant !== "all") && <span className={styles.filterDot} />}</button></PopoverTrigger>
                <PopoverContent aria-label="Filtrar conversas" align="start" sideOffset={8} className={`${styles.floatingSurface} ${styles.filterPopover}`}>
                  <h3 className="text-xs font-semibold">Filtrar conversas</h3>
            <p className={styles.timezone}>Horário de Brasília</p>
            <div className={styles.selectWrap}>
              <label className={styles.filterLabel}>Webinar</label>
              <select aria-label="Filtrar por webinar" value={filter} onChange={e => setFilter(e.target.value)} className={styles.select}>
                <option value="all">Todos os webinars</option>
                {webinars.map(w => <option key={w.id} value={w.id}>{w.phase === "before" ? "[Em breve] " : w.phase === "open" ? "[Ao vivo] " : ""}{w.title}</option>)}
              </select><ChevronDown aria-hidden="true" />
            </div>
            <div className={styles.selectWrap}>
              <label className={styles.filterLabel}>Responsável</label>
              <select aria-label="Filtrar por atendente" value={attendant} onChange={e => setAttendant(e.target.value)} className={styles.select}>
                <option value="all">Todos os atendentes</option><option value="unassigned">Sem responsável</option>
                {attendants.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}
              </select><ChevronDown aria-hidden="true" />
            </div>

                  {(filter !== "all" || attendant !== "all") && <button type="button" onClick={() => { setFilter("all"); setAttendant("all"); }} className={styles.clearFilters}>Limpar filtros</button>}
                </PopoverContent>
              </Popover>
            </div>
            <button type="button" aria-label="Voltar ao atendimento" onClick={() => setDrawerOpen(false)} className={`${styles.button} ${styles.mobileOnly}`}><ArrowLeft /></button>
          </div>
          <div className={styles.filters}>
            <DashboardRangePicker initialFrom={from} initialTo={to} initialFromTime={fromTime} initialToTime={toTime}
              timeZone={ATTENDANCE_TIMEZONE} appearance="v2" className={styles.date}
              onApply={selection => { setFrom(selection.from); setTo(selection.to); setFromTime(selection.fromTime); setToTime(selection.toTime); }} />
          </div>
          <div role="tablist" aria-label="Status dos atendimentos" className={styles.tabs}>
            {[["all", "Todos"], ["pending", "Pendentes"], ["answered", "Respondidos"], ["closed", "Finalizados"]].map(([value, label]) => (
              <button role="tab" aria-selected={tab === value} type="button" key={value} onClick={() => setTab(value)} className={styles.tab}>
                {label} <span>{scopedConversations.filter(c => matchesTab(c, value)).length}</span>
              </button>
            ))}
          </div>
          <div className={styles.conversationList}>
            {conversationsLoaded && filteredConversations.length === 0 && <div className={styles.emptyList}>
              <MessageSquare aria-hidden="true" /><p>Nenhuma conversa neste filtro.</p>
            </div>}
            {filteredConversations.map(c => (
              <button key={c.leadId} type="button" onClick={() => selectConversation(c.leadId)} aria-pressed={selectedLeadId === c.leadId} className={styles.conversation}>
                <span className={styles.avatar}>{initialOf(c.leadName)}{c.online && <span className={styles.presence} />}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className={styles.personName}>{c.leadName}</span>
                    {c.closedAt && <span className={styles.badge}>finalizado</span>}
                    {c.pending && !c.closedAt && <span className={`${styles.badge} ${styles.pending}`}>pendente</span>}
                  </div>
                  {c.leadPhone && <span className="mt-0.5 flex items-center gap-1 text-[10px] text-[var(--inbox-muted)]"><Phone className="h-2.5 w-2.5" />{c.leadPhone}</span>}
                  <span className={styles.webinar}>
                    <span className={`h-1 w-1 shrink-0 rounded-full ${c.webinarPhase === "before" ? "bg-amber-500" : "bg-[#83B94D]"}`} />
                    <span className="truncate">{c.webinarTitle}</span>
                  </span>
                  {c.webinarPhase === "before" ? <span className="mt-1.5 flex items-center gap-1 text-[10px] text-amber-700 dark:text-amber-400"><Clock className="h-3 w-3" />começa em {formatCountdown(c.webinarStartDate, nowMs)}</span>
                    : <p className={styles.preview}>{c.lastText}</p>}
                  <p className={styles.assignee}>{c.assignedAttendantName || (c.aiEnabled && !c.aiPaused ? `IA · ${c.aiName}` : "Sem responsável")}</p>
                </div>
              </button>
            ))}
          </div>
        </aside>

        <section aria-label="Área de atendimento" className={`${styles.panel} ${styles.chat}`}>
          {!selectedConversation && <div className={styles.empty}>
            <span className={styles.emptyArtwork} aria-hidden="true"><MessageSquare /></span>
            <h2>{linkError ? "Não foi possível abrir a conversa" : selectedLeadId ? "Abrindo conversa…" : "Tudo começa com uma conversa"}</h2>
            <p>{linkError || (selectedLeadId ? "Buscando o histórico do atendimento." : "Selecione uma conversa para acompanhar o histórico e responder ao seu público.")}</p>
            {!selectedLeadId && <button type="button" onClick={() => setDrawerOpen(true)} className={`${styles.button} ${styles.primary} ${styles.mobileOnly} mt-2`}>Ver conversas <ArrowRight /></button>}
            {linkError && selectedLeadId && <button type="button" onClick={() => { setLinkError(""); void fetchLinkedConversation(selectedLeadId); }} className={styles.button}>Tentar novamente</button>}
          </div>}

          {selectedConversation && <>
            <div ref={conversationHeaderRef} className={styles.chatHeader}>
              <button type="button" onClick={() => setDrawerOpen(true)} data-screenshot-exclude aria-label="Voltar às conversas" className={`${styles.button} ${styles.mobileOnly}`}><ArrowLeft /></button>
              <span className={styles.avatar}>{initialOf(selectedConversation.leadName)}{selectedConversation.online && <span className={styles.presence} />}</span>
              <div className={styles.chatIdentity}>
                <p>{selectedConversation.leadName}</p>
                <div className={styles.contactMeta}>
                  <span className="truncate">{selectedConversation.webinarTitle}</span>
                  {selectedConversation.leadPhone && <a href={`tel:${selectedConversation.leadPhone}`} className={styles.contactPhone}><Phone />{selectedConversation.leadPhone}</a>}
                </div>
              </div>
              <div className={styles.headerAssignment} title={selectedConversation.assignedAttendantName ? `Atendido por ${selectedConversation.assignedAttendantName}` : selectedConversation.aiEnabled && !selectedConversation.aiPaused ? `Atendido por IA · ${selectedConversation.aiName}` : "Aguardando um atendente"}>
                {selectedConversation.closedAt ? <CheckCircle2 aria-hidden="true" /> : selectedConversation.aiEnabled && !selectedConversation.aiPaused ? <Sparkles aria-hidden="true" /> : <UserCheck aria-hidden="true" />}
                <span>{selectedConversation.closedAt ? "Finalizado" : (selectedConversation.assignedAttendantName ? `Atendido por ${selectedConversation.assignedAttendantName}` : null) || (selectedConversation.aiEnabled && !selectedConversation.aiPaused ? `IA · ${selectedConversation.aiName}` : "Aguardando atendente")}</span>
                {selectedConversation.aiEnabled && selectedConversation.aiPaused && <span role="img" className={styles.pausedDot} title="IA pausada" aria-label="IA pausada" />}
              </div>
              <div data-screenshot-exclude className={styles.headerActions}>
                {conversationsLoaded && !filteredConversations.some(c => c.leadId === selectedLeadId) && <Popover>
                  <PopoverTrigger asChild><button type="button" aria-label="Conversa fora dos filtros" title="Conversa fora dos filtros" className={`${styles.button} ${styles.quietButton}`}><Filter /></button></PopoverTrigger>
                  <PopoverContent aria-label="Conversa fora dos filtros" align="end" className={styles.floatingSurface}><p className="text-xs leading-relaxed">Esta conversa está fora dos filtros da lista. Você pode continuar o atendimento normalmente.</p></PopoverContent>
                </Popover>}
                {selectedConversation.closedAt
                  ? <button type="button" disabled={controlBusy} onClick={() => void changeControl("reopen")} className={`${styles.button} ${styles.primary}`}>Reabrir e assumir</button>
                  : (!selectedConversation.aiPaused || selectedConversation.assignedAttendantId !== attendantId) && <button type="button" disabled={controlBusy} onClick={() => void changeControl("takeover")} className={`${styles.button} ${styles.primary}`}>{selectedConversation.aiEnabled ? "Assumir e pausar IA" : "Assumir conversa"}</button>}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild><button type="button" aria-label="Ações da conversa" title="Ações da conversa" className={`${styles.button} ${styles.quietButton}`}><MoreHorizontal /></button></DropdownMenuTrigger>
                  <DropdownMenuContent align="end" sideOffset={8} className={`${styles.floatingSurface} ${styles.actionMenu}`}>
                    <DropdownMenuItem onSelect={() => void copyScreenshot()} disabled={copyingScreenshot || !thread.length} className={styles.menuItem}><ImageIcon />{copyingScreenshot ? "Copiando print…" : "Copiar print"}</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => void copyConversationLink()} className={styles.menuItem}><Copy />Copiar link</DropdownMenuItem>
                    {!selectedConversation.closedAt && <DropdownMenuItem disabled={controlBusy} onSelect={() => { setControlError(""); setTransferTarget(""); setTransferOpen(true); }} className={styles.menuItem}><Users />Transferir atendimento</DropdownMenuItem>}
                    {isAdmin && <DropdownMenuItem asChild className={styles.menuItem}><a href={`/dashboard/webinars/${selectedConversation.webinarId}/chat-ai`}><Sparkles />Configurar agente</a></DropdownMenuItem>}
                    {!selectedConversation.closedAt && selectedConversation.aiEnabled && selectedConversation.aiPaused && <DropdownMenuItem disabled={controlBusy} onSelect={() => void changeControl("resume")} className={styles.menuItem}><Sparkles />Retomar IA</DropdownMenuItem>}
                    {!selectedConversation.closedAt && <DropdownMenuItem disabled={controlBusy} onSelect={() => void changeControl("close")} className={styles.menuItem}><CheckCircle2 />Encerrar atendimento</DropdownMenuItem>}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            {selectedConversation.aiError && <p className="shrink-0 px-4 py-2 text-xs text-amber-700 dark:text-amber-400">A IA não conseguiu responder. O atendimento humano pode assumir.</p>}
            {controlError && <p role="alert" className="shrink-0 px-4 py-2 text-xs text-destructive">{controlError}</p>}
            <div ref={threadScrollRef} aria-label="Mensagens da conversa" role="log" aria-live="polite" className={styles.thread}>
              <ConversationMessages messages={thread} leadName={selectedConversation.leadName} />
            </div>
            {failedReplies.length > 0 && <div role="alert" className="max-h-40 shrink-0 space-y-2 overflow-y-auto px-4 py-2 text-xs text-destructive">
              <p>Não foi possível confirmar o envio. As respostas foram mantidas.</p>
              {failedReplies.map(attempt => <div key={attempt.clientMessageId} className="flex items-start gap-3">
                <p className="min-w-0 flex-1 whitespace-pre-wrap break-words">{attempt.text}</p>
                <button type="button" disabled={sending} onClick={() => void sendAttempt(selectedLeadId!, attempt)} aria-label={`Reenviar resposta: ${attempt.text}`} className={styles.button}>Reenviar</button>
              </div>)}
            </div>}
            {!selectedConversation.closedAt ? <form onSubmit={e => { e.preventDefault(); handleSend(); }} className={styles.composer}>
              <div className={styles.composerBox}>
                <textarea value={text} onChange={e => { const leadId = selectedRef.current; if (leadId) setDrafts(previous => ({ ...previous, [leadId]: e.target.value })); }} maxLength={500}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  placeholder="Escreva uma resposta..." aria-label="Escreva uma resposta" rows={1} className={styles.input} />
                <button type="submit" disabled={!text.trim() || sending} aria-label="Enviar resposta" className={`${styles.button} ${styles.primary} ${styles.send}`}><Send /></button>
              </div>
              <div className={styles.composerHint}><span>Enter para enviar · Shift + Enter para nova linha</span><span>{text.length}/500</span></div>
            </form> : <div className={styles.closed}><CheckCircle2 aria-hidden="true" />Atendimento finalizado</div>}
            <Dialog open={transferOpen} onOpenChange={value => { if (!controlBusy) setTransferOpen(value); }}>
              <DialogContent className="rounded-2xl sm:max-w-md">
                <DialogHeader><DialogTitle>Transferir atendimento</DialogTitle><DialogDescription>Escolha quem dará continuidade à conversa com {selectedConversation.leadName}. A IA ficará pausada.</DialogDescription></DialogHeader>
                <label className="space-y-2 text-sm">Novo responsável
                  <select aria-label="Novo responsável" value={transferTarget} onChange={e => setTransferTarget(e.target.value)} disabled={controlBusy} className="mt-2 w-full rounded-lg border bg-background p-2">
                    <option value="">Selecione um atendente</option>{attendants.filter(person => person.id !== selectedConversation.assignedAttendantId).map(person => <option key={person.id} value={person.id}>{person.name}</option>)}
                  </select>
                </label>
                {controlError && <p role="alert" className="text-sm text-destructive">{controlError}</p>}
                <div className="flex justify-end gap-2"><button type="button" disabled={controlBusy} onClick={() => setTransferOpen(false)} className="rounded-lg border px-3 py-2 text-sm">Cancelar</button><button type="button" disabled={controlBusy || !transferTarget} onClick={() => void changeControl("transfer", transferTarget)} className="rounded-lg bg-[#064B3C] px-3 py-2 text-sm text-white disabled:opacity-50">{controlBusy ? "Transferindo…" : "Confirmar transferência"}</button></div>
              </DialogContent>
            </Dialog>
          </>}
        </section>
      </div>
    </div>
  );
}
