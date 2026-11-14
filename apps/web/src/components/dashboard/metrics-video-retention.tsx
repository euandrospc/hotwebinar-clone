"use client";
import { TrendingUp } from "@/components/icons";
import { Area, AreaChart, XAxis, ResponsiveContainer, Tooltip } from "recharts";
import { useReducedMotion } from "framer-motion";
import type { RetentionPoint } from "@/lib/dashboard-stats";

export function MetricsVideoRetention({ data }: { data: RetentionPoint[] }) {
  const reducedMotion = useReducedMotion();
  return (
    <section className="flex min-w-0 flex-col gap-4 rounded-2xl border border-[#1E241F] bg-[#0C0E0C] p-5 font-palco">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-neutral-100"><TrendingUp aria-hidden="true" className="size-3.5 text-palco" />Métricas do vídeo</h3>

      <p className="text-xs text-[#7C867E]">Retenção sobre os espectadores que iniciaram o vídeo, no período selecionado.</p>

      <div className="h-44 min-w-0">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="retentionFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2BE07A" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#2BE07A" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="label"
              stroke="#5A635C"
              tick={{ fill: "#5A635C" }}
              fontSize={10}
              tickLine={false}
              axisLine={false}
              minTickGap={24}
              interval="preserveStartEnd"
            />
            <Tooltip cursor={{ stroke: "#2A322B" }} content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const point = payload[0].payload as RetentionPoint;
              return <div role="tooltip" className="space-y-1 rounded-xl border border-[#1E241F] bg-[#121512] p-3 font-palco text-xs text-neutral-400 shadow-lg">
                <p>Tempo assistido {point.label}</p>
                <p className="text-lg font-semibold text-palco">
                  {point.pct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
                </p>
                <p>{point.count.toLocaleString("pt-BR")} espectadores assistiram pelo menos este tempo.</p>
              </div>;
            }} />
            <Area
              type="monotone"
              dataKey="count"
              stroke="#6FBF4A"
              isAnimationActive={!reducedMotion}
              strokeWidth={2}
              fill="url(#retentionFill)"
              activeDot={{ r: 4, fill: "#2BE07A", stroke: "#0C0E0C", strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
