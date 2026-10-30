import { Database, Download, Upload, Globe, DollarSign } from "@/components/icons";
import { getR2Usage, R2_PRICING, type R2Usage } from "@/lib/cloudflare-usage";

export const dynamic = "force-dynamic";

const num = new Intl.NumberFormat("pt-BR");
const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
const gb = (bytes: number) => `${(bytes / 1024 ** 3).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} GB`;
const pct = (used: number, free: number) => `${Math.round((used / free) * 100)}% do grátis`;

export default async function ConsumoPage() {
  let usage: R2Usage | null = null;
  let error: string | null = null;
  try {
    usage = await getR2Usage();
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  return (
    <div className="container mx-auto py-10">
      <h1 className="text-3xl font-semibold">Consumo</h1>
      <p className="mt-2 text-muted-foreground">
        Cloudflare R2 (vídeos) no mês atual{usage ? ` · bucket ${usage.bucket} · ${usage.from} a ${usage.to}` : ""}.
      </p>

      {!usage && !error ? (
        <p className="mt-8 rounded-lg border bg-card p-6 text-sm text-muted-foreground">
          Configure <code>CLOUDFLARE_API_TOKEN</code> (permissão Account Analytics: Read) e{" "}
          <code>CLOUDFLARE_ACCOUNT_ID</code> nas variáveis do app para ver o consumo.
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-8 rounded-lg border border-destructive/40 bg-card p-6 text-sm text-destructive">
          Não foi possível ler o consumo: {error}
        </p>
      ) : null}

      {usage ? (
        <>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Card Icon={DollarSign} label="Custo estimado do mês" value={usd.format(usage.costUsd.total)}
              hint={`armazenamento ${usd.format(usage.costUsd.storage)} · leituras ${usd.format(usage.costUsd.classB)} · escritas ${usd.format(usage.costUsd.classA)}`} />
            <Card Icon={Database} label="Armazenamento" value={gb(usage.storageBytes)}
              hint={`${num.format(usage.objectCount)} arquivos · ${R2_PRICING.freeStorageGb} GB grátis`} />
            <Card Icon={Download} label="Leituras (Classe B)" value={num.format(usage.classB)}
              hint={pct(usage.classB, R2_PRICING.freeClassB)} />
            <Card Icon={Upload} label="Escritas (Classe A)" value={num.format(usage.classA)}
              hint={pct(usage.classA, R2_PRICING.freeClassA)} />
            <Card Icon={Globe} label="Tráfego entregue" value={gb(usage.egressBytes)} hint="egress do R2 é grátis" />
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Estimativa com os preços públicos do R2 (US$ {R2_PRICING.storageGbMonth}/GB-mês, US${" "}
            {R2_PRICING.classBPerMillion}/milhão de leituras, US$ {R2_PRICING.classAPerMillion}/milhão de escritas),
            já descontando o plano grátis. O valor cobrado de fato está na fatura da Cloudflare. Dados com atraso de
            alguns minutos.
          </p>
        </>
      ) : null}
    </div>
  );
}

function Card({ Icon, label, value, hint }: { Icon: typeof Database; label: string; value: string; hint: string }) {
  return (
    <div className="rounded-lg border bg-card p-5">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <Icon className="h-3.5 w-3.5" />
        </span>
        <span className="font-medium">{label}</span>
      </div>
      <p className="mt-4 text-3xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
