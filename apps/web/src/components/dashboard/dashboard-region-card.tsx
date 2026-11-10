import Link from "next/link";
import { ArrowUpRight } from "@/components/icons";
import type { RegionBreakdown } from "@/lib/dashboard-stats";

const fmt = new Intl.NumberFormat("pt-BR");

export function DashboardRegionCard({
  firstWebinarId,
  data
}: {
  firstWebinarId: string | null;
  data: RegionBreakdown;
}) {
  const max = Math.max(1, ...data.rows.map((r) => r.count));

  return (
    <section className="flex h-full min-w-0 flex-col rounded-2xl border border-border/70 bg-card p-6 shadow-none" aria-label="Leads por região">
      <header className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">Principais regiões</h2>
        {firstWebinarId && (
          <Link
            href={`/dashboard/webinars/${firstWebinarId}/realtime`}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0b5141]"
            aria-label="Abrir mapa em tempo real"
            title="Abrir mapa em tempo real"
          >
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        )}
      </header>

      {data.rows.length === 0 ? (
        <div className="mt-5 flex min-h-40 flex-1 flex-col items-center justify-center gap-2 rounded-xl bg-muted/30 px-4 text-center">
          <p className="text-sm text-muted-foreground">Sem dados de localização ainda.</p>
          <p className="text-xs text-muted-foreground">
            As regiões aparecem conforme os leads acessam.
          </p>
        </div>
      ) : (
        <ul className="mt-6 space-y-4">
          {data.rows.map((r) => (
            <li key={r.label} className="grid grid-cols-[minmax(0,1fr)_minmax(48px,0.8fr)_auto] items-center gap-3 text-xs">
              <span className="truncate text-muted-foreground" title={r.label}>{r.label}</span>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted/70" aria-hidden="true">
                <div
                  className="h-full rounded-full bg-[#a8dd70]"
                  style={{ width: `${(r.count / max) * 100}%` }}
                />
              </div>
              <span className="whitespace-nowrap text-right tabular-nums">
                {fmt.format(r.count)} <span className="text-muted-foreground">· {r.pct.toFixed(1).replace(".", ",")}%</span>
              </span>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-auto pt-5 text-xs leading-relaxed text-muted-foreground">
        Percentuais entre os {fmt.format(data.located)} leads com localização no período.
      </p>
    </section>
  );
}
