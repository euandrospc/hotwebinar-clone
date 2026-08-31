import Link from "next/link";
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
  ArrowUpRight,
  type LucideIcon
} from "lucide-react";
import type { WebinarKpis } from "@/lib/dashboard-stats";

const fmt = new Intl.NumberFormat("pt-BR");

function Row({
  icon: Icon,
  label,
  value,
  href
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  href?: string;
}) {
  const inner = (
    <>
      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <Icon className="h-4 w-4" />
      </span>
      <span className="flex flex-1 items-center gap-1 text-sm">
        {label}
        {href ? <ArrowUpRight className="h-3 w-3 text-muted-foreground" /> : <Info className="h-3 w-3 text-muted-foreground" />}
      </span>
      <span className="text-lg font-semibold tabular-nums">{fmt.format(value)}</span>
    </>
  );
  const cls = "flex items-center gap-3 rounded-lg border bg-card px-4 py-3";
  return href ? (
    <Link href={href} className={`${cls} transition-colors hover:border-primary/50 hover:bg-accent`}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

export function MetricsKpiList({ kpis, webinarId }: { kpis: WebinarKpis; webinarId: string }) {
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
      <Row
        icon={CheckCircle2}
        label="Clicou no botão de oferta"
        value={kpis.cliqueOferta}
        href={`/dashboard/webinars/${webinarId}/leads?clicked=1`}
      />
      <Row icon={MessageSquare} label="Interagiu no chat (geral)" value={kpis.chat} />
    </div>
  );
}
