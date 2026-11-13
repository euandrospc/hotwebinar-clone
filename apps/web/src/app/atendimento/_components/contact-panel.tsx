"use client";

import { useState, type ReactNode } from "react";
import { Check, Pencil } from "@/components/icons";
import { ATTENDANCE_TIMEZONE, attendanceToday } from "@/lib/attendance-range";

export interface LeadDetails {
  phone: string | null;
  firstAccessAt: string;
  conversations: number;
  journey: {
    enteredAt: string | null;
    watchedSec: number;
    videoDurationSec: number | null;
    reachedPitch: boolean;
    pitchAt: string | null;
    pitchAtSec: number | null;
    offerClickAt: string | null;
    purchasedAt: string | null;
    purchaseAmount: { cents: number; currency: string } | null;
  };
  aiReplies: number;
  notes: Array<{ id: string; text: string; createdAt: string; authorName: string | null }>;
}

export interface PanelConversation {
  closedAt: string | null;
  pending: boolean;
  aiEnabled: boolean;
  aiUnavailable?: boolean;
  aiPaused: boolean;
  aiName: string;
  assignedAttendantName: string | null;
}

const time = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: ATTENDANCE_TIMEZONE });
const day = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", timeZone: ATTENDANCE_TIMEZONE });

export function formatMoment(iso: string | null, withDay = false) {
  if (!iso) return "—";
  const date = new Date(iso);
  const clock = time.format(date);
  if (!withDay && attendanceToday(date) === attendanceToday()) return clock;
  return `${day.format(date).replace(/\.$/, "").replace(" de ", " ")}, ${clock}`;
}

function videoClock(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-[11px] font-bold uppercase tracking-[0.11em] text-[#6E776F]">{title}</h3>
      {children}
    </section>
  );
}

function Row({ label, value, tone = "text-neutral-100", title }: { label: string; value: ReactNode; tone?: string; title?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-[13px]">
      <dt className="text-neutral-400">{label}</dt>
      <dd title={title} className={`min-w-0 truncate text-right font-semibold tabular-nums ${tone}`}>{value}</dd>
    </div>
  );
}

interface ContactPanelProps {
  conversation: PanelConversation;
  details: LeadDetails | null;
  onAddNote: (text: string) => Promise<boolean>;
}

