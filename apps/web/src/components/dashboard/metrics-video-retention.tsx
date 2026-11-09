"use client";
import { TrendingUp } from "@/components/icons";
import { Area, AreaChart, XAxis, ResponsiveContainer, Tooltip } from "recharts";
import { useReducedMotion } from "framer-motion";
import styles from "@/components/webinar/webinar-operations.module.css";
import type { RetentionPoint } from "@/lib/dashboard-stats";

export function MetricsVideoRetention({ data }: { data: RetentionPoint[] }) {
  const reducedMotion = useReducedMotion();
  return (
    <section className={styles.surface}>
      <h3 className={styles.surfaceTitle}><TrendingUp aria-hidden="true" />Métricas do vídeo</h3>

      <p className="mt-2 text-xs text-muted-foreground">Retenção sobre os espectadores que iniciaram o vídeo, no período selecionado.</p>

      <div className="mt-4 h-48 min-w-0">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
            <defs>
              <linearGradient id="retentionFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#83b94d" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#83b94d" stopOpacity={0.04} />
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
            <Tooltip content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const point = payload[0].payload as RetentionPoint;
              return <div role="tooltip" className="space-y-1 rounded-lg border bg-popover p-3 text-xs text-popover-foreground shadow-md">
                <p>Tempo assistido {point.label}</p>
                <p className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">
                  {point.pct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
                </p>
                <p>{point.count.toLocaleString("pt-BR")} espectadores assistiram pelo menos este tempo.</p>
              </div>;
            }} />
            <Area
              type="monotone"
              dataKey="count"
              stroke="#568a3f"
              isAnimationActive={!reducedMotion}
              strokeWidth={2}
              fill="url(#retentionFill)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
