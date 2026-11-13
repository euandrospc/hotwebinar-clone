"use client";
import { useRef, useState, useTransition } from "react";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Upload } from "@/components/icons";
import { step6Schema, type Step6Input } from "@/lib/validations/webinar";
import { updateWebinarStep6 } from "@/server/actions/webinar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AiStubSection } from "@/components/wizard/ai-stub-section";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { palcoButtonOutline, palcoCard, palcoInput, palcoLabel, palcoTitle } from "./palco-fields";
import { ChatPreviewAside } from "@/components/wizard/chat-preview-aside";
import { WizardNav } from "@/components/wizard/wizard-nav";

export interface Step6FormProps {
  webinarId: string;
  slug: string | null;
  initial: Step6Input;
  aiReady: boolean;
}

export function Step6Form({ webinarId, slug, initial, aiReady }: Step6FormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [xlsxUploading, setXlsxUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const xlsxInputRef = useRef<HTMLInputElement>(null);
  const { handleSubmit, control, setValue, register } = useForm<Step6Input>({
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

  async function generateWithAi() {
    setGenerating(true);
    try {
      const res = await fetch(`/api/webinars/${webinarId}/messages/generate`, { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as { messages?: Array<{ authorName: string; text: string; showAtSec: number; isOwner: boolean }>; message?: string };
      if (!res.ok || !body.messages) {
        toast.error(body.message ?? "Falha ao gerar chat com IA");
        return;
      }
      // Appended for review only: nothing is saved until "Continuar".
      append(body.messages);
      toast.success(`${body.messages.length} mensagens geradas. Revise e clique em Continuar para salvar.`);
    } catch {
      toast.error("Falha ao gerar chat com IA");
    } finally {
      setGenerating(false);
    }
  }

  function updateRow(idx: number, patch: Partial<{ authorName: string; text: string; showAtSec: number; isOwner: boolean }>) {
    if (patch.authorName !== undefined) setValue(`messages.${idx}.authorName`, patch.authorName, { shouldDirty: true });
    if (patch.text !== undefined) setValue(`messages.${idx}.text`, patch.text, { shouldDirty: true });
    if (patch.showAtSec !== undefined) setValue(`messages.${idx}.showAtSec`, patch.showAtSec, { shouldDirty: true });
    if (patch.isOwner !== undefined) setValue(`messages.${idx}.isOwner`, patch.isOwner, { shouldDirty: true });
  }

  const trigger = "h-[52px] px-4 py-0 text-sm font-semibold text-neutral-100 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-palco/60 [&>svg]:text-[#7C867E] motion-reduce:[&>svg]:transition-none";

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_440px]">
      <div className={palcoCard}>
        <h2 className={palcoTitle}>Chat scriptado</h2>

        <div className="flex flex-col gap-2">
          <Label htmlFor="teamChatName" className={palcoLabel}>Nome exibido nas respostas do time</Label>
          <Input id="teamChatName" className={palcoInput} placeholder="Suporte" {...register("teamChatName")} />
        </div>

        <AiStubSection
          badge="Novidade"
          title="Automação inteligente de chat"
          description="Use IA para gerar mensagens automáticas e simular engajamento no chat do seu webinar."
          cta="Gerar chat com IA"
          onGenerate={aiReady ? generateWithAi : undefined}
          generating={generating}
          generatingLabel="Gerando chat..."
          disabledReason="Configure a integração de IA"
        />

        <Accordion type="single" collapsible className="overflow-hidden rounded-xl border border-[#1E241F]">
          <AccordionItem value="file" className="border-[#1E241F]">
            <AccordionTrigger className={trigger}>Criar o chat via arquivo</AccordionTrigger>
            <AccordionContent className="px-4">
              <div className="flex flex-col items-center gap-2 py-2">
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
                <button type="button" className={palcoButtonOutline} disabled={xlsxUploading} onClick={() => xlsxInputRef.current?.click()}>
                  <Upload aria-hidden />
                  {xlsxUploading ? "Importando..." : "Importar planilha XLSX"}
                </button>
                <p className="text-xs text-[#7C867E]">
                  Colunas: Hora | Minuto | Segundo | Nome | Texto | Suporte
                </p>
              </div>
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="individual" className="border-b-0">
            <AccordionTrigger className={trigger}>Criar o chat individualmente</AccordionTrigger>
            <AccordionContent className="px-4">
              <div className="flex flex-col items-start gap-2 py-2">
                <p className="text-xs text-[#7C867E]">{fields.length} {fields.length === 1 ? "mensagem" : "mensagens"}. Edite na prévia ao lado.</p>
                <button
                  type="button"
                  className={palcoButtonOutline}
                  onClick={() => append({ authorName: "", text: "", showAtSec: 0, isOwner: false })}
                >
                  <Plus aria-hidden /> Adicionar mensagem
                </button>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

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
