import {
  Lock,
  LogIn,
  MousePointerClick,
  Hourglass,
  Target,
  DollarSign,
  CheckCircle2,
  MessageSquare,
  Info,
  type LucideIcon
} from "lucide-react";
import type { WebinarKpis } from "@/lib/dashboard-stats";

const fmt = new Intl.NumberFormat("pt-BR");

function Row({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: number }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3">
      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <Icon className="h-4 w-4" />
      </span>
      <span className="flex flex-1 items-center gap-1 text-sm">
        {label}
        <Info className="h-3 w-3 text-muted-foreground" />
      </span>
      <span className="text-lg font-semibold tabular-nums">{fmt.format(value)}</span>
    </div>
  );
}

export function MetricsKpiList({ kpis }: { kpis: WebinarKpis }) {
  return (
    <div className="space-y-2.5">
      <Row icon={Lock} label="Visitas" value={kpis.visitas} />
      <Row icon={LogIn} label="Acessou o webinar" value={kpis.acessou} />
      <Row icon={MousePointerClick} label="Clicou no vídeo" value={kpis.clicouVideo} />
      <Row icon={Hourglass} label="Assistiu 15min" value={kpis.min15} />
      <Row icon={Hourglass} label="Assistiu 30min" value={kpis.min30} />
      <Row icon={Hourglass} label="Assistiu 45min" value={kpis.min45} />
      <Row icon={Hourglass} label="Assistiu 60min" value={kpis.min60} />
      <Row icon={Target} label="Estava no pitch" value={kpis.pitch} />
      <Row icon={DollarSign} label="Estava na oferta" value={kpis.oferta} />
      <Row icon={CheckCircle2} label="Clicou no botão de oferta" value={kpis.cliqueOferta} />
      <Row icon={MessageSquare} label="Interagiu no chat (geral)" value={kpis.chat} />
    </div>
  );
}
