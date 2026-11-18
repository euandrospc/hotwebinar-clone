"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { MotionConfig, motion } from "framer-motion";

const MotionEnabledContext = createContext(false);

/** One visibility/reduced-motion gate for the entire realtime surface. */
export function RealtimeMotionV5Provider({ paused = false, children }: { paused?: boolean; children: ReactNode }) {
  const [environment, setEnvironment] = useState({ visible: false, reduced: true });
  useEffect(() => {
    const preference = typeof window.matchMedia === "function" ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
    const update = () => setEnvironment({ visible: document.visibilityState === "visible", reduced: preference?.matches ?? true });
    update();
    document.addEventListener("visibilitychange", update);
    preference?.addEventListener("change", update);
    return () => {
      document.removeEventListener("visibilitychange", update);
      preference?.removeEventListener("change", update);
    };
  }, []);
  return (
    <MotionConfig reducedMotion={environment.reduced ? "always" : "user"}>
      <MotionEnabledContext.Provider value={environment.visible && !environment.reduced && !paused}>
        {children}
      </MotionEnabledContext.Provider>
    </MotionConfig>
  );
}

export function useRealtimeMotionV5() {
  return useContext(MotionEnabledContext);
}

/** Reveal the new exact value without counting through invented intermediate totals. */
export function RealtimeMotionValueV5({ value, children, className }: {
  value: string | number | null;
  children: ReactNode;
  className?: string;
}) {
  const enabled = useRealtimeMotionV5();
  return (
    <motion.span
      key={value ?? "unavailable"}
      className={className}
      style={{ display: "inline-block" }}
      initial={enabled ? { opacity: 0.45, y: 2 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: enabled ? 0.2 : 0, ease: "easeOut" }}
    >
      {children}
    </motion.span>
  );
}
