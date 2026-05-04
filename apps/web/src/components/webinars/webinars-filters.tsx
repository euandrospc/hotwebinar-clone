"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function WebinarsFilters() {
  const params = useSearchParams();
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [q, setQ] = useState(params.get("q") ?? "");

  function push(next: URLSearchParams) {
    next.delete("page");
    router.push(`/dashboard/webinars?${next.toString()}`);
  }

  function onChange(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value && value !== "ALL") next.set(key, value);
    else next.delete(key);
    startTransition(() => push(next));
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Pesquisar</label>
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onBlur={() => onChange("q", q)}
          placeholder="Nome ou título"
          className="w-64"
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Status</label>
        <Select value={params.get("status") ?? "ALL"} onValueChange={(v) => onChange("status", v)}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos</SelectItem>
            <SelectItem value="DRAFT">Rascunho</SelectItem>
            <SelectItem value="ACTIVE">Ativo</SelectItem>
            <SelectItem value="ARCHIVED">Arquivado</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Tipo</label>
        <Select value={params.get("tipo") ?? "ALL"} onValueChange={(v) => onChange("tipo", v)}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos</SelectItem>
            <SelectItem value="UNICO">Único</SelectItem>
            <SelectItem value="JIT">Just in time</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Ordenar</label>
        <Select value={params.get("sort") ?? "recent"} onValueChange={(v) => onChange("sort", v)}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Mais recentes</SelectItem>
            <SelectItem value="oldest">Mais antigos</SelectItem>
            <SelectItem value="az">A–Z</SelectItem>
            <SelectItem value="za">Z–A</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
