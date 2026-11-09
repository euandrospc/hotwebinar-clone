"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { TvMinimalPlay } from "@/components/icons";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface WebinarOption {
  id: string;
  title: string;
  status: string;
}

function statusLabel(status: string) {
  switch (status.toUpperCase()) {
    case "ACTIVE": return "Publicado";
    case "DRAFT": return "Rascunho";
    case "ARCHIVED": return "Arquivado";
    default: return "Status não informado";
  }
}

export function DashboardWebinarPicker({ webinars, selectedId, compact = false }: { webinars: WebinarOption[]; selectedId: string; compact?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const selected = webinars.find((webinar) => webinar.id === selectedId) ?? webinars[0];

  function selectWebinar(id: string) {
    if (id === selected?.id || !webinars.some((webinar) => webinar.id === id)) return;
    const query = new URLSearchParams(searchParams.toString());
    query.set("webinarId", id);
    startTransition(() => router.push(`${pathname}?${query.toString()}`, { scroll: false }));
  }

  if (!selected) return null;

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2.5" aria-busy={pending}>
      {!compact && <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#F0F7E9] text-[#527660] dark:bg-[#17382D] dark:text-[#A6DE6B]" aria-hidden="true"><TvMinimalPlay className="h-4 w-4" /></span>}
      {webinars.length > 1 ? (
        <Select name="webinarId" value={selected.id} onValueChange={selectWebinar} disabled={pending}>
          <SelectTrigger aria-label="Webinar analisado" className={cn("h-9 w-auto min-w-0 max-w-[min(480px,calc(100vw-7rem))] gap-3 rounded-lg border-border/70 bg-card text-sm font-medium", compact && "h-10 max-w-[min(260px,calc(100vw-3rem))] rounded-xl text-xs shadow-none")}><SelectValue /></SelectTrigger>
          <SelectContent className="max-w-[calc(100vw-2rem)] rounded-xl">
            {webinars.map((webinar) => (
              <SelectItem key={webinar.id} value={webinar.id} textValue={webinar.title}>
                <span className="block max-w-[min(400px,calc(100vw-5rem))] truncate" title={webinar.title}>{webinar.title}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <span className="min-w-0 max-w-full truncate text-sm font-medium" title={selected.title}>{selected.title}</span>
      )}
      {!compact && <span className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px]", selected.status.toUpperCase() === "ACTIVE" ? "bg-[#F0F7E9] text-[#46704F] dark:bg-[#17382D] dark:text-[#A6DE6B]" : "bg-muted/60 text-muted-foreground")}>
        <span className={cn("h-1.5 w-1.5 rounded-full", selected.status.toUpperCase() === "ACTIVE" ? "bg-[#91C86A]" : "bg-muted-foreground/40")} aria-hidden="true" />
        {statusLabel(selected.status)}
      </span>}
      <span role="status" className={compact ? "sr-only" : "text-xs text-muted-foreground"}>{pending ? "Atualizando…" : ""}</span>
    </div>
  );
}
