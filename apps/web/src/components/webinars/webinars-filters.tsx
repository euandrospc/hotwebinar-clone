"use client";
import adminStyles from "@/components/admin/admin-page.module.css";
import { ArrowDown, ChevronDown, Filter, Search } from "@/components/icons";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type PhaseCounts = { all: number; live: number; scheduled: number; paused: number };

const PHASES = [
  { value: "all", label: "Todos" },
  { value: "live", label: "Ao vivo" },
  { value: "scheduled", label: "Agendados" },
  { value: "paused", label: "Pausados" }
] as const;
const TIPOS = { ALL: "Todos", UNICO: "Único", RECURRING: "Recorrente", JIT: "Just in time" } as const;
const STATUSES = { ALL: "Todos", DRAFT: "Rascunho", ACTIVE: "Ativo", ARCHIVED: "Arquivado" } as const;
const SORTS = { recent: "Mais recentes", oldest: "Mais antigos", az: "A–Z", za: "Z–A" } as const;

const control = "flex h-10 shrink-0 items-center gap-2 rounded-[10px] border border-[#1E241F] bg-[#070807] px-3 text-[13px] font-medium text-neutral-100 transition-colors hover:border-[#2A322C] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-palco motion-reduce:transition-none";

export function WebinarsFilters({ counts }: { counts: PhaseCounts }) {
  const params = useSearchParams();
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [q, setQ] = useState(params.get("q") ?? "");
  const phase = params.get("fase") ?? "all";
  const tipo = (params.get("tipo") ?? "ALL") as keyof typeof TIPOS;
  const status = (params.get("status") ?? "ALL") as keyof typeof STATUSES;
  const sort = (params.get("sort") ?? "recent") as keyof typeof SORTS;

  function onChange(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value && value !== "ALL" && value !== "all") next.set(key, value);
    else next.delete(key);
    next.delete("page");
    startTransition(() => router.push(`/dashboard/webinars?${next.toString()}`));
  }

  return (
    <div className="flex flex-wrap items-center gap-3 px-5 py-4">
      <label className="flex h-10 min-w-[220px] flex-1 items-center gap-2.5 rounded-[10px] border border-[#1E241F] bg-[#070807] px-3 focus-within:ring-2 focus-within:ring-palco">
        <Search className="size-4 shrink-0 text-[#6E776F]" aria-hidden="true" />
        <span className="sr-only">Pesquisar webinars</span>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onBlur={() => { if (q !== (params.get("q") ?? "")) onChange("q", q); }}
          onKeyDown={(e) => { if (e.key === "Enter") onChange("q", q); }}
          placeholder="Buscar por nome ou título"
          className="h-full w-full min-w-0 bg-transparent text-sm text-neutral-100 outline-none placeholder:text-[#6E776F] max-sm:text-base"
        />
      </label>

      <div role="group" aria-label="Filtrar por situação" className="flex max-w-full shrink-0 overflow-x-auto rounded-[10px] border border-[#1E241F] bg-[#070807] p-[3px]">
        {PHASES.map((p) => {
          const active = phase === p.value;
          return (
            <button key={p.value} type="button" aria-pressed={active} onClick={() => onChange("fase", p.value)}
              className={cn("flex items-center gap-1.5 whitespace-nowrap rounded-[7px] px-3 py-[7px] text-[13px] font-semibold leading-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-palco motion-reduce:transition-none",
                active ? "bg-palco/[0.12] text-palco" : "text-neutral-400 hover:text-neutral-100")}>
              {p.label}
              <span className={cn("text-xs font-normal", active ? "text-palco/70" : "text-[#6E776F]")}>{counts[p.value]}</span>
            </button>
          );
        })}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger className={control} aria-label="Filtrar por tipo e status">
          <Filter className="size-[15px] text-neutral-500" aria-hidden="true" />
          Tipo: {TIPOS[tipo] ?? "Todos"}{status !== "ALL" && STATUSES[status] ? ` · ${STATUSES[status]}` : ""}
          <ChevronDown className="size-3.5 text-[#6E776F]" aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className={cn(adminStyles.portal, "min-w-48")}>
          <DropdownMenuLabel>Tipo</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={tipo} onValueChange={(v) => onChange("tipo", v)}>
            {Object.entries(TIPOS).map(([v, l]) => <DropdownMenuRadioItem key={v} value={v}>{l}</DropdownMenuRadioItem>)}
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Status</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={status} onValueChange={(v) => onChange("status", v)}>
            {Object.entries(STATUSES).map(([v, l]) => <DropdownMenuRadioItem key={v} value={v}>{l}</DropdownMenuRadioItem>)}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger className={control} aria-label="Ordenar webinars">
          <ArrowDown className="size-[15px] text-neutral-500" aria-hidden="true" />
          {SORTS[sort] ?? SORTS.recent}
          <ChevronDown className="size-3.5 text-[#6E776F]" aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className={adminStyles.portal}>
          <DropdownMenuRadioGroup value={sort} onValueChange={(v) => onChange("sort", v === "recent" ? "" : v)}>
            {Object.entries(SORTS).map(([v, l]) => <DropdownMenuRadioItem key={v} value={v}>{l}</DropdownMenuRadioItem>)}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
