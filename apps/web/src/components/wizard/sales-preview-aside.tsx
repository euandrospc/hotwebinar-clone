"use client";
import { useState } from "react";
import { Download, Search, Trash2, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SecondsInput } from "@/components/ui/seconds-input";

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

export function SalesPreviewAside({ webinarId, slug, notifications, onUpdate, onDelete, onDeleteAll }: SalesPreviewAsideProps) {
  const [q, setQ] = useState("");
  const filtered = q
    ? notifications
        .map((n, i) => [n, i] as const)
        .filter(([n]) => n.buyerName.toLowerCase().includes(q.toLowerCase()) || n.productName.toLowerCase().includes(q.toLowerCase()))
    : notifications.map((n, i) => [n, i] as const);

  return (
    <aside className="flex h-fit flex-col gap-3 rounded-lg border bg-card p-4">
      <h3 className="text-sm font-semibold">Prévia das vendas</h3>
      <Button asChild type="button" className="w-full bg-emerald-800 text-white hover:bg-emerald-900">
        <a href={`/api/webinars/${webinarId}/sales/export`} download>
          <Download className="mr-2 h-4 w-4" /> Exportar vendas em XLSX
        </a>
      </Button>
      <div className="relative">
        <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          placeholder="Buscar vendas"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="pl-8"
        />
      </div>
      <div className="max-h-[480px] space-y-2 overflow-y-auto pr-1">
        {filtered.map(([n, originalIdx]) => (
          <div key={n.id ?? `idx-${originalIdx}`} className="grid grid-cols-[80px_1fr_auto] items-center gap-2 rounded-md border p-2">
            <SecondsInput
              value={n.showAtSec}
              onChange={(v) => onUpdate(originalIdx, { showAtSec: v ?? 0 })}
              aria-label="Tempo"
            />
            <div className="space-y-1">
              <Input
                value={n.buyerName}
                onChange={(e) => onUpdate(originalIdx, { buyerName: e.target.value })}
                placeholder="Comprador"
                className="h-8 text-sm"
              />
              <Input
                value={n.productName}
                onChange={(e) => onUpdate(originalIdx, { productName: e.target.value })}
                placeholder="Produto"
                className="h-8 text-sm"
              />
              <Input
                value={n.price ?? ""}
                onChange={(e) => onUpdate(originalIdx, { price: e.target.value || null })}
                placeholder="Preço (opcional)"
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
        {filtered.length === 0 && <p className="text-center text-xs text-muted-foreground">Nenhuma venda.</p>}
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="outline" className="flex-1 text-destructive" onClick={onDeleteAll}>
          <Trash2 className="mr-2 h-4 w-4" /> Excluir todas as vendas
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
