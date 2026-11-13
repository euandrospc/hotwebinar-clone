"use client";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { integrationsSchema, type IntegrationsInput } from "@/lib/validations/webinar";
import { updateWebinarIntegrations, publishWebinar } from "@/server/actions/webinar";
import { Clock, Globe, Send } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

const labelClass = "text-[13px] font-semibold text-[#C9D1CA]";
const iconClass = "pointer-events-none absolute left-3.5 top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-[#7C867E]";
const inputClass = "h-[42px] rounded-[10px] border-[#1E241F] bg-[#070807] pl-10 text-sm text-neutral-100 placeholder:text-[#6E776F] focus-visible:ring-palco/50 focus-visible:ring-offset-0 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";
const switchClass = "h-5 w-[34px] shrink-0 data-[state=checked]:bg-palco data-[state=unchecked]:bg-[#2A322C] focus-visible:ring-palco/60 focus-visible:ring-offset-0";

export interface IntegrationsFormProps {
  webinarId: string;
  initial: IntegrationsInput;
}

const TRIGGERS: ReadonlyArray<{ key: keyof IntegrationsInput; label: string }> = [
  { key: "webhookOnOptin", label: "Ao captar lead novo" },
  { key: "webhookOnEnter", label: "Quando lead acessar o webinar" },
  { key: "webhookOnOfferView", label: "Quando lead vir a oferta" },
  { key: "webhookOnOfferClick", label: "Quando lead clicar na oferta" },
  { key: "webhookOnRaffleEntry", label: "Quando lead entrar no sorteio" },
  { key: "webhookOnPitchReached", label: "Quando lead vir o pitch" },
  { key: "webhookOnPermanence", label: "Quando lead permanecer (threshold abaixo)" },
  { key: "webhookOnLeave", label: "Quando lead sair do webinar" },
  { key: "webhookOnSale", label: "Quando lead comprar" }
];

export function IntegrationsForm({ webinarId, initial }: IntegrationsFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<IntegrationsInput>({
    resolver: zodResolver(integrationsSchema),
    defaultValues: initial
  });

  const watchPermanence = watch("webhookOnPermanence");

  function submit(values: IntegrationsInput, publish: boolean) {
    startTransition(async () => {
      const r1 = await updateWebinarIntegrations(webinarId, values);
      if (!("ok" in r1)) {
        toast.error(r1.error.message);
        return;
      }
      if (!publish) {
        toast.success("Integrações salvas");
        return;
      }
      const r2 = await publishWebinar(webinarId);
      if ("ok" in r2) {
        toast.success("Webinar publicado");
        router.push("/dashboard/webinars");
      } else {
        toast.error(r2.error.message);
      }
    });
  }

  const onSave = handleSubmit((v) => submit(v, false));
  const onPublish = handleSubmit((v) => submit(v, true));

  return (
    <form onSubmit={onSave} className="flex min-w-0 flex-col gap-[18px] rounded-2xl border border-[#1E241F] bg-[#0C0E0C] p-6 font-palco">
      <h2 className="text-lg font-semibold text-neutral-100">Integrações</h2>

      <div className="flex flex-col gap-2">
        <Label htmlFor="webhookUrl" className={labelClass}>URL do webhook</Label>
        <div className="relative">
          <Globe aria-hidden="true" className={iconClass} />
          <Input id="webhookUrl" placeholder="https://..." {...register("webhookUrl")} className={`${inputClass} text-[13px]`} />
        </div>
        {errors.webhookUrl && <p className="text-sm text-destructive">{errors.webhookUrl.message}</p>}
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className={`${labelClass} mb-3`}>Disparar webhook quando</legend>
        {TRIGGERS.map((t) => (
          <label key={String(t.key)} className="flex cursor-pointer items-center gap-2.5">
            <Switch
              checked={Boolean(watch(t.key as any))}
              onCheckedChange={(v) => setValue(t.key as any, v as never)}
              className={switchClass}
            />
            <span className="text-sm text-[#E4E9E5]">{t.label}</span>
          </label>
        ))}
      </fieldset>

      {watchPermanence ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="permanenceThresholdSec" className={labelClass}>Threshold de permanência (segundos)</Label>
          <div className="relative">
            <Clock aria-hidden="true" className={iconClass} />
            <Input
              id="permanenceThresholdSec"
              type="number"
              min={1}
              {...register("permanenceThresholdSec", { valueAsNumber: true })}
              className={inputClass}
            />
          </div>
          {errors.permanenceThresholdSec && (
            <p className="text-sm text-destructive">{errors.permanenceThresholdSec.message}</p>
          )}
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-3 border-t border-[#1A1F1B] pt-[18px]">
        <Button type="submit" variant="outline" disabled={pending} className="h-[38px] rounded-[10px] border-[#1E241F] bg-transparent px-3.5 text-[13px] font-bold text-neutral-100 hover:bg-white/5 hover:text-neutral-100">
          {pending ? "Salvando..." : "Salvar"}
        </Button>
        <Button type="button" onClick={onPublish} disabled={pending} className="h-[38px] rounded-[10px] bg-palco px-3.5 text-[13px] font-bold text-palco-ink hover:bg-palco/90">
          <Send className="h-[15px] w-[15px]" />
          {pending ? "Salvando..." : "Salvar e publicar"}
        </Button>
      </div>
    </form>
  );
}
