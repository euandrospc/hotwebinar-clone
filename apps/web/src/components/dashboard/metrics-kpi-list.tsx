import styles from "@/components/webinar/webinar-operations.module.css";
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
  LogOut,
  Info,
  ArrowUpRight,
  type AppIcon
} from "@/components/icons";
import type { WebinarKpis } from "@/lib/dashboard-stats";

const fmt = new Intl.NumberFormat("pt-BR");

function Row({
  icon: Icon,
  label,
  value,
  href
}: {
  icon: AppIcon;
  label: string;
  value: number;
  href?: string;
}) {
  const inner = (
    <>
      <span className={styles.kpiIcon}>
        <Icon className="h-4 w-4" />
      </span>
      <span className="flex min-w-0 flex-1 items-center gap-1 text-xs">
        {label}
        {href ? <ArrowUpRight className="h-3 w-3 text-muted-foreground" /> : null}
      </span>
      <span className={styles.kpiValue}>{fmt.format(value)}</span>
    </>
  );
  const cls = styles.kpiRow;
  return href ? (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

export function MetricsKpiList({ kpis, webinarId }: { kpis: WebinarKpis; webinarId: string }) {
  return (
    <div className={styles.kpiList}>
      <Row icon={Lock} label="Visitas" value={kpis.visitas} />
      <Row icon={LogIn} label="Acessou o webinar" value={kpis.acessou} />
      <Row icon={MousePointerClick} label="Clicou no vídeo" value={kpis.clicouVideo} />
      <Row icon={Hourglass} label="Assistiu 15min" value={kpis.min15} />
      <Row icon={Hourglass} label="Assistiu 30min" value={kpis.min30} />
      <Row icon={Hourglass} label="Assistiu 45min" value={kpis.min45} />
      <Row icon={Hourglass} label="Assistiu 60min" value={kpis.min60} />
      <Row icon={Target} label="Estava no pitch" value={kpis.pitch} />
      <Row icon={LogOut} label="Saiu antes do pitch" value={kpis.saiuAntesPitch} />
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
