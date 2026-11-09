"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Clock, Flag, Play, Radio } from "@/components/icons";
import type { WebinarRealtimeSnapshot } from "@/lib/webinar-realtime";

import styles from "./webinar-operations.module.css";

export function formatCountdown(ms: number) {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(seconds / 3600))}h ${pad(Math.floor(seconds / 60) % 60)}min ${pad(seconds % 60)}s`;
}

export function RealtimeCountdown({ data }: { data: WebinarRealtimeSnapshot }) {
  const [now, setNow] = useState(() => Date.parse(data.updatedAt));
  useEffect(() => {
    // Anchor to the server clock and measure elapsed time monotonically.
    const anchor = Date.parse(data.updatedAt);
    const received = performance.now();
    const tick = () => setNow(anchor + performance.now() - received);
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [data.updatedAt]);

  const schedule = data.schedule;
  if (!schedule) return null;
  const start = schedule.startDate ? Date.parse(schedule.startDate) : null;
  const end = schedule.endDate ? Date.parse(schedule.endDate) : null;
  const closed = end !== null && now >= end;
  const individual = schedule.mode === "JIT" || !schedule.videoSyncWithStart;
  const milestone = (offset: number | null, done: string) => {
    if (offset === null) return "Não configurado";
    if (individual) return "Por espectador";
    if (start === null) return "Sem início definido";
    const target = start + offset * 1000;
    if (end !== null && target > end) return "Fora do horário";
    if (closed) return "Encerrado";
    if (now >= target) return done;
    return formatCountdown(target - now);
  };
  const colors = {
    waiting: "text-amber-700 dark:text-amber-400",
    active: "text-emerald-700 dark:text-emerald-400",
    ended: "text-muted-foreground"
  };
  const liveState = closed || start === null || schedule.mode === "JIT"
    ? "ended" : now < start ? "waiting" : "active";
  const milestoneState = (offset: number | null, disabled = false) => {
    if (closed || disabled || individual || start === null || offset === null) return "ended";
    const target = start + offset * 1000;
    if (end !== null && target > end) return "ended";
    return now < target ? "waiting" : "active";
  };
  const linkEnded = start !== null && schedule.offerHideAtSec != null && now >= start + schedule.offerHideAtSec * 1000 && !individual;
  const rows = [
    { icon: Play, color: colors[liveState], label: closed ? "Live encerrada" : start !== null && now < start ? "Início em" : "Live há",
      value: schedule.mode === "JIT" ? "Por espectador" : start === null ? "Sem início definido" : formatCountdown(now < start ? start - now : Math.min(now, end ?? now) - start) },
    { icon: Radio, color: colors[milestoneState(schedule.pitchAtSec)], label: "Pitch em", value: milestone(schedule.pitchAtSec, "Iniciado") },
    { icon: Clock, color: colors[milestoneState(schedule.offerShowAtSec, schedule.offerDisabled || linkEnded)], label: "Link em", value: schedule.offerDisabled ? "Desativado" : linkEnded ? "Encerrado" : milestone(schedule.offerShowAtSec, "Liberado") },
    { icon: Flag, color: colors[end === null ? "ended" : liveState], label: "Fim em", value: closed ? "Encerrado" : end === null ? "Não configurado" : formatCountdown(end - now) }
  ];

  return (
    <section aria-label="Cronograma do webinar" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {rows.map(({ icon: Icon, label, value, color }) => (
        <div key={label} className={styles.surface}>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <Icon aria-hidden="true" className={cn("h-4 w-4 shrink-0", color)} />
            <span>{label}</span>
          </div>
          <p className={cn("mt-2 text-base font-semibold tracking-tight tabular-nums", color)}>{value}</p>
        </div>
      ))}
    </section>
  );
}
