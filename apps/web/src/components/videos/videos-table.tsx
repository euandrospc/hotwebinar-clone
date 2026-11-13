"use client";
import { useMemo, useState } from "react";
import { CircleCheck, Clock, LayoutDashboard, LoaderCircle, Menu, MonitorPlay, Search, TriangleAlert, Video } from "@/components/icons";
import { AdminEmptyState } from "@/components/admin/admin-page";
import { cn } from "@/lib/utils";
import { VideoRowActions } from "./video-row-actions";
import { formatBytes, formatDuration, middleTruncate } from "./format";

export interface VideoRow {
  id: string;
  name: string;
  status: "QUEUED" | "PROCESSING" | "READY" | "FAILED";
  progress: number;
  durationSec: number | null;
  bytes: string | null;
  thumbUrl: string | null;
  customThumbUrl: string | null;
  hlsUrl: string | null;
  errorMessage: string | null;
  createdAt: string;
  format: string | null;
  /** Source height in px; null for videos transcoded before it was recorded. */
  sourceHeight: number | null;
  webinars: Array<{ id: string; title: string }>;
}

const STATUS = {
  QUEUED: { label: "Em fila", Icon: Clock, cls: "bg-neutral-500/15 text-neutral-400" },
  PROCESSING: { label: "Processando", Icon: LoaderCircle, cls: "bg-[#F5B742]/[0.12] text-[#F5B742]" },
  READY: { label: "Pronto", Icon: CircleCheck, cls: "bg-palco/[0.12] text-palco" },
  FAILED: { label: "Falhou", Icon: TriangleAlert, cls: "bg-red-500/[0.12] text-red-400" }
} as const;

const dateFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" });

function Status({ v }: { v: VideoRow }) {
  const s = STATUS[v.status];
  const transient = v.status === "QUEUED" || v.status === "PROCESSING";
  return (
    <div className="flex flex-col gap-1.5">
      <span className={cn("inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold", s.cls)}>
        <s.Icon aria-hidden="true" className={cn("h-3 w-3", v.status === "PROCESSING" && "animate-spin motion-reduce:animate-none")} />
        {s.label}
      </span>
      {transient && (
        <div className="flex items-center gap-2" aria-label={`Progresso ${v.progress}%`}>
          <div className="h-1 w-16 overflow-hidden rounded-full bg-[#1A1F1B]"><div className="h-full rounded-full bg-[#F5B742]" style={{ width: `${v.progress}%` }} /></div>
          <span className="text-[10px] tabular-nums text-[#7C867E]">{v.progress}%</span>
        </div>
      )}
    </div>
  );
}

function Usage({ webinars }: { webinars: VideoRow["webinars"] }) {
  if (webinars.length === 0) return <span className="text-xs text-[#6E776F]">Nenhum webinar</span>;
  return (
    <span title={webinars.map((w) => w.title).join("\n")} className="inline-flex items-center gap-1.5 rounded-full border border-[#1E241F] px-2.5 py-1 text-xs font-semibold text-[#C9D1CA]">
      <MonitorPlay aria-hidden="true" className="h-[13px] w-[13px] text-neutral-400" />
      {webinars.length} {webinars.length === 1 ? "webinar" : "webinars"}
      <span className="sr-only">: {webinars.map((w) => w.title).join(", ")}</span>
    </span>
  );
}

function Thumb({ v, className }: { v: VideoRow; className?: string }) {
  const thumb = v.customThumbUrl ?? v.thumbUrl;
  return (
    <div className={cn("relative shrink-0 overflow-hidden rounded-lg border border-[#1E241F] bg-[#121512]", className)}>
      {thumb
        ? <img src={thumb} alt="" className="h-full w-full object-cover" />
        : <div className="flex h-full w-full items-center justify-center text-[#6E776F]"><Video aria-hidden="true" className="h-5 w-5" /></div>}
      {v.durationSec ? <span className="absolute bottom-1.5 right-1.5 rounded-[5px] bg-black/80 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-neutral-100">{formatDuration(v.durationSec)}</span> : null}
    </div>
  );
}

function meta(v: VideoRow) {
  return [`Enviado em ${dateFmt.format(new Date(v.createdAt))}`, v.format, v.sourceHeight ? `${v.sourceHeight}p` : null].filter(Boolean).join(" · ");
}

function Actions({ v }: { v: VideoRow }) {
  return <VideoRowActions id={v.id} name={v.name} status={v.status} customThumbUrl={v.customThumbUrl} hlsUrl={v.hlsUrl} />;
}

