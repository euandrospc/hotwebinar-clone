import Link from "next/link";
import { MapPin } from "lucide-react";

export function DashboardRegionCard({ firstWebinarId }: { firstWebinarId: string | null }) {
  return (
    <section className="rounded-lg border bg-card p-5">
      <header className="flex items-center gap-2">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <MapPin className="h-3.5 w-3.5" />
        </span>
        <h3 className="text-sm font-semibold">Leads por Região</h3>
      </header>

      <div className="mt-4 flex h-56 flex-col items-center justify-center gap-3 rounded-md bg-muted/30 text-center">
        <svg viewBox="0 0 200 100" className="h-32 w-full opacity-30">
          <path
            d="M20 40 Q40 20 60 40 T100 40 T140 40 T180 40 L180 70 Q160 80 140 70 T100 70 T60 70 T20 70 Z"
            fill="currentColor"
            className="text-muted-foreground"
          />
        </svg>
        {firstWebinarId ? (
          <Link
            href={`/dashboard/webinars/${firstWebinarId}/leads-map`}
            className="text-xs text-primary underline-offset-2 hover:underline"
          >
            Abrir mapa por webinar →
          </Link>
        ) : (
          <p className="text-xs text-muted-foreground">Sem dados ainda.</p>
        )}
      </div>
    </section>
  );
}
