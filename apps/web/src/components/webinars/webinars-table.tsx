"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, ArrowUpRight, Calendar, CircleCheck, MonitorPlay, Pencil, Play, RefreshCw, Zap } from "@/components/icons";
import { AdminEmptyState } from "@/components/admin/admin-page";
import { cn } from "@/lib/utils";
import { RowActions } from "./row-actions";
import { useOnlineCount } from "./webinar-online-badge";
import { formatDay, formatSpan, formatTime, sessionInfo, type SessionWebinar } from "./webinar-session";

export type WebinarRow = SessionWebinar & {
  id: string;
  name: string;
  title: string;
  slug: string | null;
  video: { durationSec: number | null; thumbUrl: string | null; customThumbUrl: string | null } | null;
  initialOnline: number;
};

const number = new Intl.NumberFormat("pt-BR");
const STATUS_LABEL = { DRAFT: "Rascunho", ACTIVE: "Ativo", ARCHIVED: "Arquivado" } as const;

/** Re-renders every 30s so "Ao vivo há…"/"Começa em…" and phase changes stay current. */
export function useNow(initialNow: number) {
  const [now, setNow] = useState(initialNow);
  useEffect(() => {
    const refresh = () => setNow(Date.now());
    refresh();
    const timer = window.setInterval(refresh, 30_000);
    document.addEventListener("visibilitychange", refresh);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", refresh); };
  }, []);
  return new Date(now);
}

export function webinarLabel(w: { title: string; name: string }) {
  return w.title || w.name || "Sem título";
}

export function publicUrl(base: string, slug: string | null) {
  return slug ? `${base.replace(/\/$/, "")}/${slug}` : null;
}

function videoLabel(w: WebinarRow) {
  const room = w.mode === "JIT" ? "Sala just in time" : "Sala automática";
  if (!w.video) return `${room} · sem vídeo`;
  return `${room} · ${w.video.durationSec ? `vídeo ${formatSpan(w.video.durationSec * 1000)}` : "vídeo em processamento"}`;
}

function Session({ w, now }: { w: WebinarRow; now: Date }) {
  const s = sessionInfo(w, now);
  if (w.mode === "JIT") {
    return <>
      <p className="text-[13px] font-medium text-[#C9D1CA]">Sob demanda</p>
      <p className={cn("text-xs", s.state === "live" ? "text-palco" : "text-neutral-500")}>
        {s.state === "live" ? "Disponível agora" : s.state === "paused" ? "Sala pausada" : "Encerrado"}
      </p>
    </>;
  }
  if (!s.start || !s.end) {
    return <>
      <p className="text-[13px] font-medium text-[#C9D1CA]">Sem data definida</p>
      <p className={cn("text-xs", s.state === "live" ? "text-palco" : "text-neutral-500")}>{s.state === "live" ? "Sala aberta" : s.state === "paused" ? "Sala pausada" : "—"}</p>
    </>;
  }
  const rel = s.state === "live" ? `Ao vivo há ${formatSpan(now.getTime() - s.start.getTime())}`
    : s.state === "scheduled" ? `Começa em ${formatSpan(s.start.getTime() - now.getTime())}`
    : s.state === "ended" ? "Encerrado" : "Sala pausada";
  return <>
    <p className="flex items-center gap-1 text-[13px] font-medium text-[#C9D1CA]">
      {formatDay(s.start, w.timezone, now)} · {formatTime(s.start, w.timezone)}
      <ArrowRight className="size-3 shrink-0" aria-label="até" />{formatTime(s.end, w.timezone)}
    </p>
    <p className={cn("text-xs", s.state === "live" ? "text-palco" : "text-neutral-500")}>{rel}</p>
  </>;
}

