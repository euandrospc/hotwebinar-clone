import type { Metadata } from "next";
import Link from "next/link";
import type { ComponentType, SVGProps } from "react";
import {
  Calendar, CheckCircle2, ChevronDown, Database, DollarSign, Download, Globe, Info, TrendingUp, Upload
} from "@/components/icons";
import { AdminPage, AdminPageHeader, AdminEmptyState } from "@/components/admin/admin-page";
import { getR2Usage, projectR2Month, R2_PRICING, type R2Usage } from "@/lib/cloudflare-usage";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Consumo" };

export const dynamic = "force-dynamic";

// Typical per-GB egress price of providers that charge for it, used only for the savings comparison.
const EGRESS_COMPARISON_USD_PER_GB = 0.09;
const MONTH_OPTIONS = 3;
// Tallest bar height inside the 150px chart, leaving room for the value label above it.
const BAR_MAX_PX = 130;

const GB = 1024 ** 3;
const num = new Intl.NumberFormat("pt-BR");
const compact = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 0 });
const usd = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
const usdWhole = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const dec = (n: number, d = 2) => n.toLocaleString("pt-BR", { maximumFractionDigits: d });
const price = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 3 });
const monthShort = (y: number, m: number) =>
  new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("pt-BR", { month: "short", timeZone: "UTC" }).replace(".", "");
const ymd = (s: string) => s.split("-").map(Number) as [number, number, number];

function monthOptions(now: Date) {
  return Array.from({ length: MONTH_OPTIONS }, (_, i) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const y = d.getUTCFullYear(), m = d.getUTCMonth() + 1;
    return { value: `${y}-${String(m).padStart(2, "0")}`, label: d.toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }) };
  });
}

export default async function ConsumoPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const now = new Date();
  const options = monthOptions(now);
  const { mes } = await searchParams;
  const month = options.find((o) => o.value === mes)?.value ?? options[0].value;

  let usage: R2Usage | null = null;
  let error: string | null = null;
  try {
    usage = await getR2Usage(now, month);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  const [y, m] = month.split("-").map(Number);
  const mon = monthShort(y, m);
  const lastDay = month === options[0].value ? now.getUTCDate() : new Date(Date.UTC(y, m, 0)).getUTCDate();
  const periodLabel = `1 – ${lastDay} ${mon}, ${y}`;
  const bucket = usage?.bucket ?? process.env.R2_BUCKET ?? "hotwebinar-hls";

  return (
    <AdminPage className="font-palco md:!gap-7 md:[&>header]:items-end">
      <AdminPageHeader
        title="Consumo"
        description={<span className="text-sm text-neutral-400">Armazenamento, tráfego e custo dos seus vídeos.</span>}
        actions={<>
          <span className="inline-flex h-10 items-center gap-2 rounded-[10px] border border-[#1E241F] px-3 text-[13px] font-medium text-[#C9D1CA]">
            <Database aria-hidden="true" className="size-[15px] text-[#F6A23C]" />Cloudflare R2 · {bucket}
          </span>
          <details key={month} className="group relative">
            <summary className="inline-flex h-10 cursor-pointer list-none items-center gap-2 rounded-[10px] border border-[#1E241F] bg-[#0F130F] px-3 text-[13px] font-semibold text-neutral-100 outline-none focus-visible:ring-2 focus-visible:ring-palco [&::-webkit-details-marker]:hidden">
              <Calendar aria-hidden="true" className="size-[15px] text-neutral-400" />
              <span><span className="sr-only">Período: </span>{periodLabel}</span>
              <ChevronDown aria-hidden="true" className="size-3.5 text-neutral-500 transition-transform group-open:rotate-180 motion-reduce:transition-none" />
            </summary>
            <ul className="absolute right-0 z-20 mt-2 min-w-48 rounded-xl border border-[#1E241F] bg-[#0C0E0C] p-1 shadow-xl">
              {options.map((o, i) => (
                <li key={o.value}>
                  <Link
                    href={i === 0 ? "/dashboard/consumo" : `/dashboard/consumo?mes=${o.value}`}
                    aria-current={o.value === month ? "true" : undefined}
                    className="block rounded-lg px-3 py-2 text-[13px] capitalize text-neutral-400 hover:bg-[#121512] hover:text-neutral-100 focus-visible:bg-[#121512] focus-visible:text-neutral-100 focus-visible:outline-none aria-[current]:font-semibold aria-[current]:text-palco"
                  >
                    {o.label}
                  </Link>
                </li>
              ))}
            </ul>
          </details>
        </>}
      />

      {!usage && !error ? (
        <section className="rounded-2xl border border-[#1E241F] bg-[#0C0E0C] p-6">
          <AdminEmptyState icon={<Database />} title="Consumo indisponível" description="Os números de armazenamento, leituras e tráfego aparecem aqui quando a conexão com a Cloudflare estiver configurada." />
          <details className="mt-4 text-xs leading-relaxed text-neutral-500">
            <summary className="cursor-pointer font-medium text-neutral-400">Configuração da conexão</summary>
            <p className="mt-2">Configure <code>CLOUDFLARE_API_TOKEN</code> (permissão Account Analytics: Read) e <code>CLOUDFLARE_ACCOUNT_ID</code> nas variáveis do app para ver o consumo.</p>
          </details>
        </section>
      ) : null}
      {error ? (
        <p role="alert" className="rounded-2xl border border-red-500/20 bg-[#0C0E0C] p-5 text-xs leading-relaxed text-red-400">
          Não foi possível ler o consumo: {error}
        </p>
      ) : null}

      {usage ? <UsageView usage={usage} mon={mon} /> : null}
    </AdminPage>
  );
}

