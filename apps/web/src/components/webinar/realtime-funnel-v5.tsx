"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import { motion } from "framer-motion";
import type { FunnelStage } from "@/lib/dashboard-stats";
import type { WebinarRealtimeSnapshot } from "@/lib/webinar-realtime-v5";
import { RealtimeMotionValueV5, useRealtimeMotionV5 } from "./realtime-motion-v5";
import styles from "./realtime-funnel-v5.module.css";

const stageLabels = ["Visitors", "Watched", "Reached pitch", "Clicked offer", "Purchased"];
const stageColors = ["#535bff", "#6870ff", "#7f86ff", "#979dff", "#b0b5ff"];
const countFormatter = new Intl.NumberFormat("en-US");
const percentFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const chartWidth = 700;
const chartHeight = 140;
const chartPadding = 4;
const sectionWidth = (chartWidth - chartPadding * 2) / stageLabels.length;

type Props = {
  stages?: FunnelStage[];
  timezone?: string;
  reconciliation?: NonNullable<WebinarRealtimeSnapshot["sales"]>["reconciliation"];
};

/** Each leading edge represents its own count; the next edge can grow or shrink. */
function sectionPath(index: number, value: number, nextValue: number, maximum: number): string {
  const left = chartPadding + index * sectionWidth + 2;
  const right = chartPadding + (index + 1) * sectionWidth - 2;
  const leftHalf = value / maximum * 62;
  const rightHalf = nextValue / maximum * 62;
  const middle = chartHeight / 2;
  return `M ${left} ${middle - leftHalf} L ${right} ${middle - rightHalf} L ${right} ${middle + rightHalf} L ${left} ${middle + leftHalf} Z`;
}

/** The five daily counts remain independent; this chart does not infer individual drop-offs. */
export function RealtimeFunnelV5({ stages, timezone = "America/Sao_Paulo", reconciliation }: Props) {
  const id = useId();
  const motionEnabled = useRealtimeMotionV5();
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [tabIndex, setTabIndex] = useState(0);
  const available = Array.isArray(stages) && stages.length === stageLabels.length
    && stages.every((stage) => Number.isSafeInteger(stage.count) && stage.count >= 0);
  const data = available ? stages.map((stage, index) => ({
    id: `stage-${index}`,
    label: stageLabels[index],
    value: stage.count,
    color: stageColors[index]
  })) : [];
  const maximum = Math.max(0, ...data.map(stage => stage.value));
  const hasValues = maximum > 0;
  const visitors = data[0]?.value ?? 0;
  const percentage = (value: number) => visitors > 0
    ? `${percentFormatter.format(value / visitors * 100)}%`
    : "—";
  const activeStage = activeIndex === null ? undefined : data[activeIndex];
  const purchaseDescription = reconciliation
    ? `${countFormatter.format(reconciliation.orders)} recorded course orders: ${countFormatter.format(reconciliation.uniquePeriodBuyers)} buyers with activity today, ${countFormatter.format(reconciliation.repeatBuyerOrders)} additional orders from those buyers, and ${countFormatter.format(reconciliation.ordersWithoutPeriodAccess)} orders without identified activity today.`
    : "Unique course buyers with identified webinar activity today. Repeat orders and orders without activity today are excluded from this stage.";

  function navigate(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next: number;
    switch (event.key) {
      case "ArrowRight": case "ArrowDown": next = Math.min(index + 1, data.length - 1); break;
      case "ArrowLeft": case "ArrowUp": next = Math.max(index - 1, 0); break;
      case "Home": next = 0; break;
      case "End": next = data.length - 1; break;
      case "Escape": event.preventDefault(); setActiveIndex(null); return;
      default: return;
    }
    event.preventDefault();
    setTabIndex(next);
    buttons.current[next]?.focus();
  }

  return (
    <section className={styles.card} data-realtime-funnel="v5" aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`}>
      <header className={styles.header}>
        <h2 id={`${id}-title`} className={styles.title}>Funnel</h2>
        <span className={styles.period}>Today</span>
      </header>
      <p id={`${id}-description`} className="sr-only">
        Independent daily counts in {timezone}. Percentages are relative to visitors,
        not conversion between consecutive stages. Watched requires a playback reading. {purchaseDescription}
        Use the arrow keys to explore the chart. Escape closes the detail.
      </p>
      {available ? (
        <div className={styles.viewport}>
          <div className={styles.content}>
            <div className={styles.chart}>
              {hasValues ? (
                <>
                  <svg className={styles.svg} viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="none" aria-hidden="true" focusable="false">
                    {data.map((stage, index) => (
                      <motion.path
                        key={stage.id}
                        data-funnel-section={stage.id}
                        fill={stage.color}
                        initial={false}
                        animate={{
                          d: sectionPath(index, stage.value, data[index + 1]?.value ?? stage.value, maximum),
                          opacity: activeIndex === null || activeIndex === index ? 1 : 0.55,
                        }}
                        transition={{ duration: motionEnabled ? 0.25 : 0, ease: "easeOut" }}
                      />
                    ))}
                  </svg>
                  <div className={styles.targets} role="group" aria-label="Explore today's webinar funnel">
                    {data.map((stage, index) => (
                      <button
                        key={stage.id}
                        ref={element => { buttons.current[index] = element; }}
                        type="button"
                        className={styles.target}
                        tabIndex={tabIndex === index ? 0 : -1}
                        aria-label={`${stage.label}: ${countFormatter.format(stage.value)} · ${percentage(stage.value)} of visitors`}
                        onFocus={() => { setTabIndex(index); setActiveIndex(index); }}
                        onBlur={() => setActiveIndex(null)}
                        onPointerEnter={event => { if (event.pointerType !== "touch") setActiveIndex(index); }}
                        onPointerLeave={event => { if (document.activeElement !== event.currentTarget) setActiveIndex(null); }}
                        onClick={() => setActiveIndex(index)}
                        onKeyDown={event => navigate(event, index)}
                      />
                    ))}
                  </div>
                  {activeStage && (
                    <div className={styles.tooltip} role="tooltip" style={activeIndex === 0 ? { left: 4 }
                      : activeIndex === data.length - 1 ? { right: 4 }
                      : { left: `${(activeIndex! + 0.5) / data.length * 100}%`, transform: "translateX(-50%)" }}>
                      <span className={styles.tooltipLabel}>{activeStage.label}</span>
                      <span>{countFormatter.format(activeStage.value)} · {percentage(activeStage.value)} of visitors</span>
                    </div>
                  )}
                </>
              ) : <p className={styles.empty}>No activity today</p>}
            </div>
            <ol className={styles.stages}>
              {data.map((stage) => (
                <li key={stage.id} className={styles.stage}>
                  <span className={styles.label} title={stage.id === "stage-4" ? purchaseDescription : undefined}>{stage.label}</span>
                  <RealtimeMotionValueV5 value={stage.value} className={styles.count}>{countFormatter.format(stage.value)}</RealtimeMotionValueV5>
                  <span className={styles.percent} aria-label={`${percentage(stage.value)} of visitors`}>
                    {percentage(stage.value)}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      ) : <p className={styles.unavailable}>Funnel data unavailable</p>}
    </section>
  );
}
