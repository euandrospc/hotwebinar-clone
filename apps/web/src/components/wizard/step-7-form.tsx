"use client";
import { useRef, useState, useTransition } from "react";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Upload } from "lucide-react";
import { step7Schema, type Step7Input } from "@/lib/validations/webinar";
import { updateWebinarStep7 } from "@/server/actions/webinar";
import { Button } from "@/components/ui/button";
import { AiStubSection } from "@/components/wizard/ai-stub-section";
import { WizardSectionAccordion } from "@/components/wizard/wizard-section-accordion";
import { SalesPreviewAside } from "@/components/wizard/sales-preview-aside";
import { WizardNav } from "@/components/wizard/wizard-nav";

export interface Step7FormProps {
  webinarId: string;
  slug: string | null;
  initial: Step7Input;
}

export function Step7Form({ webinarId, slug, initial }: Step7FormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [xlsxUploading, setXlsxUploading] = useState(false);
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
      const { notifications } = (await res.json()) as { notifications: Array<{ showAtSec: number; buyerName: string; productName: string; price: string | null }> };
      for (const n of notifications) append(n);
      toast.success(`${notifications.length} vendas importadas`);
    } finally {
      setXlsxUploading(false);
      if (xlsxInputRef.current) xlsxInputRef.current.value = "";
    }
  }

  function updateRow(idx: number, patch: Partial<{ buyerName: string; productName: string; showAtSec: number; price: string | null }>) {
    if (patch.buyerName !== undefined) setValue(`notifications.${idx}.buyerName`, patch.buyerName, { shouldDirty: true });
    if (patch.productName !== undefined) setValue(`notifications.${idx}.productName`, patch.productName, { shouldDirty: true });
    if (patch.showAtSec !== undefined) setValue(`notifications.${idx}.showAtSec`, patch.showAtSec, { shouldDirty: true });
    if (patch.price !== undefined) setValue(`notifications.${idx}.price`, patch.price, { shouldDirty: true });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Vendas</h2>

        <WizardSectionAccordion
          ai={
            <AiStubSection
              badge="Novidade"
              title="Automação Inteligente de Vendas"
              description="Use IA para gerar notificações de venda realistas automaticamente."
              cta="Gerar Vendas com IA"
            />
          }
          fileTitle="Crie as vendas via arquivo"
          fileSection={
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
              >
                <Upload className="mr-2 h-4 w-4" />
                {xlsxUploading ? "Importando..." : "Importar planilha XLSX"}
              </Button>
              <p className="text-xs text-muted-foreground">
                Colunas: Hora | Minuto | Segundo | Texto enviado<br />
                ou: Hora | Minuto | Segundo | Nome | Produto | Preço
              </p>
            </div>
          }
          individualTitle="Crie as vendas individualmente"
          individualSection={
            <div className="space-y-2 py-2">
              <p className="text-xs text-muted-foreground">{fields.length} vendas. Edite na prévia ao lado.</p>
              <Button
                type="button"
                variant="outline"
                onClick={() => append({ showAtSec: 0, buyerName: "", productName: "", price: null })}
              >
                <Plus className="mr-2 h-4 w-4" /> Adicionar venda
              </Button>
            </div>
          }
        />

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