function UsageView({ usage, mon }: { usage: R2Usage; mon: string }) {
  const proj = projectR2Month(usage);
  const cost = usage.costUsd;
  const withinFree = cost.total === 0;
  const storageGb = usage.storageBytes / GB;
  const egressGb = usage.egressBytes / GB;
  const readsOver = proj.classB > R2_PRICING.freeClassB;

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-[400px_minmax(0,1fr)]">
        <section className="flex flex-col rounded-2xl border border-palco/25 bg-gradient-to-br from-[#1E6B47] to-[#0E3826] p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-neutral-100">Custo estimado do mês</h2>
            <DollarSign aria-hidden="true" className="size-[18px] text-neutral-100/80" />
          </div>
          <p className="mt-3.5 text-[44px] font-bold leading-[1.1] tracking-tight text-neutral-100 tabular-nums">{usd.format(cost.total)}</p>
          <p className={cn("mt-2.5 inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold",
            withinFree ? "bg-palco text-palco-ink" : "bg-[#F5B742] text-palco-ink")}>
            <CheckCircle2 aria-hidden="true" className="size-[13px]" />
            {withinFree ? "Tudo dentro do plano grátis" : "Acima do plano grátis"}
          </p>
          <div className="min-h-6 flex-1" />
          <dl className="grid grid-cols-3 gap-2 border-t border-neutral-100/15 py-4">
            {([["Armazenamento", cost.storage], ["Leituras", cost.classB], ["Escritas", cost.classA]] as const).map(([label, v]) => (
              <div key={label} className="flex flex-col gap-1">
                <dt className="text-xs text-neutral-100/70">{label}</dt>
                <dd className="text-base font-bold text-neutral-100 tabular-nums">{usd.format(v)}</dd>
              </div>
            ))}
          </dl>
          <p className="flex items-center gap-2 rounded-[10px] bg-palco-ink/35 px-3 py-2.5 text-[13px]">
            <TrendingUp aria-hidden="true" className="size-3.5 text-[#F5B742]" />
            <span className="flex-1 text-neutral-100/80">{proj.complete ? `Total de ${mon}` : `Projeção até ${usage.daysInMonth} ${mon}`}</span>
            <span className="font-bold text-[#F5B742] tabular-nums">{proj.complete ? usd.format(cost.total) : `≈ ${usd.format(proj.costUsd.total)}`}</span>
          </p>
        </section>

        <section className="flex flex-col gap-[22px] rounded-2xl border border-[#1E241F] bg-[#0C0E0C] p-6">
          <div className="flex flex-col gap-1">
            <h2 className="text-base font-semibold text-neutral-100">Plano grátis do R2</h2>
            <p className="text-[13px] text-neutral-500">Quanto já foi usado neste mês · renova todo dia 1º</p>
          </div>
          <Meter Icon={Database} name="Armazenamento" value={`${dec(storageGb)} GB`} of={`de ${R2_PRICING.freeStorageGb} GB`}
            used={storageGb / R2_PRICING.freeStorageGb}
            sub={`${num.format(usage.objectCount)} arquivos · depois US$ ${price(R2_PRICING.storageGbMonth)} por GB-mês`} />
          <Meter Icon={Download} name="Leituras (Classe B)" value={num.format(usage.classB)} of="de 10 milhões"
            used={usage.classB / R2_PRICING.freeClassB} projected={proj.complete ? undefined : proj.classB / R2_PRICING.freeClassB}
            warn={readsOver}
            sub={proj.classBLimitDay && !proj.complete
              ? `No ritmo atual passa do limite por volta de ${proj.classBLimitDay} ${mon} · depois US$ ${price(R2_PRICING.classBPerMillion)} por milhão`
              : usage.classB > R2_PRICING.freeClassB
                ? `Limite do grátis ultrapassado · US$ ${price(R2_PRICING.classBPerMillion)} por milhão acima dele`
                : `Cada pessoa assistindo gera leituras · depois US$ ${price(R2_PRICING.classBPerMillion)} por milhão`} />
          <Meter Icon={Upload} name="Escritas (Classe A)" value={num.format(usage.classA)} of="de 1 milhão"
            used={usage.classA / R2_PRICING.freeClassA} projected={proj.complete ? undefined : proj.classA / R2_PRICING.freeClassA}
            warn={proj.classA > R2_PRICING.freeClassA}
            sub={`Sobe quando você envia vídeos · depois US$ ${price(R2_PRICING.classAPerMillion)} por milhão`} />
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        <DailyReads usage={usage} mon={mon} />

        <section className="flex flex-col gap-4 rounded-2xl border border-[#1E241F] bg-[#0C0E0C] p-6">
          <div className="flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-[#C9D1CA]">
              <Globe aria-hidden="true" className="size-[15px] text-neutral-500" />Tráfego entregue
            </h2>
            <span className="rounded-full bg-palco/10 px-2.5 py-[3px] text-[11px] font-bold text-palco">Grátis no R2</span>
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-[34px] font-bold leading-[1.1] tracking-[-0.5px] text-neutral-100 tabular-nums">{dec(egressGb)} GB</p>
            <p className="text-[13px] text-neutral-500">≈ {dec(egressGb / 1024, 1)} TB de vídeo enviados ao público</p>
          </div>
          <div className="min-h-4 flex-1" />
          <div className="flex flex-col gap-1.5 rounded-xl border border-palco/20 bg-palco/5 p-4">
            <p className="text-xs text-neutral-400">Economia com egress zero</p>
            <p className="text-xl font-bold text-palco tabular-nums">≈ {usdWhole.format(egressGb * EGRESS_COMPARISON_USD_PER_GB)} no período</p>
            <p className="text-xs leading-relaxed text-neutral-500">Comparado a provedores que cobram US$ {price(EGRESS_COMPARISON_USD_PER_GB)} por GB entregue.</p>
          </div>
        </section>
      </div>

      <p className="flex gap-2.5 px-1 text-xs leading-relaxed text-neutral-500">
        <Info aria-hidden="true" className="mt-px size-3.5 shrink-0 text-[#6E776F]" />
        Estimativa com os preços públicos do R2, já descontando o plano grátis. O valor cobrado de fato está na fatura da Cloudflare. Dados com atraso de alguns minutos.
      </p>
    </>
  );
}