function Row({ w, now, publicBaseUrl }: { w: WebinarRow; now: Date; publicBaseUrl: string }) {
  const online = useOnlineCount(w.id, w.initialOnline);
  const live = sessionInfo(w, now).state === "live";
  const thumb = w.video?.customThumbUrl || w.video?.thumbUrl;
  const href = publicUrl(publicBaseUrl, w.slug);
  const label = webinarLabel(w);
  const TypeIcon = w.mode === "JIT" ? Zap : w.recurring ? RefreshCw : Calendar;
  return (
    <tr className={cn("border-t border-[#1A1F1B] transition-colors hover:bg-white/[0.02] motion-reduce:transition-none", live && "bg-palco/[0.03]")}>
      <td className="py-4 pl-5 pr-4">
        <div className="flex min-w-0 items-center gap-3.5">
          <span className={cn("relative flex h-10 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-cover bg-center", live ? "bg-[#1E6B47]" : "bg-[#1A1F1B]")}
            style={thumb ? { backgroundImage: `url(${JSON.stringify(thumb)})` } : undefined} aria-hidden="true">
            {thumb && <span className={cn("absolute inset-0", live ? "bg-[#1E6B47]/70" : "bg-black/50")} />}
            <Play className={cn("relative size-4", live ? "text-palco" : "text-neutral-400")} />
          </span>
          <div className="min-w-0 space-y-[3px] leading-tight">
            <Link href={`/dashboard/webinars/${w.id}/step-1`} className="block truncate rounded text-[15px] font-semibold text-neutral-100 hover:text-palco focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-palco">{label}</Link>
            <p className="truncate text-xs text-neutral-500">{videoLabel(w)}</p>
          </div>
        </div>
      </td>
      <td className="space-y-[3px] py-4 pr-4 leading-tight"><Session w={w} now={now} /></td>
      <td className="py-4 pr-4" aria-live="polite">
        {online > 0 ? (
          <Link href={`/dashboard/webinars/${w.id}/realtime`} className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-palco/[0.12] px-2.5 py-1 text-xs font-bold text-palco hover:bg-palco/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-palco">
            <span className="size-1.5 rounded-full bg-palco" aria-hidden="true" />{number.format(online)} online
          </Link>
        ) : <span className="text-xs text-[#6E776F]">{live ? "0 online" : sessionInfo(w, now).state === "scheduled" ? "Aguardando" : "—"}</span>}
      </td>
      <td className="py-4 pr-4">
        <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold text-[#C9D1CA]", w.status === "ACTIVE" ? "border-palco/25" : "border-[#1E241F]")}>
          {w.status === "ACTIVE" ? <CircleCheck className="size-3 text-palco" aria-hidden="true" /> : w.status === "DRAFT" ? <Pencil className="size-3 text-neutral-500" aria-hidden="true" /> : <span className="size-1.5 rounded-full bg-neutral-600" aria-hidden="true" />}
          {STATUS_LABEL[w.status]}
        </span>
      </td>
      <td className="py-4 pr-4">
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] text-[#C9D1CA]">
          <TypeIcon className="size-3.5 text-neutral-500" aria-hidden="true" />
          {w.mode === "JIT" ? "Just in time" : w.recurring ? "Recorrente" : "Único"}
        </span>
      </td>
      <td className="py-4 pr-5">
        <div className="flex items-center justify-end gap-1">
          {href ? (
            <a href={href} target="_blank" rel="noreferrer" aria-label={`Abrir página pública de ${label}`} title="Abrir página pública"
              className="flex size-[34px] items-center justify-center rounded-lg border border-[#1E241F] text-neutral-400 transition-colors hover:bg-white/5 hover:text-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-palco motion-reduce:transition-none">
              <ArrowUpRight className="size-4" />
            </a>
          ) : (
            <span className="flex size-[34px] items-center justify-center rounded-lg border border-[#1E241F] text-neutral-600" title="Defina o slug para abrir a página pública" aria-hidden="true">
              <ArrowUpRight className="size-4" />
            </span>
          )}
          <RowActions id={w.id} title={label} slug={w.slug} publicBaseUrl={publicBaseUrl} />
        </div>
      </td>
    </tr>
  );
}

const TH = "py-2.5 pr-4 text-left text-[11px] leading-tight font-bold uppercase tracking-[0.11em] text-[#6E776F]";

export function WebinarsTable({ rows, publicBaseUrl, initialNow }: { rows: WebinarRow[]; publicBaseUrl: string; initialNow: number }) {
  const now = useNow(initialNow);
  if (rows.length === 0) {
    return <div className="border-t border-[#1E241F]">
      <AdminEmptyState icon={<MonitorPlay />} title="Nenhum webinar encontrado" description="Ajuste os filtros ou crie seu primeiro webinar para começar." />
    </div>;
  }
  return (
    <div className="overflow-x-auto border-t border-[#1E241F]">
      <table className="w-full min-w-[960px] border-collapse font-palco">
        <thead className="bg-[#090B09]">
          <tr>
            <th scope="col" className={cn(TH, "pl-5")}>Webinar</th>
            <th scope="col" className={cn(TH, "w-[260px]")}>Sessão</th>
            <th scope="col" className={cn(TH, "w-[150px]")}>Online</th>
            <th scope="col" className={cn(TH, "w-[120px]")}>Status</th>
            <th scope="col" className={cn(TH, "w-[140px]")}>Tipo</th>
            <th scope="col" className={cn(TH, "w-[116px] pr-5")}><span className="sr-only">Ações</span></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((w) => <Row key={w.id} w={w} now={now} publicBaseUrl={publicBaseUrl} />)}
        </tbody>
      </table>
    </div>
  );
}
