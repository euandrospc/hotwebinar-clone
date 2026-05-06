"use client";
import { useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
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

  if (mode === "NONE") {
    return (
      <div className="flex h-60 items-center justify-center rounded-md border bg-muted/30 text-sm text-muted-foreground">
        Modo desabilitado
      </div>
    );
  }

  return (
    <div className="h-60 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="t" tickFormatter={fmtTime} stroke="hsl(var(--muted-foreground))" fontSize={11} />
          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
          <Tooltip
            labelFormatter={(label) => fmtTime(Number(label))}
            contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", fontSize: 12 }}
          />
          <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
