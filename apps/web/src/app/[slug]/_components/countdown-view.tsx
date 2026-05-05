"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { PublicWebinar } from "@/lib/public-dto";

function fmt(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

export function CountdownView({ w }: { w: PublicWebinar }) {
  const router = useRouter();
  const [remaining, setRemaining] = useState<number>(() => {
    if (!w.startDate) return 0;
    return Math.max(0, Math.floor((new Date(w.startDate).getTime() - Date.now()) / 1000));
  });

  useEffect(() => {
    if (!w.startDate) return;
    const end = new Date(w.startDate).getTime();
    const tick = () => {
      const r = Math.max(0, Math.floor((end - Date.now()) / 1000));
      setRemaining(r);
      if (r === 0) router.refresh();
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [w.startDate, router]);

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-6 text-center">
      {w.logoUrl ? <img src={w.logoUrl} alt="" className="mb-6 h-14 object-contain" /> : null}
      <h1 className="text-3xl font-semibold">{w.waitingTitle}</h1>
      <p className="mt-2 text-muted-foreground">{w.waitingSubtitle}</p>
      <p className="mt-8 font-mono text-5xl tabular-nums" aria-live="polite">{fmt(remaining)}</p>
    </main>
  );
}
