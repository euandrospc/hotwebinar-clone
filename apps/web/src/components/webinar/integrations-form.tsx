"use client";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { integrationsSchema, type IntegrationsInput } from "@/lib/validations/webinar";
import { updateWebinarIntegrations } from "@/server/actions/webinar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

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
  { key: "webhookOnLeave", label: "Quando lead sair do webinar" }
];

export function IntegrationsForm({ webinarId, initial }: IntegrationsFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<IntegrationsInput>({
    resolver: zodResolver(integrationsSchema),
    defaultValues: initial
  });

  const watchPermanence = watch("webhookOnPermanence");

  function onSubmit(values: IntegrationsInput) {
    startTransition(async () => {
      const r = await updateWebinarIntegrations(webinarId, values);
      if ("ok" in r) {
        toast.success("Integrações salvas");
        router.refresh();
      } else {
        toast.error(r.error.message);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl space-y-6">
      <h2 className="text-2xl font-semibold">Integrações</h2>

      <div className="space-y-2">
        <Label htmlFor="webhookUrl">URL do webhook</Label>
        <Input id="webhookUrl" placeholder="https://..." {...register("webhookUrl")} />
        {errors.webhookUrl && <p className="text-sm text-destructive">{errors.webhookUrl.message}</p>}
      </div>

      <div className="space-y-3">
        <p className="text-sm font-medium">Disparar webhook quando:</p>
        {TRIGGERS.map((t) => (
          <label key={String(t.key)} className="flex items-center gap-3">
            <Switch
              checked={Boolean(watch(t.key as any))}
              onCheckedChange={(v) => setValue(t.key as any, v as never)}
            />
            <span className="text-sm">{t.label}</span>
          </label>
        ))}
      </div>

      {watchPermanence ? (
        <div className="space-y-2">
          <Label htmlFor="permanenceThresholdSec">Threshold de permanência (segundos)</Label>
          <Input
            id="permanenceThresholdSec"
            type="number"
            min={1}
            {...register("permanenceThresholdSec", { valueAsNumber: true })}
          />
          {errors.permanenceThresholdSec && (
            <p className="text-sm text-destructive">{errors.permanenceThresholdSec.message}</p>
          )}
        </div>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>{pending ? "Salvando..." : "Salvar"}</Button>
      </div>
    </form>
  );
}
