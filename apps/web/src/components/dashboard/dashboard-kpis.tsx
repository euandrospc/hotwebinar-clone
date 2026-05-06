import { DollarSign, Receipt, Users, Clock } from "lucide-react";

interface Props {
  avgMinutes: number;
}

export function DashboardKpis({ avgMinutes }: Props) {
  const stubs = [
    { label: "Faturamento", Icon: DollarSign },
    { label: "Total de vendas", Icon: Receipt },
    { label: "Receita por usuário", Icon: Users }
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stubs.map(({ label, Icon }) => (
        <div key={label} className="rounded-lg border bg-card p-5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <Icon className="h-3.5 w-3.5" />
            </span>
            <span className="font-medium">{label}</span>
          </div>
          <p className="mt-6 text-xs">
            <span className="font-semibold text-destructive">⚡ Firepay</span>{" "}
            <span className="text-muted-foreground">Assine para obter dados completos.</span>
          </p>
        </div>
      ))}

      <div className="rounded-lg border bg-card p-5">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <Clock className="h-3.5 w-3.5" />
          </span>
          <span className="font-medium">Tempo médio por sessão</span>
        </div>
        <p className="mt-4 text-3xl font-semibold tabular-nums">{avgMinutes} minutos</p>
      </div>
    </div>
  );
}
