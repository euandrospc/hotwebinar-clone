"use client";
import { useState } from "react";
import { Download, Search, Trash2, Rocket } from "lucide-react";
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

export function ChatPreviewAside({ webinarId, slug, messages, onUpdate, onDelete, onDeleteAll }: ChatPreviewAsideProps) {
  const [q, setQ] = useState("");
  const filtered = q
    ? messages
        .map((m, i) => [m, i] as const)
        .filter(([m]) => m.authorName.toLowerCase().includes(q.toLowerCase()) || m.text.toLowerCase().includes(q.toLowerCase()))
    : messages.map((m, i) => [m, i] as const);

  return (
    <aside className="flex h-fit flex-col gap-3 rounded-lg border bg-card p-4">
      <h3 className="text-sm font-semibold">Prévia do chat</h3>
      <Button asChild type="button" className="w-full bg-emerald-800 text-white hover:bg-emerald-900">
        <a href={`/api/webinars/${webinarId}/messages/export`} download>
          <Download className="mr-2 h-4 w-4" /> Exportar mensagens em XLSX
        </a>
      </Button>
      <div className="relative">
        <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          placeholder="Buscar mensagens"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="pl-8"
        />
      </div>
      <div className="max-h-[480px] space-y-2 overflow-y-auto pr-1">
        {filtered.map(([m, originalIdx]) => (
          <div key={m.id ?? `idx-${originalIdx}`} className="grid grid-cols-[80px_1fr_auto] items-center gap-2 rounded-md border p-2">
            <SecondsInput
              value={m.showAtSec}
              onChange={(v) => onUpdate(originalIdx, { showAtSec: v ?? 0 })}
              aria-label="Tempo"
            />
            <div className="space-y-1">
              <Input
                value={m.authorName}
                onChange={(e) => onUpdate(originalIdx, { authorName: e.target.value })}
                placeholder="Nome"
                className="h-8 text-sm"
              />
              <Input
                value={m.text}
                onChange={(e) => onUpdate(originalIdx, { text: e.target.value })}
                placeholder="Mensagem"
                className="h-8 text-sm"
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onDelete(originalIdx)}
              aria-label="Remover"
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ))}
        {filtered.length === 0 && <p className="text-center text-xs text-muted-foreground">Nenhuma mensagem.</p>}
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="outline" className="flex-1 text-destructive" onClick={onDeleteAll}>
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
