import styles from "@/components/webinar/webinar-operations.module.css";
import { Info, Filter } from "@/components/icons";
import type { FunnelStage } from "@/lib/dashboard-stats";

const fmt = new Intl.NumberFormat("pt-BR");

export function DashboardFunnel({ stages }: { stages: FunnelStage[] }) {
  const max = Math.max(1, ...stages.map((s) => s.count));

  return (
    <section className={styles.surface}>
      <header className="flex items-center gap-2">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#EDF5E7] text-[#538743] dark:bg-[#203725] dark:text-[#B5D994]">
          <Filter className="h-3.5 w-3.5" />
        </span>
        <h3 className="text-[13px] font-semibold">Funil de conversão</h3>
        <Info className="h-3.5 w-3.5 text-muted-foreground" />
      </header>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {stages.map((s) => (
          <div key={s.label}>
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="text-xl font-semibold tabular-nums">{fmt.format(s.count)}</p>
            <p className="text-xs text-muted-foreground">{s.pct.toFixed(2)}%</p>
          </div>
        ))}
      </div>

      <div className="mt-4 flex h-24 items-stretch gap-1.5">
        {stages.map((s, i) => {
          const heightFor = (idx: number) => 12 + 88 * ((stages[idx]?.count ?? 0) / max);
          const leftH = heightFor(i);
          const rightH = i + 1 < stages.length ? heightFor(i + 1) : leftH;
          const fill = ["#dcecc8", "#b6d88c", "#8fbe63", "#50875d", "#064b3c"][Math.min(i, 4)];
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
