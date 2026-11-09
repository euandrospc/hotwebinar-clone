"use client";
import { useEffect, useState, useTransition } from "react";
import styles from "@/components/wizard/wizard.module.css";
import { toast } from "sonner";
import { Copy, RefreshCw, Webhook } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { regenerateWebinarSalesWebhookSecret } from "@/server/actions/settings";

interface Props {
  webinarId: string;
  initialSecret: string | null;
}

export function SalesWebhookCard({ webinarId, initialSecret }: Props) {
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const [secret, setSecret] = useState(initialSecret);
  const [pending, startTransition] = useTransition();
  const [showSecret, setShowSecret] = useState(false);

  const url = `${origin}/api/webhooks/sale/${webinarId}`;

  function copy(value: string, label: string) {
    void navigator.clipboard.writeText(value).then(() => toast.success(`${label} copiado`));
  }

  function regen() {
    startTransition(async () => {
      const r = await regenerateWebinarSalesWebhookSecret(webinarId);
      if ("error" in r) {
        toast.error("Falha ao gerar chave");
        return;
      }
      setSecret(r.secret);
      setShowSecret(true);
      toast.success("Nova chave gerada");
    });
  }

  const masked = secret ? `${secret.slice(0, 8)}${"•".repeat(20)}${secret.slice(-4)}` : "";

  return (
    <section className={`${styles.singleForm} space-y-4`}>
      <header className="flex items-start gap-3">
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-primary/10 bg-primary/5 text-primary">
          <Webhook className="h-4 w-4" />
        </span>
        <div>
          <h2 className="text-[13px] font-semibold">Webhook de vendas</h2>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            Gateway externo POSTa vendas aqui. Faturamento + total no dashboard atualizam automaticamente.
          </p>
        </div>
      </header>

      <div className="space-y-1">
        <label className="text-xs font-medium">URL</label>
        <div className="flex min-w-0 flex-wrap gap-2">
          <code className="min-w-0 flex-1 truncate rounded-lg border bg-muted/30 px-2.5 py-2 font-mono text-[11px]">{url}</code>
          <Button type="button" variant="outline" size="sm" aria-label="Copiar URL do webhook" className="h-[34px] rounded-lg" onClick={() => copy(url, "URL")}>
            <Copy className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium">Chave secreta (header <code>x-webhook-secret</code>)</label>
        {secret ? (
          <div className="flex min-w-0 flex-wrap gap-2">
            <code className="min-w-0 flex-1 truncate rounded-lg border bg-muted/30 px-2.5 py-2 font-mono text-[11px]">
              {showSecret ? secret : masked}
            </code>
            <Button type="button" variant="outline" size="sm" className="h-[34px] rounded-lg text-xs" onClick={() => setShowSecret((v) => !v)}>
              {showSecret ? "Ocultar" : "Ver"}
            </Button>
            <Button type="button" variant="outline" size="sm" aria-label="Copiar chave secreta" className="h-[34px] rounded-lg" onClick={() => copy(secret, "Chave")}>
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">Nenhuma chave gerada ainda.</p>
        )}
      </div>

      <Button type="button" variant="outline" className="h-[34px] rounded-lg text-xs" onClick={regen} disabled={pending}>
        <RefreshCw className="mr-2 h-3.5 w-3.5" />
        {pending ? "Gerando..." : secret ? "Gerar nova chave" : "Gerar chave"}
      </Button>

      <details className="rounded-lg border border-border/70 bg-muted/20 p-3 text-[11px]">
        <summary className="cursor-pointer font-medium">Exemplo de payload</summary>
        <pre className="mt-2 overflow-x-auto rounded bg-background p-2 font-mono text-[10px]">{`POST ${url}
x-webhook-secret: <chave>
content-type: application/json

{
  "externalId": "tx-12345",
  "amount": 29700,
  "currency": "BRL",
  "buyerEmail": "comprador@example.com",
  "buyerName": "João",
  "productName": "Curso A",
  "source": "kirvano"
}`}</pre>
        <p className="mt-2 text-muted-foreground">
          <strong>amount</strong> em centavos. <strong>externalId</strong> idempotente — mesmo id retorna 409.
          Cada webinar tem URL própria — vendas ficam atribuídas automaticamente.
        </p>
      </details>
    </section>
  );
}
