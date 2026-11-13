"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CircleCheck } from "@/components/icons";
import { cn } from "@/lib/utils";

const ROOMS_FROM = 118;
const ROOMS_WARM = 142;
const ROOMS_CEILING = 197;

const random = (min: number, max: number) => min + Math.floor(Math.random() * (max - min + 1));

/**
 * Illustrative "rooms selling" count: a quick climb to the design's 142, then irregular
 * jumps of 1 to 4 rooms at uneven intervals until a ceiling, where it holds.
 */
export function LiveRoomCount() {
  const reduce = useReducedMotion();
  const [count, setCount] = useState(ROOMS_FROM);
  useEffect(() => {
    if (reduce) { setCount(ROOMS_WARM); return; }
    if (count >= ROOMS_CEILING) return;
    const warming = count < ROOMS_WARM;
    const timer = setTimeout(
      () => setCount(value => Math.min(ROOMS_CEILING, value + (value < ROOMS_WARM ? 1 : random(1, 4)))),
      warming ? 70 : random(1400, 5200)
    );
    return () => clearTimeout(timer);
  }, [count, reduce]);
  return <span className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-palco/20 bg-palco/10 px-2.5 py-1.5 text-xs text-white backdrop-blur-md sm:px-3.5 sm:py-2 sm:text-sm">
    <span className="size-2 animate-pulse rounded-full bg-palco motion-reduce:animate-none" />
    <span><span className="tabular-nums">{count}</span> salas vendendo agora</span>
  </span>;
}

const sales = [
  { buyer: "Ana P.", product: "Mentoria", price: "R$ 997" },
  { buyer: "Marcos L.", product: "Mentoria", price: "R$ 997" },
  { buyer: "Carla S.", product: "Imersão", price: "R$ 497" },
  { buyer: "João V.", product: "Mentoria", price: "R$ 997" },
  { buyer: "Bruna M.", product: "Comunidade", price: "R$ 297" },
  { buyer: "Rafael T.", product: "Mentoria", price: "R$ 997" }
];

const toast = "flex w-full items-center gap-3 rounded-2xl border border-palco/35 bg-neutral-900/95 p-3.5 shadow-2xl shadow-black/70 backdrop-blur-lg";

/** Purchase toasts that keep arriving over the room preview; the previous one stays stacked behind. */
export function SaleFeed({ className }: { className?: string }) {
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (reduce) return;
    const timer = setInterval(() => setIndex(value => value + 1), 3600);
    return () => clearInterval(timer);
  }, [reduce]);
  const sale = sales[index % sales.length];
  return <div className={cn("relative", className)}>
    {index > 0 && <div className={cn(toast, "absolute inset-0 translate-y-2 scale-95 opacity-50 shadow-none")} />}
    <AnimatePresence initial={!reduce} mode="popLayout">
      <motion.div
        key={index}
        className={cn(toast, "relative z-10")}
        initial={{ opacity: 0, y: -36, scale: 0.94 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 14, scale: 0.94 }}
        transition={{ type: "spring", stiffness: 380, damping: 30 }}
      >
        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-palco text-neutral-950"><CircleCheck className="size-5" /></span>
        <span className="grid gap-0.5">
          <strong className="text-sm font-bold">Venda confirmada!</strong>
          <small className="text-xs text-neutral-400">{sale.buyer} comprou a {sale.product} · {sale.price}</small>
        </span>
      </motion.div>
    </AnimatePresence>
  </div>;
}
