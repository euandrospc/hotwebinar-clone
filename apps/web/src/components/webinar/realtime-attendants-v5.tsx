"use client";

import { useId } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { RealtimeAttendantsV5Data } from "@/lib/realtime-attendants-v5";
import { RealtimeMotionValueV5, useRealtimeMotionV5 } from "./realtime-motion-v5";
import styles from "./realtime-attendants-v5.module.css";

const countFormatter = new Intl.NumberFormat("en-US");

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return [parts[0], parts.length > 1 ? parts.at(-1) : undefined]
    .filter(Boolean).map(part => Array.from(part!)[0]).join("").toLocaleUpperCase("en-US") || "?";
}

function periodDescription(data: RealtimeAttendantsV5Data, timezone: string): string {
  const from = data.from ? Date.parse(data.from) : Number.NaN;
  const to = data.to ? Date.parse(data.to) : Number.NaN;
  if (!Number.isFinite(from) || !Number.isFinite(to)) return `Today in ${timezone}`;
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: timezone,
    });
    return `${formatter.format(from)} – ${formatter.format(to)} · ${timezone}`;
  } catch {
    return `Today in ${timezone}`;
  }
}

/** Presence and per-author conversation counts arrive together; never infer either from account status. */
export function RealtimeAttendantsV5({ data, timezone }: { data: RealtimeAttendantsV5Data; timezone: string }) {
  const id = useId();
  const motionEnabled = useRealtimeMotionV5();
  const period = periodDescription(data, timezone);
  const localPresence = data.presenceSource === "local";
  const presenceDescription = localPresence
    ? "Presence covers visible Attendance tabs on this local instance only, not the deployed site. Handled chats are distinct conversations answered today in this webinar in the connected database."
    : "Attendants online now and the number of distinct conversations each person answered today in this webinar.";
  const rowOrder = data.items.map(item => item.id).join("|");

  return (
    <section className={styles.card} data-realtime-attendants="v5" aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`}>
      <header className={styles.header}>
        <h2 id={`${id}-title`} className={styles.title}>Online attendants</h2>
        <span className={styles.period} title={period}>Today</span>
      </header>
      <p id={`${id}-description`} className="sr-only">
        {presenceDescription}
        Multiple replies to the same conversation count once per attendant. This does not indicate resolved conversations. {period}.
      </p>
      {data.available && data.items.length > 0 ? (
        <div className={styles.body}>
          <div className={styles.columns} aria-hidden="true">
            <span>Attendant</span>
            <span title={period}>Handled chats</span>
          </div>
          <ul className={styles.list} tabIndex={data.items.length > 4 ? 0 : undefined} aria-label="Online attendants and handled chats">
            <AnimatePresence initial={false} mode="popLayout">
              {data.items.map((item, index) => {
                const name = item.name.trim() || "Unnamed attendant";
                return (
                  <motion.li
                    key={item.id}
                    className={styles.row}
                    layout={motionEnabled ? "position" : false}
                    layoutDependency={rowOrder}
                    initial={motionEnabled ? { opacity: 0, y: 3 } : false}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: motionEnabled ? -3 : 0 }}
                    transition={{ duration: motionEnabled ? 0.2 : 0, ease: "easeOut" }}
                  >
                    <span className={styles.avatar} aria-hidden="true">
                      {initials(name)}
                      <motion.span
                        className={styles.online}
                        initial={false}
                        animate={{ opacity: motionEnabled ? [1, 0.6, 1] : 1 }}
                        transition={{ duration: motionEnabled ? 3.6 : 0, delay: motionEnabled ? index * 0.2 : 0, repeat: motionEnabled ? Infinity : 0, ease: "easeInOut" }}
                      />
                    </span>
                    <span className={styles.name} title={name}>{name}<span className="sr-only">, online</span></span>
                    <span className={styles.count} aria-label={`${countFormatter.format(item.handledConversations)} distinct conversations answered today`}>
                      <RealtimeMotionValueV5 value={item.handledConversations}>
                        {countFormatter.format(item.handledConversations)}
                      </RealtimeMotionValueV5>
                    </span>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        </div>
      ) : <p className={styles.empty}>{data.available
        ? localPresence ? "No attendants online on this local instance" : "No attendants online"
        : "Attendant presence not collected yet"}</p>}
      {data.available && <p className={styles.footer} title={`${presenceDescription} ${period}`}>
        {localPresence ? "Local presence · Distinct conversations answered today" : "Distinct conversations answered today"}
      </p>}
    </section>
  );
}
