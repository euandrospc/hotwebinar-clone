"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { buildRealtimeSession, formatCountdown, type RealtimeSessionMilestone } from "@/lib/realtime-session-v5";
import type { WebinarRealtimeSnapshot } from "@/lib/webinar-realtime-v5";
import { useRealtimeMotionV5 } from "./realtime-motion-v5";
import styles from "./realtime-session-v5.module.css";

type Props = {
  schedule?: WebinarRealtimeSnapshot["schedule"];
  updatedAt: string;
  timezone: string;
};

const phaseLabels = {
  upcoming: "Scheduled", live: "Live", ended: "Ended", individual: "Self-paced", unavailable: "Unavailable",
} as const;

function milestoneValue(milestone: RealtimeSessionMilestone) {
  if (milestone.state === "upcoming") return formatCountdown(milestone.secondsRemaining);
  if (milestone.state === "reached") {
    return { start: "Started", pitch: "Reached", offer: "Available", end: "Ended" }[milestone.id];
  }
  return { disabled: "Off", "per-viewer": "Per viewer", closed: "Closed", unavailable: "Unavailable" }[milestone.state];
}

function timeFormatter(timezone: string) {
  const options: Intl.DateTimeFormatOptions = {
    dateStyle: "medium", timeStyle: "long", hour12: false, timeZone: timezone,
  };
  try { return new Intl.DateTimeFormat("en-US", options); }
  catch { return new Intl.DateTimeFormat("en-US", { ...options, timeZone: "America/Sao_Paulo" }); }
}

/** Anchor both real and demo clocks to the snapshot, rather than the device's timezone or clock. */
export function RealtimeSessionV5({ schedule, updatedAt, timezone }: Props) {
  const id = useId();
  const motionEnabled = useRealtimeMotionV5();
  const snapshotTime = Date.parse(updatedAt);
  const [clock, setClock] = useState({ updatedAt, now: snapshotTime });
  const now = clock.updatedAt === updatedAt ? clock.now : snapshotTime;

  useEffect(() => {
    const anchor = Date.parse(updatedAt);
    setClock({ updatedAt, now: anchor });
    if (!Number.isFinite(anchor)) return;
    const receivedAt = performance.now();
    const tick = () => {
      if (document.visibilityState !== "hidden") {
        setClock({ updatedAt, now: anchor + Math.max(0, performance.now() - receivedAt) });
      }
    };
    const timer = window.setInterval(tick, 1_000);
    window.addEventListener("focus", tick);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", tick);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [updatedAt]);

  const model = buildRealtimeSession(schedule, now);
  const formatter = useMemo(() => timeFormatter(timezone), [timezone]);
  const next = model.milestones.find((milestone) => milestone.id === model.nextId);

  return (
    <section className={styles.card} data-realtime-session="v5" data-motion={motionEnabled || undefined} aria-labelledby={`${id}-title`}>
      <header className={styles.header}>
        <div className={styles.heading}>
          <h2 className={styles.title} id={`${id}-title`}>Session</h2>
          <span className={styles.phase} data-phase={model.phase}>
            <motion.span
              className={styles.phaseDot}
              aria-hidden="true"
              initial={false}
              animate={{ opacity: motionEnabled && model.phase === "live" ? [1, 0.45, 1] : 1 }}
              transition={{ duration: motionEnabled ? 2.8 : 0, repeat: motionEnabled && model.phase === "live" ? Infinity : 0, ease: "easeInOut" }}
            />
            {phaseLabels[model.phase]}
          </span>
        </div>
        {next && <span className={styles.nextLabel}>Up next <span>·</span> <strong>{next.label}</strong></span>}
      </header>
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        Session {phaseLabels[model.phase].toLowerCase()}.{next ? ` Next milestone: ${next.label}.` : ""}
      </span>
      <ol className={styles.timeline}>
        {model.milestones.map((milestone) => {
          const isNext = model.nextId === milestone.id;
          const absoluteTime = milestone.at === null ? null : formatter.format(new Date(milestone.at));
          const description = [absoluteTime, milestone.detail].filter(Boolean).join(". ");
          return (
            <li className={styles.milestone} key={milestone.id} data-milestone={milestone.id} data-state={milestone.state} data-next={isNext || undefined}>
              <Popover>
                <PopoverTrigger asChild>
                  <button className={styles.trigger} type="button" title={description} aria-describedby={`${id}-${milestone.id}-description`}>
                    <motion.span
                      className={styles.marker}
                      aria-hidden="true"
                      initial={false}
                      animate={{
                        opacity: motionEnabled && isNext ? [1, 0.7, 1] : 1,
                        scale: motionEnabled && isNext ? [1, 1.15, 1] : 1,
                      }}
                      transition={{ duration: motionEnabled ? 3.2 : 0, repeat: motionEnabled && isNext ? Infinity : 0, ease: "easeInOut" }}
                    >{milestone.state === "reached" ? "✓" : ""}</motion.span>
                    <span className={styles.label}>{milestone.label}</span>
                    <span className={styles.value} data-countdown={milestone.state === "upcoming" || undefined} aria-live="off">
                      {milestoneValue(milestone)}
                    </span>
                  </button>
                </PopoverTrigger>
                <PopoverContent className={styles.popover} align="start" sideOffset={8}>
                  <p className={styles.detailLabel}>{milestone.label}</p>
                  {absoluteTime && <time dateTime={new Date(milestone.at!).toISOString()} className={styles.absoluteTime}>{absoluteTime}</time>}
                  <p className={styles.detail}>{milestone.detail}</p>
                </PopoverContent>
              </Popover>
              <span className="sr-only" id={`${id}-${milestone.id}-description`}>{description}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