function Meter({ Icon, name, value, of, used, projected, warn = false, sub }: {
  Icon: ComponentType<SVGProps<SVGSVGElement>>; name: string; value: string; of: string;
  used: number; projected?: number; warn?: boolean; sub: string;
}) {
  const usedPct = Math.min(100, used * 100);
  const projPct = warn && projected ? Math.min(100, projected * 100) : usedPct;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1 leading-tight">
        <span className="flex items-center gap-2 text-[13px] font-semibold text-[#C9D1CA]">
          <Icon aria-hidden="true" className="size-[15px] self-center text-neutral-500" />{name}
        </span>
        <span className="flex items-end gap-1.5">
          <span className="text-[15px] font-bold text-neutral-100 tabular-nums">{value}</span>
          <span className="text-xs text-neutral-500">{of}</span>
          <span className={cn("text-xs font-bold tabular-nums", warn || used >= 0.8 ? "text-[#F5B742]" : "text-palco")}>{Math.round(used * 100)}%</span>
        </span>
      </div>
      <div role="meter" aria-label={name} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(usedPct)}
        className="relative h-2 overflow-hidden rounded-full bg-[#1A1F1B]">
        {projPct > usedPct && <div className="absolute inset-y-0 left-0 bg-[#F5B742]/25" style={{ width: `${projPct}%` }} />}
        <div className="absolute inset-y-0 left-0 bg-palco" style={{ width: `${usedPct}%` }} />
      </div>
      <p className={cn("text-xs", warn ? "text-[#F5B742]/80" : "text-neutral-500")}>{sub}</p>
    </div>
  );
}