export function ContactPanel({ conversation, details, onAddNote }: ContactPanelProps) {
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const journey = details?.journey;
  const watchedMin = journey ? Math.floor(journey.watchedSec / 60) : 0;
  const watchedPct = journey?.videoDurationSec ? Math.min(100, Math.round((journey.watchedSec / journey.videoDurationSec) * 100)) : null;
  const money = journey?.purchaseAmount
    ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: journey.purchaseAmount.currency }).format(journey.purchaseAmount.cents / 100)
    : undefined;
  const steps = journey ? [
    { label: "Entrou na sala", done: !!journey.enteredAt, meta: formatMoment(journey.enteredAt) },
    { label: `Assistiu ${watchedMin} min`, done: journey.watchedSec > 0, meta: watchedPct === null || !journey.watchedSec ? "—" : `${watchedPct}% do vídeo` },
    { label: "Chegou ao pitch", done: journey.reachedPitch,
      meta: journey.reachedPitch ? formatMoment(journey.pitchAt) : journey.pitchAtSec != null ? `em ${videoClock(journey.pitchAtSec)}` : "—" },
    { label: "Clicou na oferta", done: !!journey.offerClickAt, meta: formatMoment(journey.offerClickAt) },
    { label: "Comprou", done: !!journey.purchasedAt, meta: formatMoment(journey.purchasedAt), title: money },
  ] : [];
  const status = conversation.closedAt
    ? { label: "Finalizada", tone: "text-neutral-400" }
    : conversation.pending ? { label: "Pendente", tone: "text-[#F5B742]" } : { label: "Respondida", tone: "text-palco" };
  const aiActive = conversation.aiEnabled && !conversation.aiPaused;
  const aiReplies = details?.aiReplies ?? 0;
  const ai = conversation.aiUnavailable
    ? { label: "Indisponível", tone: "text-[#F5B742]", title: "Integração com a OpenAI não configurada no servidor" }
    : !conversation.aiEnabled
    ? { label: "Desativado", tone: "text-neutral-400" }
    : aiReplies
      ? { label: `Respondeu ${aiReplies} ${aiReplies === 1 ? "vez" : "vezes"}${conversation.aiPaused ? " · pausado" : ""}`, tone: conversation.aiPaused ? "text-neutral-400" : "text-palco" }
      : { label: conversation.aiPaused ? "Pausado" : "Ativo", tone: conversation.aiPaused ? "text-neutral-400" : "text-palco" };

  async function submitNote() {
    const text = note.trim();
    if (!text || saving) return;
    setSaving(true);
    if (await onAddNote(text)) setNote("");
    setSaving(false);
  }

  return (
    <div className="flex flex-col gap-[22px]">
      <Section title="Contato">
        <dl className="flex flex-col gap-3">
          <Row label="Telefone" value={details ? details.phone ?? "—" : "…"} />
          <Row label="Primeiro acesso" value={details ? formatMoment(details.firstAccessAt, true) : "…"} />
          <Row label="Conversas" value={details ? details.conversations === 1 ? "1ª vez" : `${details.conversations} conversas` : "…"} />
        </dl>
      </Section>

      <Section title="Jornada na sala">
        {!journey ? <p className="text-[13px] text-[#6E776F]">Carregando…</p> : (
          <ol className="flex flex-col gap-2.5">
            {steps.map(step => (
              <li key={step.label} className="flex items-center gap-2.5 text-[13px]">
                <span aria-hidden="true" className={`grid h-5 w-5 shrink-0 place-items-center rounded-full ${step.done ? "bg-palco/[0.12] text-palco" : "bg-[#1A1F1B]"}`}>
                  {step.done ? <Check className="h-[11px] w-[11px]" /> : <span className="h-[9px] w-[9px] rounded-full border border-dashed border-[#6E776F]" />}
                </span>
                <span className={`min-w-0 flex-1 truncate ${step.done ? "text-neutral-100" : "text-[#7C867E]"}`}>
                  {step.label}<span className="sr-only">{step.done ? " (concluído)" : " (não concluído)"}</span>
                </span>
                <span title={step.title} className="shrink-0 text-xs tabular-nums text-[#6E776F]">{step.meta}</span>
              </li>
            ))}
          </ol>
        )}
      </Section>

      <Section title="Nesta conversa">
        <dl className="flex flex-col gap-3">
          <Row label="Atendente" value={conversation.assignedAttendantName ?? (aiActive ? conversation.aiName : "—")} />
          <Row label="Status" value={status.label} tone={status.tone} />
          <Row label="Agente IA" value={ai.label} tone={ai.tone} title={"title" in ai ? ai.title : undefined} />
        </dl>
      </Section>

      <div className="flex flex-col gap-2.5">
        <form onSubmit={event => { event.preventDefault(); void submitNote(); }}
          className="flex items-center gap-2 rounded-[10px] border border-[#1E241F] bg-[#0F130F] px-3 focus-within:border-palco/40">
          <Pencil aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-[#7C867E]" />
          <input value={note} onChange={event => setNote(event.target.value)} maxLength={1000} disabled={saving}
            placeholder="Adicionar nota interna…" aria-label="Adicionar nota interna"
            className="h-11 min-w-0 flex-1 bg-transparent text-[13px] text-neutral-100 placeholder:text-[#6E776F] focus:outline-none" />
          {note.trim() && <button type="submit" disabled={saving} className="shrink-0 rounded-md bg-palco/[0.12] px-2 py-1 text-xs font-bold text-palco disabled:opacity-50">
            {saving ? "Salvando…" : "Salvar"}
          </button>}
        </form>
        {!!details?.notes.length && (
          <ul aria-label="Notas internas" className="flex flex-col gap-2">
            {details.notes.map(item => (
              <li key={item.id} className="rounded-[10px] border border-[#1A1F1B] bg-[#0C0E0C] px-3 py-2">
                <p className="whitespace-pre-wrap text-[13px] leading-[1.45] text-neutral-100 [overflow-wrap:anywhere]">{item.text}</p>
                <p className="mt-1 text-[11px] text-[#6E776F]">{item.authorName ?? "Atendente removido"} · {formatMoment(item.createdAt)}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
