"use client";
import { useId, useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { simulateAudienceSeries, type AudienceMode } from "@/lib/audience-sim";

interface Props {
  mode: AudienceMode;
  min: number;
  max: number;
  duration: number;
  seed: string;
}

function fmtTime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h}h${String(m).padStart(2, "0")}` : `${m}m`;
}

export function AudienceChart({ mode, min, max, duration, seed }: Props) {
  const data = useMemo(
    () =>
      mode === "NONE"
        ? []
        : simulateAudienceSeries(duration, min, max, seed, mode),
    [mode, min, max, duration, seed]
  );

  const gradientId = `aud-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;

  if (mode === "NONE") {
    return (
      <div className="flex h-[250px] items-center justify-center rounded-xl border border-dashed border-[#1E241F] text-sm text-[#7C867E]">
        Modo desabilitado
      </div>
    );
  }

  // ~9 evenly spaced ticks, skipping ones whose label would repeat on short videos.
  const step = Math.max(1, Math.ceil(data.length / 9));
  const ticks = data.filter((_, i) => i % step === 0).map((d) => d.t)
    .filter((t, i, all) => i === 0 || fmtTime(t) !== fmtTime(all[i - 1]));
  const axis = { stroke: "#6E776F", fontSize: 10, tickLine: false, axisLine: false } as const;
  return (
    <div className="h-[250px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 6, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2BE07A" stopOpacity={0.2} />
              <stop offset="100%" stopColor="#2BE07A" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="#1A1F1B" />
          <XAxis dataKey="t" tickFormatter={fmtTime} {...axis} ticks={ticks} interval={0} tickMargin={10} />
          <YAxis domain={[0, "auto"]} tickCount={5} width={36} {...axis} />
          <Tooltip
            labelFormatter={(label) => fmtTime(Number(label))}
            formatter={(value) => [Number(value).toLocaleString("pt-BR"), "Audiência"]}
            cursor={{ stroke: "#2A322C" }}
            contentStyle={{ background: "#121512", border: "1px solid #1E241F", borderRadius: 10, fontSize: 12, color: "#F2F5F2" }}
          />
          <Area type="monotone" dataKey="count" stroke="#2BE07A" strokeWidth={2} fill={`url(#${gradientId})`} dot={false} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
