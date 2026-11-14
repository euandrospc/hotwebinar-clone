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
    <section aria-labelledby="devices-title" className="flex h-full min-w-0 flex-col gap-4 rounded-2xl border border-[#1E241F] bg-[#0C0E0C] p-5 font-palco">
      <header className="flex items-center justify-between gap-3">
        <h3 id="devices-title" className="text-sm font-semibold text-neutral-100">Dispositivos</h3>
        <span className="text-xs text-[#7C867E]">No período</span>
      </header>

      {total === 0 ? (
        <div className="flex min-h-64 flex-col items-center justify-center gap-2 text-center">
          <Smartphone aria-hidden="true" className="mb-1 size-7 text-[#6E776F]" />
          <p className="text-sm font-medium text-neutral-400">Sem dispositivos identificados</p>
          <p className="max-w-64 text-xs leading-relaxed text-[#7C867E]">A distribuição aparece quando houver sessões com informação do dispositivo.</p>
        </div>
      ) : (
        <>
          <div className="relative mx-auto my-2.5 size-[150px]">
            <DonutChart
              data={data}
              category="name"
              value="value"
              colors={["forest", "chartLime"]}
              className="size-[150px]"
              valueFormatter={(value) => `${numberFormat.format(value)} sessões (${percentFormat.format(value / total * 100)}%)`}
              activeCategory={selectedDevice}
              onValueChange={(value) => setSelectedDevice(value?.categoryClicked ?? null)}
              aria-label={`Distribuição de ${numberFormat.format(total)} sessões por dispositivo`}
            />
            <div aria-live="polite" className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[26px] font-semibold leading-tight tabular-nums text-neutral-100">{numberFormat.format(selected?.value ?? total)}</span>
              <span className="mt-0.5 text-[11px] text-[#7C867E]">{selected?.name ?? "sessões"}</span>
            </div>
          </div>
          <ul aria-label="Destaque um dispositivo no gráfico" className="-mx-2 space-y-0.5">
            {data.map((device) => (
              <li key={device.name}>
                <button
                  type="button"
                  aria-pressed={selectedDevice === device.name}
                  onClick={() => setSelectedDevice(selectedDevice === device.name ? null : device.name)}
                  className={cn("flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-palco motion-reduce:transition-none", selectedDevice === device.name ? "bg-white/[0.04]" : "hover:bg-white/[0.03]")}
                >
                  <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-full", device.color)} />
                  <span className="flex-1 text-neutral-400">{device.name}</span>
                  <span className="font-semibold tabular-nums text-neutral-100">{numberFormat.format(device.value)}</span>
                  <span className="w-12 text-right tabular-nums text-[#7C867E]">{percentFormat.format(device.value / total * 100)}%</span>
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-auto text-[11px] leading-relaxed text-[#7C867E]">Sessões com dispositivo identificado.</p>
        </>
      )}
    </section>
  );
}
