import { Info } from "lucide-react";
import type { FunnelStage } from "@/lib/dashboard-stats";

const fmt = new Intl.NumberFormat("pt-BR");

export function DashboardFunnel({ stages }: { stages: FunnelStage[] }) {
  const max = Math.max(1, ...stages.map((s) => s.count));

  return (
    <section className="rounded-lg border bg-card p-5">
      <header className="flex items-center gap-2">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor"><path d="M3 4h18l-7 9v6l-4 2v-8z" /></svg>
        </span>
        <h3 className="text-sm font-semibold">Funil de conversão</h3>
        <Info className="h-3.5 w-3.5 text-muted-foreground" />
      </header>

      <div className="mt-4 grid grid-cols-5 gap-3">
        {stages.map((s) => (
          <div key={s.label}>
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="text-2xl font-semibold tabular-nums">{fmt.format(s.count)}</p>
            <p className="text-xs text-muted-foreground">{s.pct.toFixed(2)}%</p>
          </div>
        ))}
      </div>

      <div className="mt-4 flex h-32 items-stretch">
        {stages.map((s, i) => {
          const startH = i === 0 ? 100 : Math.max(8, (stages[i - 1].count / max) * 100);
          const endH = Math.max(6, (s.count / max) * 100);
          return (
            <div key={s.label} className="relative flex-1 overflow-hidden">
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
                <polygon
                  points={`0,${50 - startH / 2} 100,${50 - endH / 2} 100,${50 + endH / 2} 0,${50 + startH / 2}`}
                  fill={`hsl(0 ${100 - i * 18}% ${55 + i * 5}%)`}
                />
              </svg>
            </div>
          );
        })}
      </div>
    </section>
  );
}
