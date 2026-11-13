"use client";

import Link from "next/link";
import { ArrowRight, ArrowUpRight, TrendingUp } from "@/components/icons";
import { useOnlineCount } from "./webinar-online-badge";
import { formatSpan, formatTime, sessionInfo } from "./webinar-session";
import { publicUrl, useNow, webinarLabel, type WebinarRow } from "./webinars-table";

const number = new Intl.NumberFormat("pt-BR");

/** Highlight for the webinar whose session is running now; hides itself once the session ends. */
export function WebinarLiveBanner({ webinar: w, publicBaseUrl, initialNow }: { webinar: WebinarRow; publicBaseUrl: string; initialNow: number }) {
  const now = useNow(initialNow);
  const online = useOnlineCount(w.id, w.initialOnline);
  const s = sessionInfo(w, now);
  if (s.state !== "live") return null;
  const href = publicUrl(publicBaseUrl, w.slug);
  const timed = w.mode === "UNICO" && s.start && s.end;
  const elapsed = timed ? now.getTime() - s.start!.getTime() : 0;
  const total = timed ? s.end!.getTime() - s.start!.getTime() : 0;
  const pct = total > 0 ? Math.min(100, Math.max(0, (elapsed / total) * 100)) : null;

  return (
    <section aria-label="Webinar ao vivo" className="flex flex-col gap-5 rounded-2xl border border-palco/25 bg-gradient-to-r from-[#123A27] to-[#0C0E0C] px-6 py-5 font-palco lg:flex-row lg:items-center lg:gap-6">
      <span className="inline-flex w-fit shrink-0 items-center gap-[7px] rounded-full bg-palco px-2.5 py-[5px] text-[11px] font-bold tracking-[0.11em] text-palco-ink">
        <span className="size-[7px] animate-pulse rounded-full bg-palco-ink motion-reduce:animate-none" aria-hidden="true" />AO VIVO
      </span>
      <div className="min-w-0 flex-1 space-y-2.5">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <h2 className="truncate text-lg font-bold text-neutral-100">{webinarLabel(w)}</h2>
          {timed ? <>
            <span className="inline-flex items-center gap-1 text-[13px] text-neutral-400">
              {formatTime(s.start!, w.timezone)}<ArrowRight className="size-3" aria-label="até" />{formatTime(s.end!, w.timezone)} ·
            </span>
            <span className="text-xs text-neutral-400">{formatSpan(elapsed)} de {formatSpan(total)}</span>
          </> : <span className="text-[13px] text-neutral-400">{w.mode === "JIT" ? "Sala sob demanda" : "Sala aberta"}</span>}
        </div>
        {pct !== null && (
          <div className="h-1 w-full overflow-hidden rounded-full bg-neutral-100/[0.12]" role="progressbar" aria-label="Progresso da sessão"
            aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
            <div className="h-full rounded-full bg-palco transition-[width] duration-700 motion-reduce:transition-none" style={{ width: `${pct}%` }} />
          </div>
        )}
      </div>
      <div className="flex shrink-0 flex-col lg:items-end" aria-live="polite">
        <span className="text-[28px] font-bold leading-[1.1] text-palco">{number.format(online)}</span>
        <span className="text-xs text-neutral-400">{online === 1 ? "pessoa online" : "pessoas online"}</span>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2.5">
        <Link href={`/dashboard/webinars/${w.id}/realtime`}
          className="flex h-[38px] items-center gap-2 rounded-[10px] border border-neutral-100/20 px-3.5 text-[13px] font-semibold text-neutral-100 transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-palco motion-reduce:transition-none">
          <TrendingUp className="size-4 text-[#C9D1CA]" aria-hidden="true" />Métricas ao vivo
        </Link>
        {href && (
          <a href={href} target="_blank" rel="noreferrer"
            className="flex h-[38px] items-center gap-2 rounded-[10px] bg-palco px-3.5 text-[13px] font-bold text-palco-ink transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-palco focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0C0A] motion-reduce:transition-none">
            Entrar na sala<ArrowUpRight className="size-4" aria-hidden="true" />
          </a>
        )}
      </div>
    </section>
  );
}
