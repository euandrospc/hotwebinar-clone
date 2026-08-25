"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { PublicVideo, PublicWebinar } from "@/lib/public-dto";

function fmt(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

export function CountdownView({ w, video }: { w: PublicWebinar; video: PublicVideo | null }) {
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

  if (w.waitingTemplate === "MINIMAL") {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-6 text-center">
        <p className="font-mono text-7xl tabular-nums" aria-live="polite">{fmt(remaining)}</p>
      </main>
    );
  }

  if (w.waitingTemplate === "FEATURES") {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-10">
        {w.logoUrl ? <img src={w.logoUrl} alt="" className="mb-6 h-auto object-contain" /> : null}
        <h1 className="text-3xl font-semibold">{w.waitingTitle}</h1>
        <p className="mt-2 text-muted-foreground">{w.waitingSubtitle}</p>
        <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
          <ul className="space-y-2 text-sm">
            <li className="flex items-start gap-2">✓ Acesso completo ao webinar ao vivo</li>
            <li className="flex items-start gap-2">✓ Materiais exclusivos para participantes</li>
            <li className="flex items-start gap-2">✓ Sessão de Q&A ao final</li>
            <li className="flex items-start gap-2">✓ Bônus surpresa para inscritos</li>
          </ul>
          <p className="self-center font-mono text-5xl tabular-nums" aria-live="polite">{fmt(remaining)}</p>
        </div>
      </main>
    );
  }

  if (w.waitingTemplate === "IMMERSIVE") {
    return (
      <main className="relative min-h-screen overflow-hidden bg-black text-white">
        {video?.thumbUrl || video?.customThumbUrl ? (
          <img
            src={video.customThumbUrl ?? video.thumbUrl ?? ""}
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-30"
          />
        ) : null}
        <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 text-center">
          {w.logoUrl ? <img src={w.logoUrl} alt="" className="mb-6 h-auto object-contain" /> : null}
          <h1 className="text-3xl font-semibold">{w.waitingTitle}</h1>
          <p className="mt-2 text-white/80">{w.waitingSubtitle}</p>
          <p className="mt-8 font-mono text-6xl tabular-nums" aria-live="polite">{fmt(remaining)}</p>
        </div>
      </main>
    );
  }

  // DEFAULT and WITH_THUMB share the same layout but WITH_THUMB shows thumb.
  const showThumb = w.waitingTemplate === "WITH_THUMB";
  const thumb = showThumb ? (video?.customThumbUrl ?? video?.thumbUrl ?? null) : null;

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-6 text-center">
      {w.logoUrl ? <img src={w.logoUrl} alt="" className="mb-6 h-auto object-contain" /> : null}
      <h1 className="text-3xl font-semibold">{w.waitingTitle}</h1>
      <p className="mt-2 text-muted-foreground">{w.waitingSubtitle}</p>
      {thumb ? (
        <img src={thumb} alt="" className="mt-6 aspect-video w-full max-w-md rounded-lg border object-cover shadow" />
      ) : null}
      <p className="mt-8 font-mono text-5xl tabular-nums" aria-live="polite">{fmt(remaining)}</p>
    </main>
  );
}
