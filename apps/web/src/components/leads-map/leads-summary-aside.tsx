import type { LeadsMapAggregate } from "@/lib/leads-map-aggregate";

const fmt = new Intl.NumberFormat("pt-BR");

function flagEmoji(code: string): string {
  if (code.length !== 2) return "";
  const A = 127397;
  return String.fromCodePoint(A + code.toUpperCase().charCodeAt(0)) +
         String.fromCodePoint(A + code.toUpperCase().charCodeAt(1));
}

export function LeadsSummaryAside({ agg }: { agg: LeadsMapAggregate }) {
  const geoPct = agg.total > 0 ? Math.round((agg.geoCount / agg.total) * 100) : 0;

  return (
    <aside className="space-y-6 rounded-lg border bg-card p-5">
      <div>
        <p className="text-xs uppercase text-muted-foreground">Total de leads</p>
        <p className="text-3xl font-semibold">{fmt.format(agg.total)}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {fmt.format(agg.geoCount)} com geolocalização ({geoPct}%)
        </p>
      </div>

      {agg.topCountries.length > 0 && (
        <div>
          <p className="mb-2 text-xs uppercase text-muted-foreground">Top Países</p>
          <ul className="space-y-1.5">
            {agg.topCountries.map((c) => (
              <li key={c.code} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <span aria-hidden>{flagEmoji(c.code)}</span>
                  <span className="font-mono">{c.code}</span>
                </span>
                <span className="tabular-nums text-muted-foreground">{fmt.format(c.count)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {agg.topCities.length > 0 && (
        <div>
          <p className="mb-2 text-xs uppercase text-muted-foreground">Top Cidades</p>
          <ul className="space-y-1.5">
            {agg.topCities.map((c) => (
              <li key={c.city} className="flex items-center justify-between text-sm">
                <span>{c.city}</span>
                <span className="tabular-nums text-muted-foreground">{fmt.format(c.count)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {agg.ungeoCount > 0 && (
        <p className="border-t pt-3 text-xs text-muted-foreground">
          {fmt.format(agg.ungeoCount)} leads sem geolocalização
        </p>
      )}
    </aside>
  );
}
