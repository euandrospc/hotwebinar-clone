import Link from "next/link";
import { MapPin, ArrowRight } from "lucide-react";
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
    <section className="rounded-lg border bg-card p-5">
      <header className="flex items-center gap-2">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <MapPin className="h-3.5 w-3.5" />
        </span>
        <h3 className="text-sm font-semibold">Leads por Região</h3>
      </header>

      {data.rows.length === 0 ? (
        <div className="mt-4 flex h-40 flex-col items-center justify-center gap-1 rounded-md bg-muted/30 text-center">
          <p className="text-sm text-muted-foreground">Sem dados de localização ainda.</p>
          <p className="text-xs text-muted-foreground">
            As regiões aparecem conforme os leads acessam.
          </p>
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {data.rows.map((r) => (
            <li key={r.label}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="truncate font-medium">{r.label}</span>
                <span className="tabular-nums text-muted-foreground">
                  {fmt.format(r.count)} · {r.pct.toFixed(1).replace(".", ",")}%
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-destructive"
                  style={{ width: `${(r.count / max) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      {firstWebinarId ? (
        <Link
          href={`/dashboard/webinars/${firstWebinarId}/leads-map`}
          className="mt-4 inline-flex items-center gap-1 text-xs text-primary underline-offset-2 hover:underline"
        >
          Abrir mapa por webinar <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      ) : null}
    </section>
  );
}
