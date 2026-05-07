"use client";
import { useRef, useState, useTransition } from "react";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Upload } from "lucide-react";
import { step6Schema, type Step6Input } from "@/lib/validations/webinar";
import { updateWebinarStep6 } from "@/server/actions/webinar";
import { Button } from "@/components/ui/button";
import { AiStubSection } from "@/components/wizard/ai-stub-section";
import { WizardSectionAccordion } from "@/components/wizard/wizard-section-accordion";
import { ChatPreviewAside } from "@/components/wizard/chat-preview-aside";
import { WizardNav } from "@/components/wizard/wizard-nav";

export interface Step6FormProps {
  webinarId: string;
  slug: string | null;
  initial: Step6Input;
}

export function Step6Form({ webinarId, slug, initial }: Step6FormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [xlsxUploading, setXlsxUploading] = useState(false);
  const xlsxInputRef = useRef<HTMLInputElement>(null);
  const { handleSubmit, control, setValue } = useForm<Step6Input>({
    resolver: zodResolver(step6Schema),
    defaultValues: initial
  });
  const { fields, append, remove } = useFieldArray({ control, name: "messages" });
  const watched = useWatch({ control, name: "messages" }) ?? [];

  function onSubmit(values: Step6Input) {
    startTransition(async () => {
      const r = await updateWebinarStep6(webinarId, values);
      if ("ok" in r) {
        toast.success("Chat salvo");
        router.push(`/dashboard/webinars/${webinarId}/step-7`);
      } else {
        toast.error(r.error.message);
      }
    });
  }

  async function onXlsxFile(file: File) {
    setXlsxUploading(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch(`/api/webinars/${webinarId}/messages/import`, { method: "POST", body: fd });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.message ?? "Falha ao importar XLSX");
        return;
      }
      const { messages } = (await res.json()) as { messages: Array<{ authorName: string; text: string; showAtSec: number; isOwner: boolean }> };
      for (const m of messages) append(m);
      toast.success(`${messages.length} mensagens importadas`);
    } finally {
      setXlsxUploading(false);
      if (xlsxInputRef.current) xlsxInputRef.current.value = "";
    }
  }

  function updateRow(idx: number, patch: Partial<{ authorName: string; text: string; showAtSec: number; isOwner: boolean }>) {
    if (patch.authorName !== undefined) setValue(`messages.${idx}.authorName`, patch.authorName, { shouldDirty: true });
    if (patch.text !== undefined) setValue(`messages.${idx}.text`, patch.text, { shouldDirty: true });
    if (patch.showAtSec !== undefined) setValue(`messages.${idx}.showAtSec`, patch.showAtSec, { shouldDirty: true });
    if (patch.isOwner !== undefined) setValue(`messages.${idx}.isOwner`, patch.isOwner, { shouldDirty: true });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-6 lg:grid-cols-[1fr_minmax(0,420px)]">
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Chat scriptado</h2>

        <WizardSectionAccordion
          ai={
            <AiStubSection
              badge="Novidade"
              title="Automação Inteligente de Chat"
              description="Use IA para gerar mensagens automáticas e simular engajamento no chat do seu webinar."
              cta="Gerar Chat com IA"
            />
          }
          fileTitle="Crie o chat via arquivo"
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
                Colunas: Hora | Minuto | Segundo | Nome | Texto | Suporte
              </p>
            </div>
          }
          individualTitle="Crie o chat individualmente"
          individualSection={
            <div className="space-y-2 py-2">
              <p className="text-xs text-muted-foreground">{fields.length} mensagens. Edite na prévia ao lado.</p>
              <Button
                type="button"
                variant="outline"
                onClick={() => append({ authorName: "", text: "", showAtSec: 0, isOwner: false })}
              >
                <Plus className="mr-2 h-4 w-4" /> Adicionar mensagem
              </Button>
            </div>
          }
        />

        <WizardNav webinarId={webinarId} step={6} submitting={pending} />
      </div>

      <ChatPreviewAside
        webinarId={webinarId}
        slug={slug}
        messages={watched.map((m) => ({
          id: m?.id,
          authorName: m?.authorName ?? "",
          text: m?.text ?? "",
          showAtSec: m?.showAtSec ?? 0,
          isOwner: m?.isOwner ?? false
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
