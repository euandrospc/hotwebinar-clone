"use client";
import { Smartphone } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import type { DeviceBreakdown } from "@/lib/dashboard-stats";

const fmt = new Intl.NumberFormat("pt-BR");

export function DashboardDispositivosChart({ devices }: { devices: DeviceBreakdown }) {
  const total = devices.desktop + devices.mobile;
  const data = [
    { name: "Desktop", value: devices.desktop, color: "#fca5a5" },
    { name: "Mobile", value: devices.mobile, color: "#dc2626" }
  ];

  return (
    <section className="rounded-lg border bg-card p-5">
      <header className="flex items-center gap-2">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <Smartphone className="h-3.5 w-3.5" />
        </span>
        <h3 className="text-sm font-semibold">Dispositivos</h3>
      </header>

      {total === 0 ? (
        <p className="mt-8 text-center text-sm text-muted-foreground">Sem dados ainda.</p>
      ) : (
        <div className="mt-4 grid grid-cols-2 items-center gap-4">
          <ul className="space-y-2 text-sm">
            <li className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-full" style={{ background: data[0].color }} />
              <div>
                <p>Desktop · {devices.desktopPct.toFixed(2)}%</p>
                <p className="text-xs text-muted-foreground tabular-nums">{fmt.format(devices.desktop)}</p>
              </div>
            </li>
            <li className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-full" style={{ background: data[1].color }} />
              <div>
                <p>Mobile · {devices.mobilePct.toFixed(2)}%</p>
                <p className="text-xs text-muted-foreground tabular-nums">{fmt.format(devices.mobile)}</p>
              </div>
            </li>
          </ul>
          <div className="relative h-40">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} dataKey="value" innerRadius={45} outerRadius={70} startAngle={90} endAngle={-270}>
                  {data.map((d) => (
                    <Cell key={d.name} fill={d.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <p className="text-lg font-semibold tabular-nums">{devices.desktopPct.toFixed(2)}%</p>
              <p className="text-xs text-muted-foreground">Desktop</p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
