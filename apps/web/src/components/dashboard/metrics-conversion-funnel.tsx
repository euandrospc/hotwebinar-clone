import {
  Filter,
  Info,
  Users,
  UserCheck,
  MonitorPlay,
  RotateCcw,
  MousePointerClick,
  DollarSign,
  ArrowRight
} from "lucide-react";

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
  if (whole <= 0) return "0,00%";
  return `${((part / whole) * 100).toFixed(2).replace(".", ",")}%`;
}

function Node({
  icon,
  label,
  value
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-[84px] flex-col items-center text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        {icon}
      </span>
      <span className="mt-1 text-[11px] text-muted-foreground">{label}</span>
      <span className="text-lg font-semibold tabular-nums">{value}</span>
    </div>
  );
}

function Connector({ caption }: { caption?: string }) {
  return (
    <div className="flex min-w-[64px] flex-col items-center justify-center px-1 text-center">
      <ArrowRight className="h-4 w-4 text-muted-foreground" />
      {caption ? (
        <span className="mt-0.5 text-[10px] font-medium text-muted-foreground">{caption}</span>
      ) : null}
    </div>
  );
}

export function MetricsConversionFunnel({ data }: { data: ConversionFunnelData }) {
  return (
    <section className="rounded-lg border bg-card p-5">
      <header className="flex items-center gap-2">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <Filter className="h-3.5 w-3.5" />
        </span>
        <h3 className="text-sm font-semibold">Tráfego e conversão de página</h3>
        <Info className="h-3.5 w-3.5 text-muted-foreground" />
      </header>

      <div className="mt-6 overflow-x-auto">
        <div className="flex min-w-max items-center gap-1">
          <Node icon={<Users className="h-5 w-5" />} label="Visitantes" value={fmt.format(data.visitantes)} />
          <Connector caption={pct(data.participantes, data.visitantes)} />
          <Node icon={<UserCheck className="h-5 w-5" />} label="Participantes" value={fmt.format(data.participantes)} />

          <div className="flex min-w-[70px] flex-col items-center justify-center px-1 text-center text-[10px] font-medium text-muted-foreground">
            <span>{pct(data.assistiuVivo, data.participantes)}</span>
            <span className="text-[9px] uppercase tracking-wide">Show up</span>
            <span>{pct(data.assistiuReplay, data.participantes)}</span>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-1">
              <Node icon={<MonitorPlay className="h-5 w-5" />} label="Assistiu ao vivo" value={fmt.format(data.assistiuVivo)} />
              <Connector caption={pct(data.clicouVivo, data.assistiuVivo)} />
              <Node icon={<MousePointerClick className="h-5 w-5" />} label="Clicou no botão" value={fmt.format(data.clicouVivo)} />
            </div>
            <div className="flex items-center gap-1">
              <Node icon={<RotateCcw className="h-5 w-5" />} label="Assistiu replay" value={fmt.format(data.assistiuReplay)} />
              <Connector caption={pct(data.clicouReplay, data.assistiuReplay)} />
              <Node icon={<MousePointerClick className="h-5 w-5" />} label="Clicou no botão" value={fmt.format(data.clicouReplay)} />
            </div>
          </div>

          <Connector />
          <Node icon={<DollarSign className="h-5 w-5" />} label="Comprou" value={fmt.format(data.comprou)} />
        </div>
      </div>
    </section>
  );
}