export function VideosTable({ rows }: { rows: VideoRow[] }) {
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"list" | "grid">("list");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? rows.filter((r) => r.name.toLowerCase().includes(q)) : rows;
  }, [rows, query]);

  const toggleBtn = (value: "list" | "grid", label: string, Icon: typeof Menu) => (
    <button type="button" aria-label={label} aria-pressed={view === value} onClick={() => setView(value)}
      className={cn("flex h-[30px] w-[30px] items-center justify-center rounded-[7px] transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-palco",
        view === value ? "bg-palco/[0.12] text-palco" : "text-[#7C867E] hover:text-neutral-100")}>
      <Icon aria-hidden="true" className="h-[15px] w-[15px]" />
    </button>
  );

  const head = "px-0 py-2.5 text-left text-[11px] font-bold uppercase tracking-[0.11em] text-[#6E776F]";

  return (
    <section aria-label="Biblioteca de vídeos" className="overflow-hidden rounded-2xl border border-[#1E241F] bg-[#0C0E0C]">
      <div className="flex flex-wrap items-center gap-3 border-b border-[#1E241F] px-5 py-3.5">
        <div className="flex w-full items-center gap-2 sm:w-auto sm:flex-1">
          <h2 className="text-[15px] font-semibold text-neutral-100">Biblioteca</h2>
          <span className="rounded-full bg-palco/[0.12] px-2 py-0.5 text-xs font-bold text-palco tabular-nums">{rows.length}</span>
        </div>
        <label className="flex h-[38px] min-w-0 flex-1 items-center gap-2.5 rounded-[10px] border border-[#1E241F] bg-[#070807] px-3 focus-within:ring-2 focus-within:ring-palco sm:w-[280px] sm:flex-none">
          <Search aria-hidden="true" className="h-[15px] w-[15px] shrink-0 text-[#6E776F]" />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar vídeo" aria-label="Buscar vídeo"
            className="w-full bg-transparent text-[13px] text-neutral-100 placeholder:text-[#6E776F] focus:outline-none focus-visible:outline-0" />
        </label>
        <div role="group" aria-label="Modo de visualização" className="flex rounded-[10px] border border-[#1E241F] bg-[#070807] p-[3px]">
          {toggleBtn("list", "Ver em lista", Menu)}
          {toggleBtn("grid", "Ver em grade", LayoutDashboard)}
        </div>
      </div>

      {rows.length === 0 ? (
        <AdminEmptyState icon={<Video />} title="Sua biblioteca começa aqui" description="Envie o primeiro vídeo para utilizá-lo nos seus webinars." />
      ) : filtered.length === 0 ? (
        <AdminEmptyState icon={<Search />} title="Nenhum vídeo encontrado" description={`Nada corresponde a “${query.trim()}”.`} />
      ) : view === "grid" ? (
        <ul className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {filtered.map((v) => (
            <li key={v.id} className="flex flex-col gap-3 rounded-xl border border-[#1E241F] bg-[#0A0C0A] p-3">
              <Thumb v={v} className="aspect-video w-full" />
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p title={v.name} className="truncate text-sm font-semibold text-neutral-100">{v.name}</p>
                  <p className="text-xs text-[#7C867E]">{[meta(v), v.bytes ? formatBytes(Number(v.bytes)) : null].filter(Boolean).join(" · ")}</p>
                </div>
                <Actions v={v} />
              </div>
              <div className="flex flex-wrap items-start gap-2"><Status v={v} /><Usage webinars={v.webinars} /></div>
              {v.errorMessage && <p className="text-xs text-red-400">{v.errorMessage}</p>}
            </li>
          ))}
        </ul>
      ) : (
        <table className="w-full table-fixed border-collapse">
          <thead className="border-b border-[#1E241F] bg-[#090B09]">
            <tr>
              <th scope="col" className={cn(head, "pl-5")}>Vídeo</th>
              <th scope="col" className={cn(head, "hidden w-[240px] lg:table-cell")}>Usado em</th>
              <th scope="col" className={cn(head, "w-[110px]")}>Status</th>
              <th scope="col" className={cn(head, "hidden w-[100px] md:table-cell")}>Duração</th>
              <th scope="col" className={cn(head, "hidden w-[100px] md:table-cell")}>Tamanho</th>
              <th scope="col" className={cn(head, "w-[64px] pr-5")}><span className="sr-only">Ações</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1A1F1B]">
            {filtered.map((v) => (
              <tr key={v.id} className="transition-colors hover:bg-white/[0.015] motion-reduce:transition-none">
                <td className="py-3.5 pl-5 pr-4">
                  <div className="flex items-center gap-4">
                    <Thumb v={v} className="hidden h-[63px] w-[112px] sm:block" />
                    <div className="flex min-w-0 flex-col gap-1">
                      <p title={v.name} className="truncate text-sm font-semibold text-neutral-100">{middleTruncate(v.name)}</p>
                      <p className="truncate text-xs text-[#7C867E]">{meta(v)}</p>
                      {v.errorMessage && <p className="line-clamp-2 text-xs text-red-400">{v.errorMessage}</p>}
                    </div>
                  </div>
                </td>
                <td className="hidden py-3.5 pr-4 lg:table-cell"><Usage webinars={v.webinars} /></td>
                <td className="py-3.5 pr-2"><Status v={v} /></td>
                <td className="hidden py-3.5 text-[13px] tabular-nums text-[#C9D1CA] md:table-cell">{formatDuration(v.durationSec)}</td>
                <td className="hidden py-3.5 text-[13px] tabular-nums text-[#C9D1CA] md:table-cell">{formatBytes(v.bytes ? Number(v.bytes) : null)}</td>
                <td className="py-3.5 pr-5 text-right"><Actions v={v} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
