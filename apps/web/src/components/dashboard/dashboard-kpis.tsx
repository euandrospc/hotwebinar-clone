import { DollarSign, Receipt, Users, Clock } from "lucide-react";
import type { SalesKpis } from "@/lib/dashboard-stats";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const fmt = new Intl.NumberFormat("pt-BR");

interface Props {
  avgMinutes: number;
  sales: SalesKpis;
}

function centsToBRL(cents: number): string {
  return brl.format(cents / 100);
}

export function DashboardKpis({ avgMinutes, sales }: Props) {
  const cards = [
    { label: "Faturamento", Icon: DollarSign, value: centsToBRL(sales.totalRevenueCents) },
    { label: "Total de vendas", Icon: Receipt, value: fmt.format(sales.totalSales) },
    {
      label: "Receita por usuário",
      Icon: Users,
      value: sales.uniqueBuyers > 0 ? centsToBRL(sales.revenuePerUserCents) : "—"
    },
    { label: "Tempo médio por sessão", Icon: Clock, value: `${avgMinutes} minutos` }
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map(({ label, Icon, value }) => (
        <div key={label} className="rounded-lg border bg-card p-5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <Icon className="h-3.5 w-3.5" />
            </span>
            <span className="font-medium">{label}</span>
          </div>
          <p className="mt-4 text-3xl font-semibold tabular-nums">{value}</p>
        </div>
      ))}
    </div>
  );
}
