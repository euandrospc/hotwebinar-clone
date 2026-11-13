"use client";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { ChevronDown, Copy, RefreshCw, Webhook } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { regenerateWebinarSalesWebhookSecret } from "@/server/actions/settings";

interface Props {
  webinarId: string;
  initialSecret: string | null;
}

const box = "flex min-h-[42px] min-w-0 flex-1 items-center rounded-[10px] border border-[#1E241F] bg-[#070807] px-3.5 py-2 font-mono text-xs text-neutral-100";
const outline = "h-[42px] shrink-0 rounded-[10px] border-[#1E241F] bg-transparent text-[13px] font-bold text-neutral-100 hover:bg-white/5 hover:text-neutral-100";
const label = "text-[13px] font-semibold text-[#C9D1CA]";

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

  const masked = secret ? `${secret.slice(0, 8)}${"•".repeat(16)}${secret.slice(-4)}` : "";

  return (
    <section className="flex min-w-0 flex-col gap-4 rounded-2xl border border-[#1E241F] bg-[#0C0E0C] p-[22px] font-palco">
      <header className="flex items-start gap-3">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[#1A1F1B] text-palco">
          <Webhook className="h-[17px] w-[17px]" />
        </span>
        <div className="flex flex-col gap-1">
          <h2 className="text-[15px] font-semibold text-neutral-100">Webhook de vendas</h2>
          <p className="text-xs leading-relaxed text-neutral-400">
            O gateway externo envia vendas para cá. Faturamento e total no dashboard atualizam automaticamente.
          </p>
        </div>
      </header>

      <div className="flex flex-col gap-2">
        <span className={label}>URL</span>
        <div className="flex min-w-0 gap-2">
          <code className={`${box} break-all`}>{url}</code>
          <Button type="button" variant="outline" aria-label="Copiar URL do webhook" className={`${outline} w-[42px] px-0`} onClick={() => copy(url, "URL")}>
            <Copy className="h-[15px] w-[15px]" />
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className={label}>Chave secreta (header x-webhook-secret)</span>
        {secret ? (
          <div className="flex min-w-0 gap-2">
            <code className={`${box} truncate`}>{showSecret ? secret : masked}</code>
            <Button type="button" variant="outline" className={`${outline} px-3.5`} onClick={() => setShowSecret((v) => !v)}>
              {showSecret ? "Ocultar" : "Ver"}
            </Button>
            <Button type="button" variant="outline" aria-label="Copiar chave secreta" className={`${outline} w-[42px] px-0`} onClick={() => copy(secret, "Chave")}>
              <Copy className="h-[15px] w-[15px]" />
            </Button>
          </div>
        ) : (
          <p className="text-xs text-[#7C867E]">Nenhuma chave gerada ainda.</p>
        )}
      </div>

      <Button type="button" variant="outline" className={`${outline} h-[38px] self-start px-3.5`} onClick={regen} disabled={pending}>
        <RefreshCw className="h-[15px] w-[15px]" />
        {pending ? "Gerando..." : secret ? "Gerar nova chave" : "Gerar chave"}
      </Button>

      <details open className="group overflow-hidden rounded-xl border border-[#1E241F] bg-[#070807]">
        <summary className="flex cursor-pointer list-none items-center gap-2 border-[#1A1F1B] px-3.5 py-3 text-[13px] font-semibold text-neutral-100 group-open:border-b focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-palco/60 [&::-webkit-details-marker]:hidden">
          <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 -rotate-90 text-neutral-400 transition-transform group-open:rotate-0 motion-reduce:transition-none" />
          Exemplo de payload
        </summary>
        <div className="p-3.5">
          <pre className="overflow-x-auto font-mono text-xs leading-[1.6] text-neutral-400">{`POST ${url}
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
          <p className="mt-3 text-[11px] leading-relaxed text-[#7C867E]">
            <strong className="text-neutral-400">amount</strong> em centavos. <strong className="text-neutral-400">externalId</strong> idempotente — mesmo id retorna 409.
            Cada webinar tem URL própria — vendas ficam atribuídas automaticamente.
          </p>
        </div>
      </details>
    </section>
  );
}
