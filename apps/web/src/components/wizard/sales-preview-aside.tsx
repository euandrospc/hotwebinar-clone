"use client";
import { useState } from "react";
import { Download, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface SaleRowValue {
  id?: string;
  buyerName: string;
  productName: string;
  showAtSec: number;
  price: string | null;
}

export interface SalesPreviewAsideProps {
  webinarId: string;
  slug: string | null;
  notifications: SaleRowValue[];
  onUpdate: (originalIdx: number, patch: Partial<SaleRowValue>) => void;
  onDelete: (originalIdx: number) => void;
  onDeleteAll: () => void;
}

function formatHms(total: number): string {
  const t = Math.max(0, Math.floor(total));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function buildText(n: SaleRowValue): string {
  if (!n.productName) return n.buyerName;
  return n.price ? `${n.buyerName} comprou ${n.productName} por ${n.price}` : `${n.buyerName} comprou ${n.productName}`;
}

export function SalesPreviewAside({ webinarId, notifications, onUpdate, onDelete, onDeleteAll }: SalesPreviewAsideProps) {
  const [q, setQ] = useState("");
  const filtered = q
    ? notifications
        .map((n, i) => [n, i] as const)
        .filter(([n]) => buildText(n).toLowerCase().includes(q.toLowerCase()))
    : notifications.map((n, i) => [n, i] as const);

  return (
    <aside className="flex h-fit flex-col gap-3 rounded-lg border bg-card p-4">
      <h3 className="text-sm font-semibold">Prévia das vendas</h3>
      <Button asChild type="button" className="w-full bg-emerald-800 text-white hover:bg-emerald-900">
        <a href={`/api/webinars/${webinarId}/sales/export`} download>
          <Download className="mr-2 h-4 w-4" /> Exportar vendas em XLSX
        </a>
      </Button>
      <Input
        placeholder="Buscar mensagens"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="max-h-[480px] space-y-3 overflow-y-auto pr-1">
        {filtered.map(([n, originalIdx]) => (
          <div key={n.id ?? `idx-${originalIdx}`} className="group flex items-start gap-3">
            <span className="w-16 shrink-0 pt-2 font-mono text-xs text-muted-foreground tabular-nums">
              {formatHms(n.showAtSec)}
            </span>
            <div className="relative flex-1 rounded-md bg-yellow-200/80 p-2 text-sm text-zinc-900 shadow-sm">
              <textarea
                value={n.buyerName}
                onChange={(e) => onUpdate(originalIdx, { buyerName: e.target.value })}
                rows={1}
                className="w-full resize-none border-0 bg-transparent p-0 text-sm leading-snug text-zinc-900 focus:outline-none focus:ring-0"
                onInput={(e) => {
                  const ta = e.currentTarget;
                  ta.style.height = "auto";
                  ta.style.height = `${ta.scrollHeight}px`;
                }}
              />
              <button
                type="button"
                onClick={() => onDelete(originalIdx)}
                aria-label="Remover"
                className="absolute -right-2 -top-2 hidden h-6 w-6 items-center justify-center rounded-full border bg-background text-destructive shadow group-hover:flex"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <p className="text-center text-xs text-muted-foreground">Nenhuma venda.</p>}
      </div>
      <Button type="button" variant="outline" onClick={onDeleteAll} className="w-full text-destructive">
        <Trash2 className="mr-2 h-4 w-4" /> Excluir
      </Button>
    </aside>
  );
}
