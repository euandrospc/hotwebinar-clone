"use client";
import { type CSSProperties, useEffect, useRef, useState } from "react";
import { CircleCheck } from "@/components/icons";
import type { PublicSaleNotification } from "@/lib/public-dto";

interface Props {
  notifications: PublicSaleNotification[];
  currentTimeRef: React.RefObject<number>;
}

interface Notice {
  id: string;
  text: string;
  expiresAt: number;
  state: "open" | "closed";
}

const DISPLAY_MS = 6000;
const EXIT_MS = 180;
const MAX_VISIBLE = 3;
const confetti = Array.from({ length: 14 }, (_, i) => {
  const angle = (i / 14) * Math.PI * 2;
  const distance = i % 2 ? 27 : 40;
  return {
    "--dx": `${Math.cos(angle) * distance}px`,
    "--dy": `${Math.sin(angle) * distance}px`,
    "--spin": `${i % 2 ? -150 : 210}deg`,
    backgroundColor: ["#10b981", "#fbbf24", "#60a5fa", "#f472b6"][i % 4]
  } as CSSProperties;
});

function message(notification: PublicSaleNotification): string {
  if (!notification.productName) return notification.buyerName;
  return notification.price
    ? `${notification.buyerName} comprou ${notification.productName} por ${notification.price}`
    : `${notification.buyerName} comprou ${notification.productName}`;
}

export function SalesNotifier({ notifications, currentTimeRef }: Props) {
  const [notices, setNotices] = useState<Notice[]>([]);
  // Late joiners skip sales already in the past instead of getting them all at once.
  const firedRef = useRef<Set<string>>(
    new Set(notifications.filter((n) => n.showAtSec < (currentTimeRef.current ?? 0)).map((n) => n.id))
  );

  const [filled, setFilled] = useState(firedRef.current.size);

  useEffect(() => {
    const id = setInterval(() => {
      const t = currentTimeRef.current ?? 0;
      const due: Notice[] = [];
      for (const n of notifications) {
        if (firedRef.current.has(n.id)) continue;
        if (t >= n.showAtSec) {
          firedRef.current.add(n.id);
          due.push({ id: n.id, text: message(n), expiresAt: Date.now() + DISPLAY_MS, state: "open" });
        }
      }
      if (due.length) {
        setFilled(firedRef.current.size);
        setNotices((current) => [...current, ...due].slice(-MAX_VISIBLE));
      }
    }, 1000);
    return () => clearInterval(id);
  }, [notifications, currentTimeRef]);

  useEffect(() => {
    if (!notices.length) return;
    const nextChange = Math.min(...notices.map((n) => n.expiresAt + (n.state === "closed" ? EXIT_MS : 0)));
    const timer = setTimeout(() => {
      const now = Date.now();
      setNotices((current) => current
        .filter((n) => now < n.expiresAt + EXIT_MS)
        .map((n) => now >= n.expiresAt ? { ...n, state: "closed" } : n));
    }, Math.max(0, nextChange - Date.now()));
    return () => clearTimeout(timer);
  }, [notices]);

  if (!filled || !notifications.length) return null;
  const percent = Math.min(90, Math.round(filled / notifications.length * 90));

  return (
    <>
      <div className="mx-2 mb-2 shrink-0 rounded-lg border bg-card p-3 md:mx-4">
        <div className="mb-2 flex justify-between text-xs font-medium">
          <span>Vagas preenchidas</span><span className="tabular-nums">{percent}%</span>
        </div>
        <div role="progressbar" aria-label="Vagas preenchidas" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} className="h-2 overflow-hidden rounded-full bg-muted">
          <div className="relative h-full overflow-hidden rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-[width] duration-700 ease-out motion-reduce:transition-none" style={{ width: `${percent}%` }}>
            <span key={filled} aria-hidden="true" className="sale-progress-shine" />
          </div>
        </div>
      </div>
      {notices.length > 0 && <div role="region" aria-label="Notificações de compra" className="max-h-40 min-h-0 min-w-0 shrink space-y-2 overflow-y-auto px-2 pb-2 md:px-4 md:pb-3">
      {notices.map((notice) => (
        <div
          key={notice.id}
          role="status"
          aria-live="polite"
          data-sale-notification={notice.id}
          data-ui-motion="chat-sale"
          data-state={notice.state}
          className="relative flex min-w-0 items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900 shadow-sm dark:border-emerald-500/30 dark:bg-emerald-950 dark:text-emerald-100 md:text-sm"
        >
          <span aria-hidden="true" className="sale-confetti">
            {confetti.map((style, index) => <i key={index} style={style} />)}
          </span>
          <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <p className="min-w-0 flex-1 break-words leading-snug">{notice.text}</p>
        </div>
      ))}
    </div>}
    </>
  );
}
