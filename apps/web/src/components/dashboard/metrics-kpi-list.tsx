import Link from "next/link";
import {
  Lock,
  ArrowRight,
  Play,
  Hourglass,
  Target,
  DollarSign,
  MousePointerClick,
  MessageSquare,
  LogOut,
  ArrowUpRight,
  type AppIcon
} from "@/components/icons";
import type { WebinarKpis } from "@/lib/dashboard-stats";

const fmt = new Intl.NumberFormat("pt-BR");
const rowClass = "flex items-center gap-2.5 border-[#1A1F1B] py-[11px] [&+&]:border-t";

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
      <span className="flex size-[22px] shrink-0 items-center justify-center rounded-md bg-palco/[0.08] text-palco">
        <Icon aria-hidden="true" className="size-3" />
      </span>
      <span className="flex min-w-0 flex-1 items-center gap-1 text-xs text-[#C9D1CA]">
        {label}
        {href ? <ArrowUpRight aria-hidden="true" className="size-3 text-[#7C867E]" /> : null}
      </span>
      <span className="text-sm font-semibold tabular-nums text-neutral-100">{fmt.format(value)}</span>
    </>
  );
  return href ? (
    <Link href={href} className={`${rowClass} -mx-2 rounded-lg px-2 transition-colors hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-palco motion-reduce:transition-none`}>
      {inner}
    </Link>
  ) : (
    <div className={rowClass}>{inner}</div>
  );
}

export function MetricsKpiList({ kpis, webinarId }: { kpis: WebinarKpis; webinarId: string }) {
  return (
    <div className="flex flex-col rounded-2xl border border-[#1E241F] bg-[#0C0E0C] px-4 py-1.5 font-palco">
      <Row icon={Lock} label="Visitas" value={kpis.visitas} />
      <Row icon={ArrowRight} label="Acessou o webinar" value={kpis.acessou} />
      <Row icon={Play} label="Clicou no vídeo" value={kpis.clicouVideo} />
      <Row icon={Hourglass} label="Assistiu 15min" value={kpis.min15} />
      <Row icon={Hourglass} label="Assistiu 30min" value={kpis.min30} />
      <Row icon={Hourglass} label="Assistiu 45min" value={kpis.min45} />
      <Row icon={Hourglass} label="Assistiu 60min" value={kpis.min60} />
      <Row icon={Target} label="Estava no pitch" value={kpis.pitch} />
      <Row icon={LogOut} label="Saiu antes do pitch" value={kpis.saiuAntesPitch} />
      <Row icon={DollarSign} label="Estava na oferta" value={kpis.oferta} />
      <Row
        icon={MousePointerClick}
        label="Clicou no botão de oferta"
        value={kpis.cliqueOferta}
        href={`/dashboard/webinars/${webinarId}/leads?clicked=1`}
      />
      <Row icon={MessageSquare} label="Interagiu no chat (geral)" value={kpis.chat} />
    </div>
  );
}
