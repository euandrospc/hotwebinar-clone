import { Database, Download, Upload, Globe, DollarSign } from "@/components/icons";
import { AdminPage, AdminPageHeader, AdminEmptyState } from "@/components/admin/admin-page";
import styles from "@/components/management-v2.module.css";
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
    <AdminPage>
      <AdminPageHeader title="Consumo" description="Armazenamento, tráfego e custo dos seus vídeos." />
      {usage && <p className={styles.meta}>Cloudflare R2 · {usage.bucket} · {usage.from} a {usage.to}</p>}

      {!usage && !error ? (
        <section className={styles.surface}>
          <AdminEmptyState icon={<Database />} title="Conecte os dados de consumo" description="O consumo de vídeos aparece aqui quando a conexão com a Cloudflare estiver configurada." />
          <details className={styles.note}><summary className="cursor-pointer font-medium">Configuração da conexão</summary><p className="mt-2">Configure <code>CLOUDFLARE_API_TOKEN</code> (permissão Account Analytics: Read) e <code>CLOUDFLARE_ACCOUNT_ID</code> nas variáveis do app para ver o consumo.</p></details>
        </section>
      ) : null}
      {error ? (
        <p role="alert" className="rounded-xl border border-destructive/20 bg-card p-5 text-xs leading-relaxed text-destructive">
          Não foi possível ler o consumo: {error}
        </p>
      ) : null}

      {usage ? (
        <>
          <div className={styles.usageGrid}>
            <Card featured Icon={DollarSign} label="Custo estimado do mês" value={usd.format(usage.costUsd.total)}
              hint={`armazenamento ${usd.format(usage.costUsd.storage)} · leituras ${usd.format(usage.costUsd.classB)} · escritas ${usd.format(usage.costUsd.classA)}`} />
            <Card Icon={Database} label="Armazenamento" value={gb(usage.storageBytes)}
              hint={`${num.format(usage.objectCount)} arquivos · ${R2_PRICING.freeStorageGb} GB grátis`} />
            <Card Icon={Download} label="Leituras (Classe B)" value={num.format(usage.classB)}
              hint={pct(usage.classB, R2_PRICING.freeClassB)} />
            <Card Icon={Upload} label="Escritas (Classe A)" value={num.format(usage.classA)}
              hint={pct(usage.classA, R2_PRICING.freeClassA)} />
            <Card Icon={Globe} label="Tráfego entregue" value={gb(usage.egressBytes)} hint="egress do R2 é grátis" />
          </div>
          <p className={styles.note}>
            Estimativa com os preços públicos do R2 (US$ {R2_PRICING.storageGbMonth}/GB-mês, US${" "}
            {R2_PRICING.classBPerMillion}/milhão de leituras, US$ {R2_PRICING.classAPerMillion}/milhão de escritas),
            já descontando o plano grátis. O valor cobrado de fato está na fatura da Cloudflare. Dados com atraso de
            alguns minutos.
          </p>
        </>
      ) : null}
    </AdminPage>
  );
}

function Card({ Icon, label, value, hint, featured = false }: { Icon: typeof Database; label: string; value: string; hint: string; featured?: boolean }) {
  return (
    <section className={`${styles.surface} ${styles.usageCard} ${featured ? styles.usageHero : ""}`}>
      <h2><Icon aria-hidden="true" /><span>{label}</span></h2>
      <p className={styles.usageValue}>{value}</p>
      <p className={styles.usageHint}>{hint}</p>
    </section>
  );
}
