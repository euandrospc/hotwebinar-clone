"use client";

import { useState } from "react";
import { Smartphone } from "@/components/icons";
import { DonutChart } from "@/components/tremor/donut-chart";
import type { DeviceBreakdown } from "@/lib/dashboard-stats";
import { cn } from "@/lib/utils";

const numberFormat = new Intl.NumberFormat("pt-BR");
const percentFormat = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

export function DashboardDispositivosChart({ devices }: { devices: DeviceBreakdown }) {
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const total = devices.desktop + devices.mobile;
  const data = [
    { name: "Computador", value: devices.desktop, color: "bg-[#064B3C]" },
    { name: "Celular", value: devices.mobile, color: "bg-[#A6DE6B]" }
  ];
  const selected = data.find((device) => device.name === selectedDevice);

  return (
    <section aria-labelledby="devices-title" className="h-full min-w-0 rounded-2xl border border-[#E5E9E6] dark:border-border bg-white dark:bg-card p-5 sm:p-6">
      <header className="flex items-center justify-between gap-3">
        <h3 id="devices-title" className="text-sm font-semibold text-[#253C31] dark:text-foreground">Dispositivos</h3>
        <span className="text-xs text-[#7C8580] dark:text-muted-foreground">No período</span>
      </header>

      {total === 0 ? (
        <div className="flex min-h-64 flex-col items-center justify-center gap-2 text-center">
          <Smartphone aria-hidden="true" className="mb-1 size-7 text-[#A2ADA5] dark:text-muted-foreground" />
          <p className="text-sm font-medium text-[#59645E] dark:text-muted-foreground">Sem dispositivos identificados</p>
          <p className="max-w-64 text-xs leading-relaxed text-[#7C8580] dark:text-muted-foreground">A distribuição aparece quando houver sessões com informação do dispositivo.</p>
        </div>
      ) : (
        <>
          <div className="relative mx-auto my-5 size-44">
            <DonutChart
              data={data}
              category="name"
              value="value"
              colors={["forest", "chartLime"]}
              className="size-44"
              valueFormatter={(value) => `${numberFormat.format(value)} sessões (${percentFormat.format(value / total * 100)}%)`}
              activeCategory={selectedDevice}
              onValueChange={(value) => setSelectedDevice(value?.categoryClicked ?? null)}
              aria-label={`Distribuição de ${numberFormat.format(total)} sessões por dispositivo`}
            />
            <div aria-live="polite" className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-semibold tracking-tight tabular-nums text-[#153D30] dark:text-foreground">{numberFormat.format(selected?.value ?? total)}</span>
              <span className="mt-1 text-xs text-[#7C8580] dark:text-muted-foreground">{selected?.name ?? "sessões"}</span>
            </div>
          </div>
          <ul aria-label="Destaque um dispositivo no gráfico" className="space-y-1">
            {data.map((device) => (
              <li key={device.name}>
                <button
                  type="button"
                  aria-pressed={selectedDevice === device.name}
                  onClick={() => setSelectedDevice(selectedDevice === device.name ? null : device.name)}
                  className={cn("flex w-full items-center gap-2.5 rounded-lg px-2 py-2.5 text-left text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#064B3C] dark:focus-visible:ring-[#A6DE6B]", selectedDevice === device.name ? "bg-[#F1F6EE] dark:bg-accent" : "hover:bg-[#F7F9F7] dark:hover:bg-muted")}
                >
                  <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-full", device.color)} />
                  <span className="flex-1 text-[#59645E] dark:text-muted-foreground">{device.name}</span>
                  <span className="font-medium tabular-nums text-[#253C31] dark:text-foreground">{numberFormat.format(device.value)}</span>
                  <span className="w-12 text-right tabular-nums text-[#7C8580] dark:text-muted-foreground">{percentFormat.format(device.value / total * 100)}%</span>
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-3 border-t border-[#F0F2F0] dark:border-border pt-3 text-xs leading-relaxed text-[#7C8580] dark:text-muted-foreground">Sessões com dispositivo identificado.</p>
        </>
      )}
    </section>
  );
}
