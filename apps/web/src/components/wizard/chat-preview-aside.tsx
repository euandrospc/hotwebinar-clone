"use client";
import { useState } from "react";
import { Download, Search, Trash2, Rocket, Pencil, Check, Zap } from "@/components/icons";
import { palcoButtonDanger, palcoButtonOutline, palcoButtonPrimary, palcoInput, palcoTime } from "./palco-fields";
import { Input } from "@/components/ui/input";
import { SecondsInput } from "@/components/ui/seconds-input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import { palcoFonts } from "@/components/admin/palco-fonts";

export interface ChatRowValue {
  id?: string;
  authorName: string;
  text: string;
  showAtSec: number;
  isOwner: boolean;
}

export interface ChatPreviewAsideProps {
  webinarId: string;
  slug: string | null;
  messages: ChatRowValue[];
  onUpdate: (originalIdx: number, patch: Partial<ChatRowValue>) => void;
  onDelete: (originalIdx: number) => void;
  onDeleteAll: () => void;
}

function formatTime(totalSec: number): string {
  const total = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

export function ChatPreviewAside({ webinarId, slug, messages, onUpdate, onDelete, onDeleteAll }: ChatPreviewAsideProps) {
  const [q, setQ] = useState("");
  const [editingIdx, setEditingIdx] = useState<number | null>(null);

  const needle = q.toLowerCase();
  // Shown in video order (imported/AI rows are appended at the end); indices still point at the form array.
  const filtered = messages
    .map((m, i) => [m, i] as const)
    .filter(([m]) => !needle || m.authorName.toLowerCase().includes(needle) || m.text.toLowerCase().includes(needle))
    .sort(([a], [b]) => a.showAtSec - b.showAtSec);

  return (
    <aside className="flex min-w-0 flex-col gap-3 rounded-2xl border border-[#1E241F] bg-[#0C0E0C] p-5 font-palco text-neutral-100 xl:sticky xl:top-[76px]">
      <h3 className="text-lg font-semibold">Prévia do chat</h3>

      <a href={`/api/webinars/${webinarId}/messages/export`} download className={`${palcoButtonOutline} w-full`}>
        <Download aria-hidden /> Exportar mensagens em XLSX
      </a>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-[#7C867E]" aria-hidden />
        <Input placeholder="Buscar mensagens" aria-label="Buscar mensagens" value={q} onChange={(e) => setQ(e.target.value)} className={`${palcoInput} pl-10`} />
      </div>

      <div className="max-h-[402px] overflow-y-auto rounded-xl border border-[#1E241F] [scrollbar-width:thin] [&>*+*]:border-t [&>*+*]:border-[#1A1F1B]">
        {filtered.length === 0 && <p className="p-6 text-center text-xs text-[#7C867E]">{q ? "Nenhuma mensagem encontrada." : "Nenhuma mensagem."}</p>}

        {filtered.map(([m, originalIdx]) => {
          const editing = editingIdx === originalIdx;

          if (editing) {
            return (
              <div key={m.id ?? `idx-${originalIdx}`} className="flex flex-col gap-2 bg-[#0F120F] p-3.5">
                <SecondsInput value={m.showAtSec} onChange={(v) => onUpdate(originalIdx, { showAtSec: v ?? 0 })} aria-label="Tempo" className={palcoTime} />
                <Input
                  value={m.authorName}
                  onChange={(e) => onUpdate(originalIdx, { authorName: e.target.value })}
                  placeholder="Nome"
                  aria-label="Nome"
                  className={`${palcoInput} h-9 text-[13px]`}
                />
                <Input
                  value={m.text}
                  onChange={(e) => onUpdate(originalIdx, { text: e.target.value })}
                  placeholder="Mensagem"
                  aria-label="Mensagem"
                  className={`${palcoInput} h-9 text-[13px]`}
                />
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <button
                    type="button"
                    aria-pressed={m.isOwner}
                    onClick={() => onUpdate(originalIdx, { isOwner: !m.isOwner })}
                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-palco/60 ${
                      m.isOwner ? "border-[#F5B742]/40 bg-[#F5B742]/10 text-[#F5B742]" : "border-[#1E241F] text-[#7C867E] hover:text-neutral-100"
                    }`}
                  >
                    <Zap className="h-3 w-3" aria-hidden /> Mensagem do apresentador
                  </button>
                  <div className="flex items-center gap-1.5">
                    <button type="button" onClick={() => onDelete(originalIdx)} className={`${palcoButtonDanger} h-8 border-transparent px-2.5 text-xs`}>
                      <Trash2 aria-hidden /> Excluir
                    </button>
                    <button type="button" onClick={() => setEditingIdx(null)} className={`${palcoButtonPrimary} h-8 px-2.5 text-xs`}>
                      <Check aria-hidden /> Concluir
                    </button>
                  </div>
                </div>
              </div>
            );
          }

          return (
            <div key={m.id ?? `idx-${originalIdx}`} className="group flex min-h-[50px] items-center gap-3.5 px-3.5 py-2 transition-colors hover:bg-[#0F120F] motion-reduce:transition-none">
              <span className="shrink-0 font-mono text-[11px] tabular-nums text-[#6E776F]">{formatTime(m.showAtSec)}</span>
              <p className="min-w-0 flex-1 truncate text-[13px]">
                <span className={`mr-1.5 font-semibold ${m.isOwner ? "text-[#F5B742]" : "text-palco"}`}>{m.authorName || "Sem nome"}</span>
                <span className="text-neutral-100">{m.text}</span>
                {m.isOwner && <Zap className="ml-1 inline h-3.5 w-3.5 text-[#F5B742]" aria-label="Apresentador" />}
              </p>
              <div className="flex shrink-0 items-center">
                <button
                  type="button"
                  onClick={() => setEditingIdx(originalIdx)}
                  aria-label="Editar"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[#7C867E] transition-colors hover:bg-[#1A1F1B] hover:text-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-palco/60 motion-reduce:transition-none"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(originalIdx)}
                  aria-label="Excluir"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[#F87171]/60 transition-colors hover:bg-[#DC2626]/10 hover:text-[#F87171] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F87171]/60 motion-reduce:transition-none"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-2.5 sm:flex-row">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button type="button" className={`${palcoButtonDanger} sm:flex-1`} disabled={messages.length === 0}>
              <Trash2 aria-hidden /> Excluir todo o chat
            </button>
          </AlertDialogTrigger>
          {/* Portaled outside the admin shell, so the Palco font variables are set again here. */}
          <AlertDialogContent className={`${palcoFonts} border-[#1E241F] bg-[#0C0E0C] font-palco text-neutral-100 sm:rounded-2xl`}>
            <AlertDialogHeader>
              <AlertDialogTitle className="text-lg">Excluir todo o chat?</AlertDialogTitle>
              <AlertDialogDescription className="text-[13px] text-neutral-400">
                {messages.length} {messages.length === 1 ? "mensagem será removida" : "mensagens serão removidas"} da lista. A exclusão só é gravada quando você clicar em Continuar.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2">
              <AlertDialogCancel className={`${palcoButtonOutline} mt-0 bg-transparent`}>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={onDeleteAll} className={`${palcoButtonDanger} bg-transparent`}>
                <Trash2 aria-hidden /> Excluir todo o chat
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        {slug ? (
          <a href={`/${slug}/live`} target="_blank" rel="noopener noreferrer" className={`${palcoButtonPrimary} sm:flex-1`}>
            <Rocket aria-hidden /> Testar no player
          </a>
        ) : null}
      </div>
    </aside>
  );
}
