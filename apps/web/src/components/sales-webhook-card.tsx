"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Copy, RefreshCw, Webhook } from "lucide-react";
import { Button } from "@/components/ui/button";
import { regenerateSalesWebhookSecret } from "@/server/actions/settings";

export function SalesWebhookCard({ initialSecret }: { initialSecret: string | null }) {
  const [secret, setSecret] = useState(initialSecret);
  const [pending, startTransition] = useTransition();
  const [showSecret, setShowSecret] = useState(false);

  const url = typeof window !== "undefined"
    ? `${window.location.origin}/api/webhooks/sale`
    : "/api/webhooks/sale";

  function copy(value: string, label: string) {
    void navigator.clipboard.writeText(value).then(() => toast.success(`${label} copiado`));
  }

  function regen() {
    startTransition(async () => {
      const r = await regenerateSalesWebhookSecret();
      setSecret(r.secret);
      setShowSecret(true);
      toast.success("Nova chave gerada");
    });
  }

  const masked = secret ? `${secret.slice(0, 8)}${"•".repeat(20)}${secret.slice(-4)}` : "";

  return (
    <section className="max-w-2xl space-y-4 rounded-lg border bg-card p-5">
      <header className="flex items-center gap-2">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <Webhook className="h-4 w-4" />
        </span>
        <div>
          <h2 className="text-lg font-semibold">Webhook de vendas</h2>
          <p className="text-xs text-muted-foreground">
            Gateway externo POSTa vendas aqui. Faturamento + total no dashboard atualizam automaticamente.
          </p>
        </div>
      </header>

      <div className="space-y-1">
        <label className="text-xs font-medium">URL</label>
        <div className="flex gap-2">
          <code className="flex-1 truncate rounded-md border bg-muted/50 px-3 py-2 font-mono text-xs">{url}</code>
          <Button type="button" variant="outline" size="sm" onClick={() => copy(url, "URL")}>
            <Copy className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium">Chave secreta (header <code>x-webhook-secret</code>)</label>
        {secret ? (
          <div className="flex gap-2">
            <code className="flex-1 truncate rounded-md border bg-muted/50 px-3 py-2 font-mono text-xs">
              {showSecret ? secret : masked}
            </code>
            <Button type="button" variant="outline" size="sm" onClick={() => setShowSecret((v) => !v)}>
              {showSecret ? "Ocultar" : "Ver"}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => copy(secret, "Chave")}>
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Nenhuma chave gerada ainda.</p>
        )}
      </div>

      <Button type="button" variant="outline" onClick={regen} disabled={pending}>
        <RefreshCw className="mr-2 h-3.5 w-3.5" />
        {pending ? "Gerando..." : secret ? "Gerar nova chave" : "Gerar chave"}
      </Button>

      <details className="rounded-md border bg-muted/30 p-3 text-xs">
        <summary className="cursor-pointer font-medium">Exemplo de payload</summary>
        <pre className="mt-2 overflow-x-auto rounded bg-background p-2 font-mono text-[10px]">{`POST /api/webhooks/sale
x-webhook-secret: <chave>
content-type: application/json

{
  "externalId": "tx-12345",
  "amount": 29700,
  "currency": "BRL",
  "webinarSlug": "<slug>",
  "buyerEmail": "comprador@example.com",
  "buyerName": "João",
  "productName": "Curso A",
  "source": "kirvano"
}`}</pre>
        <p className="mt-2 text-muted-foreground">
          <strong>amount</strong> em centavos. <strong>externalId</strong> idempotente — mesmo id retorna 409.
        </p>
      </details>
    </section>
  );
}
