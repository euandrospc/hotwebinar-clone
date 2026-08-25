import { Info, Filter } from "lucide-react";
import type { FunnelStage } from "@/lib/dashboard-stats";

const fmt = new Intl.NumberFormat("pt-BR");

export function DashboardFunnel({ stages }: { stages: FunnelStage[] }) {
  const max = Math.max(1, ...stages.map((s) => s.count));

  return (
    <section className="rounded-lg border bg-card p-5">
      <header className="flex items-center gap-2">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <Filter className="h-3.5 w-3.5" />
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

      <div className="mt-5 flex h-36 items-stretch gap-1.5">
        {stages.map((s, i) => {
          const heightFor = (idx: number) => 12 + 88 * ((stages[idx]?.count ?? 0) / max);
          const leftH = heightFor(i);
          const rightH = i + 1 < stages.length ? heightFor(i + 1) : leftH;
          const fill = `hsl(0 ${55 + i * 9}% ${74 - i * 8}%)`;
          return (
            <div key={s.label} className="relative flex-1 overflow-hidden rounded-sm">
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
                <polygon
                  points={`0,${50 - leftH / 2} 100,${50 - rightH / 2} 100,${50 + rightH / 2} 0,${50 + leftH / 2}`}
                  fill={fill}
                />
              </svg>
            </div>
          );
        })}
      </div>
    </section>
  );
}
