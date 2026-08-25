"use client";
import { useState } from "react";
import { Download, Search, Trash2, Rocket, Pencil, Check, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SecondsInput } from "@/components/ui/seconds-input";

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

  const filtered = q
    ? messages
        .map((m, i) => [m, i] as const)
        .filter(([m]) => m.authorName.toLowerCase().includes(q.toLowerCase()) || m.text.toLowerCase().includes(q.toLowerCase()))
    : messages.map((m, i) => [m, i] as const);

  return (
    <aside className="flex h-fit flex-col gap-3 rounded-xl border bg-card p-4">
      <h3 className="text-sm font-semibold">Prévia do chat</h3>

      <Button asChild type="button" className="w-full bg-emerald-800 text-white hover:bg-emerald-900">
        <a href={`/api/webinars/${webinarId}/messages/export`} download>
          <Download className="mr-2 h-4 w-4" /> Exportar mensagens em XLSX
        </a>
      </Button>

      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input placeholder="Buscar mensagens" value={q} onChange={(e) => setQ(e.target.value)} className="pl-8" />
      </div>

      <div className="max-h-[460px] divide-y overflow-y-auto rounded-lg border">
        {filtered.length === 0 && <p className="p-6 text-center text-xs text-muted-foreground">Nenhuma mensagem.</p>}

        {filtered.map(([m, originalIdx]) => {
          const editing = editingIdx === originalIdx;

          if (editing) {
            return (
              <div key={m.id ?? `idx-${originalIdx}`} className="space-y-2 bg-muted/30 p-3">
                <SecondsInput value={m.showAtSec} onChange={(v) => onUpdate(originalIdx, { showAtSec: v ?? 0 })} aria-label="Tempo" />
                <Input
                  value={m.authorName}
                  onChange={(e) => onUpdate(originalIdx, { authorName: e.target.value })}
                  placeholder="Nome"
                  className="h-9 text-sm"
                />
                <Input
                  value={m.text}
                  onChange={(e) => onUpdate(originalIdx, { text: e.target.value })}
                  placeholder="Mensagem"
                  className="h-9 text-sm"
                />
                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={() => onUpdate(originalIdx, { isOwner: !m.isOwner })}
                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs ${
                      m.isOwner ? "border-amber-500/40 bg-amber-500/10 text-amber-600" : "text-muted-foreground"
                    }`}
                  >
                    <Zap className="h-3 w-3" /> Mensagem do apresentador
                  </button>
                  <div className="flex items-center gap-1">
                    <Button type="button" size="sm" variant="ghost" onClick={() => onDelete(originalIdx)} className="text-destructive">
                      <Trash2 className="mr-1 h-4 w-4" /> Excluir
                    </Button>
                    <Button type="button" size="sm" onClick={() => setEditingIdx(null)}>
                      <Check className="mr-1 h-4 w-4" /> Concluir
                    </Button>
                  </div>
                </div>
              </div>
            );
          }

          return (
            <div key={m.id ?? `idx-${originalIdx}`} className="group flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-muted/40">
              <span className="w-16 shrink-0 text-xs tabular-nums text-muted-foreground">{formatTime(m.showAtSec)}</span>
              <p className="min-w-0 flex-1 truncate text-sm">
                <span className="font-medium text-muted-foreground">{m.authorName || "Sem nome"}</span>{" "}
                <span>{m.text}</span>
                {m.isOwner && <Zap className="ml-1 inline h-3.5 w-3.5 text-amber-500" aria-label="Apresentador" />}
              </p>
              <div className="flex shrink-0 items-center gap-0.5 opacity-60 transition-opacity group-hover:opacity-100">
                <button
                  type="button"
                  onClick={() => setEditingIdx(originalIdx)}
                  aria-label="Editar"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted"
                >
                  <Pencil className="h-4 w-4 text-emerald-600" />
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(originalIdx)}
                  aria-label="Excluir"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex gap-2">
        <Button type="button" variant="outline" className="flex-1 border-destructive/30 text-destructive hover:bg-destructive/5" onClick={onDeleteAll}>
          <Trash2 className="mr-2 h-4 w-4" /> Excluir todo o chat
        </Button>
        {slug ? (
          <Button asChild type="button" className="flex-1 bg-emerald-800 text-white hover:bg-emerald-900">
            <a href={`/${slug}/live`} target="_blank" rel="noopener noreferrer">
              <Rocket className="mr-2 h-4 w-4" /> Testar no player
            </a>
          </Button>
        ) : null}
      </div>
    </aside>
  );
}
