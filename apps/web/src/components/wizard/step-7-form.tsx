"use client";
import { useRef, useState, useTransition } from "react";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Sparkles, Upload } from "@/components/icons";
import { step7Schema, type Step7Input } from "@/lib/validations/webinar";
import { updateWebinarStep7 } from "@/server/actions/webinar";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { SalesPreviewAside } from "@/components/wizard/sales-preview-aside";
import { WizardNav } from "@/components/wizard/wizard-nav";

const accordionTrigger = "h-[52px] px-4 py-0 text-sm font-semibold text-neutral-100 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-palco/60 [&>svg]:text-[#7C867E]";
const outlineButton = "h-[38px] rounded-[10px] border-[#1E241F] bg-transparent px-3.5 text-[13px] font-bold text-neutral-100 hover:bg-white/5 hover:text-neutral-100";

type SaleRow = { showAtSec: number; buyerName: string; productName: string; price: string | null };

export interface Step7FormProps {
  webinarId: string;
  slug: string | null;
  initial: Step7Input;
  aiReady: boolean;
}

export function Step7Form({ webinarId, slug, initial, aiReady }: Step7FormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [xlsxUploading, setXlsxUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const xlsxInputRef = useRef<HTMLInputElement>(null);
  const { handleSubmit, control, setValue } = useForm<Step7Input>({
    resolver: zodResolver(step7Schema),
    defaultValues: initial
  });
  const { fields, append, remove } = useFieldArray({ control, name: "notifications" });
  const watched = useWatch({ control, name: "notifications" }) ?? [];

  function onSubmit(values: Step7Input) {
    startTransition(async () => {
      const r = await updateWebinarStep7(webinarId, values);
      if ("ok" in r) {
        toast.success("Vendas salvas");
        router.push(`/dashboard/webinars/${webinarId}/step-8`);
      } else {
        toast.error(r.error.message);
      }
    });
  }

  function onInvalid() {
    toast.error("Cada venda precisa de um nome de comprador. Preencha ou remova as vendas em branco.");
  }

  async function onXlsxFile(file: File) {
    setXlsxUploading(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch(`/api/webinars/${webinarId}/sales/import`, { method: "POST", body: fd });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.message ?? "Falha ao importar XLSX");
        return;
      }
      const { notifications } = (await res.json()) as { notifications: SaleRow[] };
      for (const n of notifications) append(n);
      toast.success(`${notifications.length} vendas importadas`);
    } finally {
      setXlsxUploading(false);
      if (xlsxInputRef.current) xlsxInputRef.current.value = "";
    }
  }

  // Appends to the form only; the user reviews and saves with "Continuar".
  async function generateWithAi() {
    setGenerating(true);
    try {
      const res = await fetch(`/api/webinars/${webinarId}/sales/generate`, { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as { notifications?: SaleRow[]; message?: string };
      if (!res.ok || !body.notifications) {
        toast.error(body.message ?? "Falha ao gerar vendas com IA");
        return;
      }
      for (const n of body.notifications) append(n);
      toast.success(`${body.notifications.length} vendas geradas. Revise e clique em Continuar para salvar.`);
    } finally {
      setGenerating(false);
    }
  }

  function updateRow(idx: number, patch: Partial<{ buyerName: string; productName: string; showAtSec: number; price: string | null }>) {
    if (patch.buyerName !== undefined) setValue(`notifications.${idx}.buyerName`, patch.buyerName, { shouldDirty: true });
    if (patch.productName !== undefined) setValue(`notifications.${idx}.productName`, patch.productName, { shouldDirty: true });
    if (patch.showAtSec !== undefined) setValue(`notifications.${idx}.showAtSec`, patch.showAtSec, { shouldDirty: true });
    if (patch.price !== undefined) setValue(`notifications.${idx}.price`, patch.price, { shouldDirty: true });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="grid min-w-0 items-start gap-5 font-palco xl:grid-cols-[minmax(0,1fr)_440px]">
      <div className="flex min-w-0 flex-col gap-[18px] rounded-2xl border border-[#1E241F] bg-[#0C0E0C] p-6">
        <h2 className="text-lg font-semibold text-neutral-100">Vendas</h2>

        <section className="flex flex-col gap-2 rounded-xl border border-palco/20 bg-palco/[0.04] p-4">
          <span className="self-start rounded-md bg-palco/[0.12] px-2 py-[3px] text-[11px] font-bold text-palco">Novidade</span>
          <h3 className="text-[15px] font-semibold text-neutral-100">Automação inteligente de vendas</h3>
          <p className="text-[13px] text-neutral-400">Use IA para gerar notificações de venda realistas automaticamente.</p>
          {aiReady ? (
            <Button type="button" onClick={generateWithAi} disabled={generating} className="mt-1 h-10 w-full rounded-[10px] bg-palco text-[13px] font-bold text-palco-ink hover:bg-palco/90">
              <Sparkles className={`h-[15px] w-[15px] ${generating ? "motion-safe:animate-pulse" : ""}`} /> {generating ? "Gerando vendas..." : "Gerar vendas com IA"}
            </Button>
          ) : (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span tabIndex={0} className="mt-1 block rounded-[10px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-palco/60">
                    <Button type="button" disabled aria-describedby="sales-ai-unavailable" className="h-10 w-full rounded-[10px] bg-palco text-[13px] font-bold text-palco-ink hover:bg-palco/90">
                      <Sparkles className="h-[15px] w-[15px]" /> Gerar vendas com IA
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent id="sales-ai-unavailable">Configure a integração de IA</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </section>

        <Accordion type="single" collapsible className="rounded-xl border border-[#1E241F]">
          <AccordionItem value="file" className="border-b border-[#1E241F]">
            <AccordionTrigger className={accordionTrigger}>Criar as vendas via arquivo</AccordionTrigger>
            <AccordionContent className="px-4">
              <div className="flex flex-col items-center gap-2 py-2 text-sm">
                <input
                  ref={xlsxInputRef}
                  type="file"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void onXlsxFile(f);
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={xlsxUploading}
                  onClick={() => xlsxInputRef.current?.click()}
                  className={outlineButton}
                >
                  <Upload className="h-[15px] w-[15px]" />
                  {xlsxUploading ? "Importando..." : "Importar planilha XLSX"}
                </Button>
                <p className="text-center text-xs text-neutral-500">
                  Colunas: Hora | Minuto | Segundo | Texto enviado<br />
                  ou: Hora | Minuto | Segundo | Nome | Produto | Preço
                </p>
              </div>
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="individual" className="border-b-0">
            <AccordionTrigger className={accordionTrigger}>Criar as vendas individualmente</AccordionTrigger>
            <AccordionContent className="px-4">
              <div className="space-y-2 py-2">
                <p className="text-xs text-neutral-500">{fields.length} vendas. Edite na prévia ao lado.</p>
                <Button
                  type="button"
                  variant="outline"
                  className={outlineButton}
                  onClick={() => append({ showAtSec: 0, buyerName: "", productName: "", price: null })}
                >
                  <Plus className="h-[15px] w-[15px]" /> Adicionar venda
                </Button>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <WizardNav webinarId={webinarId} step={7} submitting={pending} />
      </div>

      <SalesPreviewAside
        webinarId={webinarId}
        slug={slug}
        notifications={watched.map((n) => ({
          id: n?.id,
          buyerName: n?.buyerName ?? "",
          productName: n?.productName ?? "",
          showAtSec: n?.showAtSec ?? 0,
          price: n?.price ?? null
        }))}
        onUpdate={updateRow}
        onDelete={remove}
        onDeleteAll={() => {
          for (let i = fields.length - 1; i >= 0; i--) remove(i);
        }}
      />
    </form>
  );
}
