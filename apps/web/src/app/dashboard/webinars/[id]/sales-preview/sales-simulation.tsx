"use client";

import { useEffect, useRef, useState } from "react";
import type { PublicSaleNotification } from "@/lib/public-dto";
import { SalesNotifier } from "@/app/[slug]/_components/sales-notifier";
import { resolveScheduledSales } from "@/lib/scheduled-sales";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

import { AdminPageHeader } from "@/components/admin/admin-page";
import styles from "@/components/webinar/webinar-operations.module.css";

type Props = { title: string; notifications: PublicSaleNotification[] };

function Playback({ notifications }: Pick<Props, "notifications">) {
  const initial = Math.max(0, (notifications[0]?.showAtSec ?? 0) - 3);
  const last = notifications.at(-1)?.showAtSec ?? initial;
  const currentTimeRef = useRef(initial);
  const [time, setTime] = useState(initial);
  const [speed, setSpeed] = useState(4);
  useEffect(() => {
    const started = performance.now();
    const from = currentTimeRef.current;
    const timer = setInterval(() => {
      currentTimeRef.current = Math.min(last, from + (performance.now() - started) * speed / 1000);
      setTime(Math.floor(currentTimeRef.current));
      if (currentTimeRef.current >= last) clearInterval(timer);
    }, 200);
    return () => clearInterval(timer);
  }, [last, speed]);
  return <>
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-border/50 pb-3">
      <span className="text-xs tabular-nums">Tempo do vídeo · {new Date(time * 1000).toISOString().slice(11, 19)}</span>
      <label className="text-xs">Velocidade <select className="ml-2 h-8 rounded-lg border bg-background px-2 text-xs" value={speed} onChange={e => setSpeed(Number(e.target.value))}>
        <option value={1}>1×</option><option value={4}>4×</option>
      </select></label>
    </div>
    <SalesNotifier notifications={notifications} currentTimeRef={currentTimeRef} />
  </>;
}

export function SalesSimulation({ title, notifications }: Props) {
  const [city, setCity] = useState("São Paulo");
  const [run, setRun] = useState(0);
  return <><AdminPageHeader title="Simulação das notificações" description={`${title} · ${notifications.length} notificações disponíveis`} actions={<Button variant="outline" className="h-[34px] rounded-lg text-xs" onClick={() => setRun(run + 1)}>Reiniciar simulação</Button>} /><div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
    <label className={`${styles.surface} ${styles.form} self-start`}>Cidade do espectador na simulação<Input value={city} maxLength={100} onChange={event => setCity(event.target.value)} /></label>
    <section className={`${styles.surface} min-h-64`}>
      {notifications.length ? <Playback key={run} notifications={resolveScheduledSales(notifications, city)} /> : <p>Nenhuma notificação programada.</p>}
    </section>
  </div></>;
}
