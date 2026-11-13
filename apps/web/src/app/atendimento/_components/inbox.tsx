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
import { Send, ArrowLeft, ArrowRight, Check, Clock, MessageSquare, ChevronDown, Phone, Copy, CheckCircle2, Sparkles, UserCheck, Users, Filter, MoreHorizontal, Image as ImageIcon, Search, Info, X } from "@/components/icons";
import { signOut } from "@/lib/auth-client";
import { ADMIN_LOGIN_PATH } from "@/lib/admin-paths";
import { useRealtimeChannel } from "@/lib/hooks/use-realtime-channel";
import { mergeLeadMessages } from "@/app/[slug]/_lib/merge-lead-messages";
import type { PlayerLeadMsg } from "@/app/[slug]/_lib/public-types";

import { ConversationMessages } from "./conversation-messages";
import { WorkspaceHeader, type InboxMetrics } from "./workspace-header";
import { ContactPanel, type LeadDetails } from "./contact-panel";
import { QuickReplies, type QuickRepliesHandle } from "./quick-replies";

interface Conversation {
  closedAt: string | null;
  aiEnabled: boolean;
  aiUnavailable?: boolean;
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

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
}

const listTime = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: ATTENDANCE_TIMEZONE });
const listDay = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", timeZone: ATTENDANCE_TIMEZONE });
function relativeTime(iso: string | null, nowMs: number) {
  if (!iso) return "";
  const date = new Date(iso);
  if (nowMs - date.getTime() < 60_000) return "agora";
  return attendanceToday(date) === attendanceToday(new Date(nowMs)) ? listTime.format(date) : listDay.format(date).replace(/\.$/, "").replace(" de ", " ");
}