function DailyReads({ usage, mon }: { usage: R2Usage; mon: string }) {
  const pace = R2_PRICING.freeClassB / usage.daysInMonth;
  const days = usage.daily;
  const max = Math.max(pace, ...days.map((d) => d.classB)) * 1.1 || 1;
  const recent = days.slice(-7);
  const avg = recent.reduce((s, d) => s + d.classB, 0) / (recent.length || 1);
  const lastIndex = days.length - 1;

  return (
    <section className="flex min-w-0 flex-col gap-[18px] rounded-2xl border border-[#1E241F] bg-[#0C0E0C] p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold text-neutral-100">Leituras por dia</h2>
          <p className="text-[13px] text-neutral-500">Cada pessoa assistindo gera leituras dos pedaços do vídeo</p>
        </div>
        <div className="flex items-center gap-3.5 text-xs text-neutral-400">
          <span className="flex items-center gap-1.5"><span aria-hidden="true" className="size-2.5 rounded-[2px] bg-palco" />Leituras</span>
          <span className="flex items-center gap-1.5"><span aria-hidden="true" className="h-0.5 w-3.5 rounded-[2px] bg-[#F5B742]" />Ritmo do grátis ({compact.format(pace)}/dia)</span>
        </div>
      </div>

      <div className="flex flex-col gap-2" role="img"
        aria-label={`Leituras por dia em ${mon}: ${days.map((d) => `dia ${ymd(d.date)[2]}, ${num.format(d.classB)}`).join("; ")}. Ritmo do grátis: ${num.format(Math.round(pace))} por dia.`}>
        <div className="relative flex h-[150px] items-end gap-1 sm:gap-2.5" aria-hidden="true">
          {days.map((d, i) => (
            <div key={d.date} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5" title={`${ymd(d.date)[2]} ${mon}: ${num.format(d.classB)} leituras`}>
              {i === lastIndex && <span className="whitespace-nowrap text-[11px] font-bold text-palco">{compact.format(d.classB)}</span>}
              <div className={cn("w-full rounded-t-[4px] rounded-b-[1px]", i === lastIndex ? "bg-palco" : "bg-palco/35")}
                style={{ height: `${(d.classB / max) * BAR_MAX_PX}px` }} />
            </div>
          ))}
          <div className="pointer-events-none absolute inset-x-0 h-0.5 bg-[#F5B742]/70" style={{ bottom: `${(pace / max) * BAR_MAX_PX - 1}px` }} />
        </div>
        <div className="flex gap-1 sm:gap-2.5" aria-hidden="true">
          {days.map((d, i) => (
            <span key={d.date} className={cn("min-w-0 flex-1 text-center text-[11px] tabular-nums",
              i === lastIndex ? "font-bold text-neutral-100" : "text-[#6E776F]",
              days.length > 16 && i % 2 === 1 && i !== lastIndex && "invisible sm:visible")}>
              {ymd(d.date)[2]}
            </span>
          ))}
        </div>
      </div>

      <p className="text-[13px] text-[#C9D1CA]">
        Média dos últimos {recent.length} dias: {compact.format(avg)} leituras/dia, {avg > pace ? "acima do ritmo que cabe no grátis" : "dentro do ritmo que cabe no grátis"}.
      </p>
    </section>
  );
}

