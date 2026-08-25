"use client";
import { TrendingUp, Info } from "lucide-react";
import { Area, AreaChart, XAxis, ResponsiveContainer, Tooltip } from "recharts";
import type { RetentionPoint } from "@/lib/dashboard-stats";

export function MetricsVideoRetention({ data }: { data: RetentionPoint[] }) {
  return (
    <section className="rounded-lg border bg-card p-5">
      <header className="flex items-center gap-2">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <TrendingUp className="h-3.5 w-3.5" />
        </span>
        <h3 className="text-sm font-semibold">Métricas do vídeo</h3>
        <Info className="h-3.5 w-3.5 text-muted-foreground" />
      </header>

      <div className="mt-4 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
            <defs>
              <linearGradient id="retentionFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#16a34a" stopOpacity={0.85} />
                <stop offset="100%" stopColor="#16a34a" stopOpacity={0.04} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="label"
              stroke="hsl(var(--muted-foreground))"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              minTickGap={24}
              interval="preserveStartEnd"
            />
            <Tooltip
              contentStyle={{
                background: "hsl(var(--popover))",
                border: "1px solid hsl(var(--border))",
                fontSize: 12,
                borderRadius: 8
              }}
              labelFormatter={(l) => `Tempo ${l}`}
              formatter={(v) => [v as number, "Assistindo"]}
            />
            <Area
              type="monotone"
              dataKey="count"
              stroke="#16a34a"
              strokeWidth={2}
              fill="url(#retentionFill)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