function whatsappUrl(phone: string | null) {
  const digits = phone?.replace(/\D/g, "") ?? "";
  if (digits.length < 10) return null;
  // Brazilian numbers are often stored without the country code.
  return `https://wa.me/${digits.length <= 11 ? `55${digits}` : digits}`;
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
  const [search, setSearch] = useState("");
  const [metrics, setMetrics] = useState<InboxMetrics | null>(null);
  const [details, setDetails] = useState<Record<string, LeadDetails>>({});
  const [suggestions, setSuggestions] = useState<Record<string, { status: "loading" | "ready" | "error"; text?: string }>>({});
  const [detailsOpen, setDetailsOpen] = useState(false);
  const detailsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const quickRepliesRef = useRef<QuickRepliesHandle>(null);
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
      if (detailsTimer.current) clearTimeout(detailsTimer.current);
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

  const fetchMetrics = useCallback(async () => {
    try {
      const res = await fetch("/api/attendant/metrics", { cache: "no-store", signal: AbortSignal.timeout(10_000) });
      if (!res.ok) return;
      const data = await res.json() as Partial<InboxMetrics>;
      if (alive.current && typeof data.pending === "number" && typeof data.answeredToday === "number") {
        setMetrics({ pending: data.pending, answeredToday: data.answeredToday, averageFirstReplySeconds: data.averageFirstReplySeconds ?? null });
      }
    } catch { /* The next poll retries. */ }
  }, []);

  const fetchDetails = useCallback(async (leadId: string) => {
    try {
      const res = await fetch(`/api/attendant/lead?${new URLSearchParams({ leadId })}`, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
      if (!res.ok) return;
      const data = await res.json() as LeadDetails;
      if (alive.current && data?.journey) setDetails(previous => ({ ...previous, [leadId]: data }));
    } catch { /* Keeps the last known details. */ }
  }, []);

  // Journey and AI counters change with chat activity; refresh the open contact at most every 2s.
  const refreshDetailsSoon = useCallback(() => {
    if (detailsTimer.current) return;
    detailsTimer.current = setTimeout(() => {
      detailsTimer.current = null;
      if (selectedRef.current) void fetchDetails(selectedRef.current);
    }, 2_000);
  }, [fetchDetails]);

  async function addNote(text: string) {
    const leadId = selectedRef.current;
    if (!leadId) return false;
    try {
      const res = await fetch("/api/attendant/notes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ leadId, text }) });
      if (!res.ok) throw new Error();
      const note = await res.json() as LeadDetails["notes"][number];
      setDetails(previous => previous[leadId] ? { ...previous, [leadId]: { ...previous[leadId], notes: [note, ...previous[leadId].notes] } } : previous);
      return true;
    } catch {
      toast.error("Não foi possível salvar a nota. Tente novamente.");
      return false;
    }
  }

  // Chat events already patch the list locally; the refetch only picks up new conversations
  // and status changes. At a live's peak events arrive constantly, so coalesce them.
  const refreshConversationsSoon = useCallback(() => {
    if (eventRefreshTimer.current) return;
    eventRefreshTimer.current = setTimeout(() => {
      eventRefreshTimer.current = null;
      void fetchConversations();
    }, 1_500);
  }, [fetchConversations]);

  const { status } = useRealtimeChannel(
    { kind: "staff" },
    (event) => {
      if (event.type === "chat") {
        if (event.message.clientMessageId) confirmedRequests.current.add(event.message.clientMessageId);
        if (event.leadId === selectedRef.current) { receive(event.leadId, [event.message]); refreshDetailsSoon(); }
        setConversations((previous) => previous.map((conversation) => conversation.leadId === event.leadId
          ? { ...conversation, lastText: event.message.text, lastAt: event.message.createdAt, pending: event.message.sender === "lead" }
          : conversation).sort((a, b) => (b.lastAt ?? "").localeCompare(a.lastAt ?? "")));
        refreshConversationsSoon();
      } else if (event.type === "presence" || event.type === "conversation") {
        refreshConversationsSoon();
        if (event.type === "conversation" && event.leadId === selectedRef.current) refreshDetailsSoon();
      }
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
    void fetchMetrics();
    const timer = setInterval(() => {
      if (document.hidden) return;
      void fetchMetrics();
      if (selectedRef.current) void fetchDetails(selectedRef.current);
    }, 30_000);
    return () => clearInterval(timer);
  }, [fetchMetrics, fetchDetails]);

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
    if (selectedLeadId) { void fetchThread(selectedLeadId); void fetchDetails(selectedLeadId); }
    return () => threadController.current?.abort();
  }, [selectedLeadId, fetchThread, fetchDetails]);

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
      void fetchMetrics();
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
    setDetailsOpen(false);
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
  const query = normalize(search.trim());
  const queryDigits = query.replace(/\D/g, "");
  const searchedConversations = query
    ? scopedConversations.filter(c => [c.leadName, c.leadPhone ?? "", c.lastText, c.webinarTitle].some(value => normalize(value).includes(query))
      || (!!c.leadPhone && queryDigits.length > 2 && c.leadPhone.replace(/\D/g, "").includes(queryDigits)))
    : scopedConversations;
  const filteredConversations = searchedConversations.filter(c => matchesTab(c, tab));

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
      void fetchMetrics();
      void fetchDetails(leadId);
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

  const lastMessage = thread.at(-1);
  // A human is expected to answer: AI is off, paused or failed for this conversation.
  const awaitingHuman = !!selectedConversation && !selectedConversation.closedAt && selectedConversation.pending
    && (!selectedConversation.aiEnabled || selectedConversation.aiPaused || !!selectedConversation.aiError);
  const suggestionKey = awaitingHuman && selectedConversation?.aiEnabled && lastMessage?.sender === "lead"
    ? `${selectedConversation.leadId}:${lastMessage.id}` : null;
  const suggestion = suggestionKey ? suggestions[suggestionKey] : undefined;
  const suggestionUnavailable = awaitingHuman && !!selectedConversation?.aiUnavailable && lastMessage?.sender === "lead";

  useEffect(() => {
    if (!suggestionKey || suggestions[suggestionKey]) return;
    const leadId = suggestionKey.slice(0, suggestionKey.indexOf(":"));
    setSuggestions(previous => ({ ...previous, [suggestionKey]: { status: "loading" } }));
    void (async () => {
      try {
        const res = await fetch("/api/attendant/suggest", {
          method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ leadId }), signal: AbortSignal.timeout(40_000)
        });
        if (!res.ok) throw new Error();
        const data = await res.json() as { text?: string };
        if (!data.text) throw new Error();
        if (alive.current) setSuggestions(previous => ({ ...previous, [suggestionKey]: { status: "ready", text: data.text } }));
      } catch {
        if (alive.current) setSuggestions(previous => ({ ...previous, [suggestionKey]: { status: "error" } }));
      }
    })();
  }, [suggestionKey, suggestions]);

  const waitingSince = awaitingHuman && lastMessage?.sender === "lead" ? new Date(lastMessage.createdAt).getTime() : null;
  const waitingMinutes = waitingSince === null ? 0 : Math.max(0, Math.floor((nowMs - waitingSince) / 60_000));
  const waitingLabel = waitingMinutes < 1 ? "menos de 1 min" : waitingMinutes < 60 ? `${waitingMinutes} min`
    : waitingMinutes < 1440 ? `${Math.floor(waitingMinutes / 60)}h ${waitingMinutes % 60}min` : `${Math.floor(waitingMinutes / 1440)} ${waitingMinutes < 2880 ? "dia" : "dias"}`;
  const aiActive = !!selectedConversation && selectedConversation.aiEnabled && !selectedConversation.aiPaused;
  const whatsapp = whatsappUrl(selectedConversation?.leadPhone ?? null);
  const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-palco/50";
  const outlineButton = `inline-flex h-[34px] shrink-0 items-center gap-1.5 rounded-[9px] border border-[#1E241F] px-3 text-xs font-semibold text-[#C9D1CA] transition-colors hover:bg-[#121512] hover:text-neutral-100 disabled:opacity-50 [&_svg]:h-3.5 [&_svg]:w-3.5 [&_svg]:text-neutral-400 ${focusRing}`;
  const primaryButton = `inline-flex h-[34px] shrink-0 items-center gap-1.5 rounded-[9px] bg-palco px-3 text-xs font-semibold text-palco-ink transition-colors hover:bg-[#45e88c] disabled:opacity-50 [&_svg]:h-3.5 [&_svg]:w-3.5 ${focusRing}`;
  const iconButton = `relative grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[9px] border border-[#1E241F] text-neutral-400 transition-colors hover:bg-[#121512] hover:text-neutral-100 [&_svg]:h-4 [&_svg]:w-4 ${focusRing}`;
  const menuItem = "gap-2 rounded-md px-2.5 py-2 text-[13px] text-neutral-300 focus:bg-[#151915] focus:text-neutral-100 [&_svg]:h-4 [&_svg]:w-4";
  const surface = "rounded-xl border-[#1E241F] bg-[#0C0E0C] font-palco text-neutral-100";
  const selectClass = "h-9 w-full appearance-none rounded-lg border border-[#1E241F] bg-[#070807] pl-2.5 pr-8 text-xs text-neutral-100 focus:border-palco/40 focus:outline-none";
  const tabs = [["pending", "Pendentes"], ["answered", "Respondidas"], ["closed", "Finalizadas"], ["all", "Todas"]] as const;
  const filtersActive = filter !== "all" || attendant !== "all";
  const todayLabel = from === to && from === attendanceToday(new Date(nowMs)) && fromTime === "00:00" && toTime === "23:59"
    ? `Hoje, ${listDay.format(new Date(nowMs)).replace(/\.$/, "").replace(" de ", " ")}` : undefined;

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-[#0A0C0A] font-palco text-neutral-100">
      <WorkspaceHeader attendantName={attendantName} isAdmin={isAdmin} status={status} onlineTotal={onlineTotal} metrics={metrics}
        drawerOpen={drawerOpen} onToggleConversations={() => setDrawerOpen(value => !value)}
        onLogout={handleLogout} loggingOut={loggingOut} />

      <div className="relative grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[360px_minmax(0,1fr)_300px]">
        <button type="button" aria-label="Fechar conversas" aria-hidden={!drawerOpen} tabIndex={-1}
          onClick={() => setDrawerOpen(false)}
          className={`absolute inset-0 z-20 bg-black/50 transition-opacity motion-reduce:transition-none lg:hidden ${drawerOpen ? "opacity-100" : "pointer-events-none opacity-0"}`} />
        <aside id="attendant-conversations" aria-label="Conversas"
          className={`absolute inset-y-0 left-0 z-30 flex w-[min(360px,92vw)] flex-col overflow-hidden border-r border-[#1A1F1B] bg-[#090B09] transition-transform duration-200 motion-reduce:transition-none lg:static lg:z-auto lg:w-auto lg:translate-x-0 ${drawerOpen ? "translate-x-0" : "-translate-x-full"}`}>
          <div className="flex flex-col gap-3 border-b border-[#1A1F1B] px-4 pb-3.5 pt-[18px]">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-bold">Conversas</h2>
              <div className="flex min-w-0 items-center gap-1.5">
                <DashboardRangePicker initialFrom={from} initialTo={to} initialFromTime={fromTime} initialToTime={toTime}
                  timeZone={ATTENDANCE_TIMEZONE} appearance="v2" label={todayLabel}
                  className="h-[30px] rounded-lg border-[#1E241F] bg-transparent px-2.5 text-[#C9D1CA] hover:bg-[#121512] [&_span]:font-semibold"
                  onApply={selection => { setFrom(selection.from); setTo(selection.to); setFromTime(selection.fromTime); setToTime(selection.toTime); }} />
                <button type="button" aria-label="Voltar ao atendimento" onClick={() => setDrawerOpen(false)} className={`${iconButton} h-[30px] w-[30px] lg:hidden`}><X /></button>
              </div>
            </div>
            <div className="flex h-[38px] items-center gap-2.5 rounded-[10px] border border-[#1E241F] bg-[#070807] pl-3 pr-1 focus-within:border-palco/40">
              <Search aria-hidden="true" className="h-[15px] w-[15px] shrink-0 text-[#6E776F]" />
              <input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Nome, telefone ou mensagem"
                aria-label="Buscar conversas por nome, telefone ou mensagem"
                className="h-full min-w-0 flex-1 bg-transparent text-[13px] text-neutral-100 placeholder:text-[#6E776F] focus:outline-none" />
              <Popover>
                <PopoverTrigger asChild>
                  <button type="button" aria-label="Filtros das conversas" title="Filtros das conversas"
                    className={`relative grid h-[30px] w-[30px] shrink-0 place-items-center rounded-md text-[#7C867E] hover:bg-[#121512] hover:text-neutral-100 ${focusRing}`}>
                    <Filter className="h-[15px] w-[15px]" />
                    {filtersActive && <span aria-hidden="true" className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-palco" />}
                  </button>
                </PopoverTrigger>
                <PopoverContent aria-label="Filtrar conversas" align="end" sideOffset={8} className={`${surface} flex w-72 flex-col gap-3 p-3`}>
                  <div>
                    <h3 className="text-xs font-semibold">Filtrar conversas</h3>
                    <p className="text-[11px] text-[#7C867E]">Horário de Brasília</p>
                  </div>
                  <label className="flex flex-col gap-1 text-[11px] text-neutral-400">Webinar
                    <span className="relative">
                      <select aria-label="Filtrar por webinar" value={filter} onChange={e => setFilter(e.target.value)} className={selectClass}>
                        <option value="all">Todos os webinars</option>
                        {webinars.map(w => <option key={w.id} value={w.id}>{w.phase === "before" ? "[Em breve] " : w.phase === "open" ? "[Ao vivo] " : ""}{w.title}</option>)}
                      </select>
                      <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-2.5 top-2.5 h-3.5 w-3.5 text-[#6E776F]" />
                    </span>
                  </label>
                  <label className="flex flex-col gap-1 text-[11px] text-neutral-400">Responsável
                    <span className="relative">
                      <select aria-label="Filtrar por atendente" value={attendant} onChange={e => setAttendant(e.target.value)} className={selectClass}>
                        <option value="all">Todos os atendentes</option><option value="unassigned">Sem responsável</option>
                        {attendants.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}
                      </select>
                      <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-2.5 top-2.5 h-3.5 w-3.5 text-[#6E776F]" />
                    </span>
                  </label>
                  {filtersActive && <button type="button" onClick={() => { setFilter("all"); setAttendant("all"); }} className="self-start text-xs font-semibold text-palco hover:underline">Limpar filtros</button>}
                </PopoverContent>
              </Popover>
            </div>
            <div role="tablist" aria-label="Status dos atendimentos" className="grid grid-cols-4 rounded-[10px] border border-[#1E241F] bg-[#070807] p-[3px]">
              {tabs.map(([value, label]) => {
                const selected = tab === value;
                const count = searchedConversations.filter(c => matchesTab(c, value)).length;
                return (
                  <button role="tab" aria-selected={selected} type="button" key={value} onClick={() => setTab(value)}
                    className={`flex min-w-0 flex-col items-center gap-px rounded-[7px] py-1.5 transition-colors ${focusRing} ${selected ? "bg-palco/[0.12]" : "hover:bg-[#121512]"}`}>
                    <span className={`text-sm font-bold tabular-nums ${selected ? "text-palco" : value === "pending" && count ? "text-[#F5B742]" : "text-[#C9D1CA]"}`}>{count}</span>
                    <span className={`max-w-full truncate text-[11px] font-medium ${selected ? "text-palco" : "text-[#7C867E]"}`}>{label}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto p-2">
            {conversationsLoaded && filteredConversations.length === 0 && <div className="flex flex-col items-center gap-2 px-6 py-12 text-center text-[13px] text-[#7C867E]">
              <MessageSquare aria-hidden="true" className="h-5 w-5" /><p>{query ? "Nenhuma conversa encontrada." : "Nenhuma conversa neste filtro."}</p>
            </div>}
            {filteredConversations.map(c => {
              const selected = selectedLeadId === c.leadId;
              const pendingNow = c.pending && !c.closedAt;
              const when = relativeTime(c.lastAt, nowMs);
              return (
                <button key={c.leadId} type="button" onClick={() => selectConversation(c.leadId)} aria-pressed={selected}
                  className={`flex w-full gap-3 rounded-[10px] border p-3 text-left transition-colors ${focusRing} ${selected ? "border-palco/20 bg-palco/[0.07]" : "border-transparent hover:bg-[#0F120F]"}`}>
                  <span className={`relative grid h-9 w-9 shrink-0 place-items-center rounded-full text-[13px] font-bold ${pendingNow ? "bg-[#F5B742]/15 text-[#F5B742]" : "bg-[#1A1F1B] text-[#C9D1CA]"}`}>
                    {initialOf(c.leadName)}
                    {c.online && <span aria-hidden="true" className="absolute -bottom-px -right-px h-2.5 w-2.5 rounded-full border-2 border-[#090B09] bg-palco" />}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className={`truncate text-sm text-neutral-100 ${pendingNow ? "font-bold" : "font-semibold"}`}>{c.leadName}{c.online && <span className="sr-only"> (na sala agora)</span>}</span>
                      {when && <span className={`shrink-0 text-[11px] tabular-nums ${when === "agora" && pendingNow ? "font-bold text-[#F5B742]" : "text-[#6E776F]"}`}>{when}</span>}
                    </span>
                    {c.webinarPhase === "before"
                      ? <span className="flex items-center gap-1 text-xs text-[#F5B742]"><Clock aria-hidden="true" className="h-3 w-3" />começa em {formatCountdown(c.webinarStartDate, nowMs)}</span>
                      : <span className={`line-clamp-2 text-[13px] leading-[1.4] [overflow-wrap:anywhere] ${pendingNow ? "text-neutral-100" : "text-neutral-400"}`}>{c.lastText}</span>}
                    <span className="flex min-w-0 items-center gap-2 pt-0.5">
                      {c.closedAt ? <span className="shrink-0 rounded-full bg-[#1A1F1B] px-[7px] py-px text-[10px] font-bold text-[#7C867E]">finalizada</span>
                        : pendingNow ? <span className="shrink-0 rounded-full bg-[#F5B742]/[0.12] px-[7px] py-px text-[10px] font-bold text-[#F5B742]">pendente</span>
                          : <span className="shrink-0 rounded-full bg-palco/[0.08] px-[7px] py-px text-[10px] font-bold text-palco">respondida</span>}
                      <span className="truncate text-[11px] text-[#6E776F]">{c.webinarTitle}</span>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        <section aria-label="Área de atendimento" className="flex min-h-0 min-w-0 flex-col">
          {!selectedConversation && <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
            <span aria-hidden="true" className="mb-2 grid h-12 w-12 place-items-center rounded-2xl bg-palco/[0.08] text-palco"><MessageSquare className="h-5 w-5" /></span>
            <h2 className="text-base font-bold">{linkError ? "Não foi possível abrir a conversa" : selectedLeadId ? "Abrindo conversa…" : "Tudo começa com uma conversa"}</h2>
            <p className="max-w-sm text-[13px] text-neutral-400">{linkError || (selectedLeadId ? "Buscando o histórico do atendimento." : "Selecione uma conversa para acompanhar o histórico e responder ao seu público.")}</p>
            {!selectedLeadId && <button type="button" onClick={() => setDrawerOpen(true)} className={`${primaryButton} mt-2 lg:hidden`}>Ver conversas <ArrowRight /></button>}
            {linkError && selectedLeadId && <button type="button" onClick={() => { setLinkError(""); void fetchLinkedConversation(selectedLeadId); }} className={`${outlineButton} mt-2`}>Tentar novamente</button>}
          </div>}

          {selectedConversation && <>
            <div ref={conversationHeaderRef} className="flex min-h-[68px] shrink-0 items-center gap-3 border-b border-[#1A1F1B] bg-[#0A0C0A] px-3 py-3 sm:px-6">
              <button type="button" onClick={() => setDrawerOpen(true)} data-screenshot-exclude aria-label="Voltar às conversas" className={`${iconButton} lg:hidden`}><ArrowLeft /></button>
              <span className={`grid h-[38px] w-[38px] shrink-0 place-items-center rounded-full text-sm font-bold ${selectedConversation.pending && !selectedConversation.closedAt ? "bg-[#F5B742]/15 text-[#F5B742]" : "bg-[#1A1F1B] text-[#C9D1CA]"}`}>{initialOf(selectedConversation.leadName)}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-bold leading-5">{selectedConversation.leadName}</p>
                <p className="flex min-w-0 items-center gap-1.5 text-xs leading-4 text-neutral-400">
                  <span aria-hidden="true" className={`h-1.5 w-1.5 shrink-0 rounded-full ${selectedConversation.online ? "bg-palco" : "bg-[#3A423B]"}`} />
                  <span className="truncate">{selectedConversation.online ? "Na sala agora" : "Fora da sala"} · {selectedConversation.webinarTitle}</span>
                  {selectedConversation.aiEnabled && selectedConversation.aiPaused && !selectedConversation.closedAt && <span className="shrink-0 rounded-full bg-[#1A1F1B] px-1.5 text-[10px] font-semibold text-[#7C867E]">IA pausada</span>}
                </p>
              </div>
              <div data-screenshot-exclude className="flex shrink-0 items-center gap-2">
                {conversationsLoaded && !filteredConversations.some(c => c.leadId === selectedLeadId) && <Popover>
                  <PopoverTrigger asChild><button type="button" aria-label="Conversa fora dos filtros" title="Conversa fora dos filtros" className={iconButton}><Filter /></button></PopoverTrigger>
                  <PopoverContent aria-label="Conversa fora dos filtros" align="end" className={`${surface} w-64 p-3`}><p className="text-xs leading-relaxed text-neutral-300">Esta conversa está fora dos filtros da lista. Você pode continuar o atendimento normalmente.</p></PopoverContent>
                </Popover>}
                {!selectedConversation.closedAt && (aiActive || selectedConversation.assignedAttendantId !== attendantId) &&
                  <button type="button" disabled={controlBusy} onClick={() => void changeControl("takeover")} className={`${outlineButton} hidden md:inline-flex`}>
                    <UserCheck aria-hidden="true" />{aiActive ? "Assumir e pausar IA" : "Assumir conversa"}
                  </button>}
                {whatsapp
                  ? <a href={whatsapp} target="_blank" rel="noopener noreferrer" aria-label={`Abrir WhatsApp de ${selectedConversation.leadName}`} className={`${outlineButton} max-sm:w-[34px] max-sm:justify-center max-sm:px-0`}><Phone aria-hidden="true" /><span className="max-sm:sr-only">WhatsApp</span></a>
                  : <button type="button" disabled title="Contato sem telefone" className={`${outlineButton} max-sm:hidden`}><Phone aria-hidden="true" />WhatsApp</button>}
                {selectedConversation.closedAt
                  ? <button type="button" disabled={controlBusy} onClick={() => void changeControl("reopen")} className={primaryButton}>Reabrir e assumir</button>
                  : <button type="button" disabled={controlBusy} onClick={() => void changeControl("close")} aria-label="Finalizar atendimento" className={`${primaryButton} max-sm:w-[34px] max-sm:justify-center max-sm:px-0`}><Check aria-hidden="true" /><span className="max-sm:sr-only">Finalizar</span></button>}
                <button type="button" onClick={() => setDetailsOpen(true)} aria-label="Detalhes do contato" title="Detalhes do contato" className={`${iconButton} xl:hidden`}><Info /></button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild><button type="button" aria-label="Ações da conversa" title="Ações da conversa" className={iconButton}><MoreHorizontal /></button></DropdownMenuTrigger>
                  <DropdownMenuContent align="end" sideOffset={8} className={`${surface} w-56 p-1.5`}>
                    {!selectedConversation.closedAt && (aiActive || selectedConversation.assignedAttendantId !== attendantId) && <DropdownMenuItem disabled={controlBusy} onSelect={() => void changeControl("takeover")} className={`${menuItem} md:hidden`}><UserCheck />{aiActive ? "Assumir e pausar IA" : "Assumir conversa"}</DropdownMenuItem>}
                    <DropdownMenuItem onSelect={() => void copyScreenshot()} disabled={copyingScreenshot || !thread.length} className={menuItem}><ImageIcon />{copyingScreenshot ? "Copiando print…" : "Copiar print"}</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => void copyConversationLink()} className={menuItem}><Copy />Copiar link</DropdownMenuItem>
                    {!selectedConversation.closedAt && <DropdownMenuItem disabled={controlBusy} onSelect={() => { setControlError(""); setTransferTarget(""); setTransferOpen(true); }} className={menuItem}><Users />Transferir atendimento</DropdownMenuItem>}
                    {isAdmin && <DropdownMenuItem asChild className={menuItem}><a href={`/dashboard/webinars/${selectedConversation.webinarId}/chat-ai`}><Sparkles />Configurar agente</a></DropdownMenuItem>}
                    {!selectedConversation.closedAt && selectedConversation.aiEnabled && selectedConversation.aiPaused && <DropdownMenuItem disabled={controlBusy} onSelect={() => void changeControl("resume")} className={menuItem}><Sparkles />Retomar IA</DropdownMenuItem>}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            {selectedConversation.aiError && <p className="shrink-0 border-b border-[#1A1F1B] px-6 py-2 text-xs text-[#F5B742]">A IA não conseguiu responder. O atendimento humano pode assumir.</p>}
            {controlError && <p role="alert" className="shrink-0 px-6 py-2 text-xs text-red-400">{controlError}</p>}
            <div ref={threadScrollRef} aria-label="Mensagens da conversa" role="log" aria-live="polite"
              className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-[#0A0C0A] px-4 py-6 sm:px-8">
              <div className="mt-auto flex flex-col">
                <ConversationMessages messages={thread} leadName={selectedConversation.leadName} />
              </div>
            </div>
            {waitingSince !== null && <div className="flex shrink-0 justify-center px-4 pb-3">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F5B742]/10 px-2.5 py-1 text-xs font-semibold text-[#F5B742]">
                <Clock aria-hidden="true" className="h-3 w-3" />Aguardando resposta humana há {waitingLabel}
              </span>
            </div>}
            {failedReplies.length > 0 && <div role="alert" className="max-h-40 shrink-0 space-y-2 overflow-y-auto border-t border-[#1A1F1B] px-6 py-2 text-xs text-red-400">
              <p>Não foi possível confirmar o envio. As respostas foram mantidas.</p>
              {failedReplies.map(attempt => <div key={attempt.clientMessageId} className="flex items-start gap-3">
                <p className="min-w-0 flex-1 whitespace-pre-wrap break-words">{attempt.text}</p>
                <button type="button" disabled={sending} onClick={() => void sendAttempt(selectedLeadId!, attempt)} aria-label={`Reenviar resposta: ${attempt.text}`} className={`${outlineButton} h-7`}>Reenviar</button>
              </div>)}
            </div>}
            {!selectedConversation.closedAt ? <form onSubmit={e => { e.preventDefault(); handleSend(); }} className="flex shrink-0 flex-col gap-2.5 border-t border-[#1A1F1B] px-3 pb-5 pt-3.5 sm:px-6">
              {suggestionUnavailable && <p className="flex items-center gap-2.5 rounded-[10px] border border-[#1E241F] bg-[#0C0E0C] px-3 py-2.5 text-[13px] leading-[1.4] text-[#7C867E]">
                <Sparkles aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />Sugestão da IA indisponível: a integração com a OpenAI não está configurada.
              </p>}
              {suggestion && <div className="flex items-center gap-2.5 rounded-[10px] border border-palco/20 bg-palco/[0.05] px-3 py-2.5">
                <Sparkles aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-palco" />
                <p className="min-w-0 flex-1 text-[13px] leading-[1.4] text-[#C9D1CA]">
                  {suggestion.status === "loading" ? <span className="text-[#7C867E]">Gerando sugestão com {selectedConversation.aiName}…</span>
                    : suggestion.status === "error" ? <span className="text-[#7C867E]">Não foi possível gerar uma sugestão agora.</span>
                      : <>Sugestão: “{suggestion.text}”</>}
                </p>
                {suggestion.status === "ready" && <button type="button" onClick={() => {
                  const leadId = selectedRef.current;
                  if (!leadId || !suggestion.text) return;
                  setDrafts(previous => ({ ...previous, [leadId]: suggestion.text!.slice(0, 500) }));
                  composerRef.current?.focus();
                }} aria-label="Usar sugestão da IA" className={`shrink-0 rounded-lg bg-palco/[0.12] px-2.5 py-[5px] text-xs font-bold text-palco hover:bg-palco/20 ${focusRing}`}>Usar</button>}
                {suggestion.status === "error" && <button type="button" onClick={() => setSuggestions(previous => { const next = { ...previous }; delete next[suggestionKey!]; return next; })}
                  className={`shrink-0 rounded-lg bg-palco/[0.12] px-2.5 py-[5px] text-xs font-bold text-palco hover:bg-palco/20 ${focusRing}`}>Tentar de novo</button>}
              </div>}
              <div className="relative flex min-h-12 items-center gap-2.5 rounded-xl border border-[#1E241F] bg-[#070807] py-1.5 pl-2 pr-2 focus-within:border-palco/40">
                <QuickReplies ref={quickRepliesRef} draft={text} composerRef={composerRef}
                  onInsert={value => { const leadId = selectedRef.current; if (leadId) setDrafts(previous => ({ ...previous, [leadId]: value })); }} />
                <textarea ref={composerRef} value={text} onChange={e => { const leadId = selectedRef.current; if (leadId) setDrafts(previous => ({ ...previous, [leadId]: e.target.value })); }} maxLength={500}
                  onKeyDown={e => {
                    if (quickRepliesRef.current?.handleKey(e)) { e.preventDefault(); return; }
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
                  }}
                  placeholder="Escreva uma resposta…  ( / para respostas rápidas)" aria-label="Escreva uma resposta" aria-haspopup="listbox" aria-controls="quick-replies-list" aria-autocomplete="list"
                  title="Enter para enviar · Shift + Enter para nova linha · / para respostas rápidas" rows={1}
                  className="max-h-32 min-h-[22px] min-w-0 flex-1 resize-none bg-transparent py-1 text-sm leading-[22px] text-neutral-100 [field-sizing:content] placeholder:text-[#6E776F] focus:outline-none" />
                {text.length > 400 && <span className="shrink-0 text-[11px] tabular-nums text-[#6E776F]">{text.length}/500</span>}
                <button type="submit" disabled={!text.trim() || sending} aria-label="Enviar resposta" className={`grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[9px] bg-palco text-palco-ink transition-colors hover:bg-[#45e88c] disabled:opacity-40 ${focusRing}`}><Send className="h-4 w-4" /></button>
              </div>
            </form> : <div className="flex shrink-0 items-center justify-center gap-2 border-t border-[#1A1F1B] px-6 py-5 text-[13px] text-[#7C867E]"><CheckCircle2 aria-hidden="true" className="h-4 w-4" />Atendimento finalizado</div>}
            <Dialog open={transferOpen} onOpenChange={value => { if (!controlBusy) setTransferOpen(value); }}>
              <DialogContent className={`${surface} rounded-2xl sm:max-w-md`}>
                <DialogHeader><DialogTitle>Transferir atendimento</DialogTitle><DialogDescription className="text-neutral-400">Escolha quem dará continuidade à conversa com {selectedConversation.leadName}. A IA ficará pausada.</DialogDescription></DialogHeader>
                <label className="space-y-2 text-sm">Novo responsável
                  <select aria-label="Novo responsável" value={transferTarget} onChange={e => setTransferTarget(e.target.value)} disabled={controlBusy} className={`${selectClass} mt-2 h-10 text-sm`}>
                    <option value="">Selecione um atendente</option>{attendants.filter(person => person.id !== selectedConversation.assignedAttendantId).map(person => <option key={person.id} value={person.id}>{person.name}</option>)}
                  </select>
                </label>
                {controlError && <p role="alert" className="text-sm text-red-400">{controlError}</p>}
                <div className="flex justify-end gap-2"><button type="button" disabled={controlBusy} onClick={() => setTransferOpen(false)} className={outlineButton}>Cancelar</button><button type="button" disabled={controlBusy || !transferTarget} onClick={() => void changeControl("transfer", transferTarget)} className={primaryButton}>{controlBusy ? "Transferindo…" : "Confirmar transferência"}</button></div>
              </DialogContent>
            </Dialog>
          </>}
        </section>

        {selectedConversation && <>
          <button type="button" aria-label="Fechar detalhes" aria-hidden={!detailsOpen} tabIndex={-1} onClick={() => setDetailsOpen(false)}
            className={`absolute inset-0 z-20 bg-black/50 transition-opacity motion-reduce:transition-none xl:hidden ${detailsOpen ? "opacity-100" : "pointer-events-none opacity-0"}`} />
          <aside aria-label="Detalhes do contato"
            className={`absolute inset-y-0 right-0 z-30 w-[min(300px,92vw)] overflow-y-auto border-l border-[#1A1F1B] bg-[#090B09] p-5 transition-transform duration-200 motion-reduce:transition-none xl:static xl:z-auto xl:w-auto xl:translate-x-0 ${detailsOpen ? "translate-x-0" : "translate-x-full"}`}>
            <button type="button" onClick={() => setDetailsOpen(false)} aria-label="Fechar detalhes" className={`${iconButton} mb-4 h-[30px] w-[30px] xl:hidden`}><X /></button>
            <ContactPanel key={selectedConversation.leadId} conversation={selectedConversation} details={details[selectedConversation.leadId] ?? null} onAddNote={addNote} />
          </aside>
        </>}
        {!selectedConversation && <div aria-hidden="true" className="hidden border-l border-[#1A1F1B] bg-[#090B09] xl:block" />}
      </div>
    </div>
  );
}
