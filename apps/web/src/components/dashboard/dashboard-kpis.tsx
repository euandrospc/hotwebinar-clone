import { Receipt, Users } from "@/components/icons";
import type { SalesKpis } from "@/lib/dashboard-stats";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const fmt = new Intl.NumberFormat("pt-BR");

interface Props {
  sales: SalesKpis;
}

function centsToBRL(cents: number): string {
  return brl.format(cents / 100);
}

export function DashboardKpis({ sales }: Props) {
  return (
    <section aria-labelledby="revenue-title" className="relative flex h-full min-h-[320px] flex-col overflow-hidden rounded-2xl bg-[#064e3b] p-6 text-white sm:p-8">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(190,242,100,0.65),transparent_55%)]" />
      <div className="relative">
        <div className="flex items-center justify-between gap-3">
          <h2 id="revenue-title" className="text-base font-medium">Faturamento</h2>
          <span className="rounded-full border border-white/20 px-2.5 py-1 text-[10px] font-medium tracking-wide text-white/80">NO PERÍODO</span>
        </div>
        <p className="mt-5 break-words text-[clamp(2rem,3.2vw,4rem)] font-medium leading-tight tracking-[-0.045em] tabular-nums">{centsToBRL(sales.totalRevenueCents)}</p>
        <p className="mt-3 text-sm text-emerald-50/75">Receita atribuída aos seus webinars</p>
      </div>
      <div className="relative mt-auto grid grid-cols-2 gap-5 border-t border-white/15 pt-6">
        <div>
          <p className="flex items-center gap-2 text-xs text-emerald-50/75"><Receipt className="h-4 w-4" /> Vendas</p>
          <p className="mt-2 text-2xl font-medium tabular-nums">{fmt.format(sales.totalSales)}</p>
        </div>
        <div>
          <p className="flex items-center gap-2 text-xs text-emerald-50/75"><Users className="h-4 w-4" /> Receita por comprador</p>
          <p className="mt-2 text-2xl font-medium tabular-nums">{sales.uniqueBuyers > 0 ? centsToBRL(sales.revenuePerUserCents) : "—"}</p>
        </div>
      </div>
    </section>
  );
}
