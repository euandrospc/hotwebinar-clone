import type { ReactNode } from "react";
import { Eye, UserCheck, MonitorPlay, MousePointerClick, DollarSign, Filter, type AppIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

export interface ConversionFunnelData {
  visitantes: number;
  participantes: number;
  assistiuVivo: number;
  assistiuReplay: number;
  clicouVivo: number;
  clicouReplay: number;
  comprou: number;
}
const fmt = new Intl.NumberFormat("pt-BR");
function pct(part: number, whole: number): string {
  return whole <= 0 ? "0,00%" : `${((part / whole) * 100).toFixed(2).replace(".", ",")}%`;
}

function Tile({ icon: Icon, label, highlight, children }: { icon: AppIcon; label: string; highlight?: boolean; children: ReactNode }) {
  return (
    <div className={cn("flex min-w-36 flex-1 flex-col gap-2 rounded-xl p-3.5", highlight ? "bg-palco/15" : "bg-[#0F130F]")}>
      <p className="flex items-center gap-1.5 text-[11px] text-neutral-400">
        <Icon aria-hidden="true" className={cn("size-3", highlight ? "text-palco" : "text-[#7C867E]")} />{label}
      </p>
      {children}
    </div>
  );
}

const Value = ({ value, highlight }: { value: number; highlight?: boolean }) => (
  <p className={cn("text-[22px] font-semibold leading-tight tabular-nums", highlight ? "text-[#B6F09A]" : "text-neutral-100")}>{fmt.format(value)}</p>
);

function Channel({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <div className="flex flex-col gap-[3px]">
      <p className="flex items-center justify-between gap-2 text-[11px] text-[#7C867E]">{label}<strong className="text-sm font-semibold tabular-nums text-neutral-100">{fmt.format(value)}</strong></p>
      <p className="text-[10px] text-[#5A635C]">{detail}</p>
    </div>
  );
}

export function MetricsConversionFunnel({ data }: { data: ConversionFunnelData }) {
  return <section className="flex min-w-0 flex-col gap-4 rounded-2xl border border-[#1E241F] bg-[#0C0E0C] p-5 font-palco">
    <h3 className="flex items-center gap-2 text-sm font-semibold text-neutral-100"><Filter aria-hidden="true" className="size-3.5 text-palco" />Tráfego e conversão de página</h3>
    <div className="-mx-1 overflow-x-auto px-1 pb-1">
      <div className="flex min-w-max gap-2.5 xl:min-w-0">
        <Tile icon={Eye} label="Visitantes"><Value value={data.visitantes} /></Tile>
        <Tile icon={UserCheck} label="Participantes">
          <Value value={data.participantes} />
          <p className="text-[11px] text-[#7C867E]">Taxa de inscrição · {pct(data.participantes, data.visitantes)}</p>
        </Tile>
        <Tile icon={MonitorPlay} label="Assistiram">
          <Channel label="Ao vivo" value={data.assistiuVivo} detail={`Show up · ${pct(data.assistiuVivo, data.participantes)}`} />
          <Channel label="Replay" value={data.assistiuReplay} detail={`Show up · ${pct(data.assistiuReplay, data.participantes)}`} />
        </Tile>
        <Tile icon={MousePointerClick} label="Clicaram na oferta">
          <Channel label="Ao vivo" value={data.clicouVivo} detail={`${pct(data.clicouVivo, data.assistiuVivo)} de quem assistiu`} />
          <Channel label="Replay" value={data.clicouReplay} detail={`${pct(data.clicouReplay, data.assistiuReplay)} de quem assistiu`} />
        </Tile>
        <Tile icon={DollarSign} label="Compraram" highlight><Value value={data.comprou} highlight /></Tile>
      </div>
    </div>
  </section>;
}
