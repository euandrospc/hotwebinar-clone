"use client";
import Link from "next/link";
import { useState } from "react";
import { Download, Play, Search, Trash2 } from "@/components/icons";
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

// Renders {placeholders} in green behind the transparent textarea; same font weight keeps the caret aligned.
function Highlighted({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\{[^{}]*\})/g).map((part, i) =>
        /^\{[^{}]*\}$/.test(part) ? <span key={i} className="text-palco">{part}</span> : <span key={i}>{part}</span>
      )}
      {String.fromCharCode(8203)}
    </>
  );
}

const outlineButton = "h-[38px] w-full rounded-[10px] border-[#1E241F] bg-transparent px-3.5 text-[13px] font-bold hover:bg-white/5";

export function SalesPreviewAside({ webinarId, notifications, onUpdate, onDelete, onDeleteAll }: SalesPreviewAsideProps) {
  const [q, setQ] = useState("");
  const filtered = q
    ? notifications
        .map((n, i) => [n, i] as const)
        .filter(([n]) => buildText(n).toLowerCase().includes(q.toLowerCase()))
    : notifications.map((n, i) => [n, i] as const);

  return (
    <aside className="flex min-w-0 flex-col gap-3 rounded-2xl border border-[#1E241F] bg-[#0C0E0C] p-5 font-palco">
      <h3 className="text-lg font-semibold text-neutral-100">Prévia das vendas</h3>
      <Button asChild className="h-10 w-full rounded-[10px] bg-palco text-[13px] font-bold text-palco-ink hover:bg-palco/90">
        <Link href={`/dashboard/webinars/${webinarId}/sales-preview`}><Play className="h-[15px] w-[15px]" /> Simular notificações salvas</Link>
      </Button>
      <Button asChild type="button" variant="outline" className={`${outlineButton} text-neutral-100 hover:text-neutral-100`}>
        <a href={`/api/webinars/${webinarId}/sales/export`} download>
          <Download className="h-[15px] w-[15px]" /> Exportar vendas em XLSX
        </a>
      </Button>
      <div className="relative">
        <Search aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-[#7C867E]" />
        <Input
          placeholder="Buscar vendas"
          aria-label="Buscar vendas"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="h-[42px] rounded-[10px] border-[#1E241F] bg-[#070807] pl-10 text-sm text-neutral-100 placeholder:text-[#6E776F] focus-visible:ring-palco/50 focus-visible:ring-offset-0"
        />
      </div>
      <div className="max-h-[560px] space-y-2 overflow-y-auto pr-1">
        {filtered.map(([n, originalIdx]) => (
          <div key={n.id ?? `idx-${originalIdx}`} className="flex items-center gap-3">
            <span className="shrink-0 font-mono text-[11px] tabular-nums text-[#6E776F]">
              {formatHms(n.showAtSec)}
            </span>
            <div className="flex min-w-0 flex-1 items-start gap-2 rounded-[10px] border border-[#1E241F] bg-[#070807] px-3 py-[11px] focus-within:border-palco/40">
              <div className="relative min-w-0 flex-1 text-xs leading-[18px]">
                <div aria-hidden="true" className="pointer-events-none whitespace-pre-wrap break-words text-neutral-100">
                  <Highlighted text={n.buyerName} />
                </div>
                <textarea
                  value={n.buyerName}
                  onChange={(e) => onUpdate(originalIdx, { buyerName: e.target.value })}
                  rows={1}
                  aria-label={`Texto da venda em ${formatHms(n.showAtSec)}`}
                  className="absolute inset-0 h-full w-full resize-none overflow-hidden whitespace-pre-wrap break-words border-0 bg-transparent p-0 text-xs leading-[18px] text-transparent caret-neutral-100 focus:outline-none focus:ring-0"
                />
              </div>
              <button
                type="button"
                onClick={() => onDelete(originalIdx)}
                aria-label="Remover"
                className="mt-0.5 shrink-0 rounded text-[#F87171]/60 transition-colors hover:text-[#F87171] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F87171]/50"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <p className="py-4 text-center text-xs text-[#6E776F]">Nenhuma venda.</p>}
      </div>
      <Button type="button" variant="outline" onClick={onDeleteAll} disabled={notifications.length === 0} className={`${outlineButton} border-[#DC2626]/35 text-[#F87171] hover:bg-[#DC2626]/10 hover:text-[#F87171]`}>
        <Trash2 className="h-[15px] w-[15px]" /> Excluir todas
      </Button>
    </aside>
  );
}
