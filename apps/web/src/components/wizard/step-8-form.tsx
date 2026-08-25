"use client";
import { useTransition } from "react";
import { useForm, Controller, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { step8Schema, type Step8Input } from "@/lib/validations/webinar";
import { updateWebinarStep8 } from "@/server/actions/webinar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { AudienceChart } from "@/components/wizard/audience-chart";
import { WizardNav } from "@/components/wizard/wizard-nav";

export interface Step8FormProps {
  webinarId: string;
  durationSec: number;
  seed: string;
  initial: Step8Input;
}

export function Step8Form({ webinarId, durationSec, seed, initial }: Step8FormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const form = useForm<Step8Input>({
    resolver: zodResolver(step8Schema),
    defaultValues: initial
  });
  const { register, handleSubmit, control, formState: { errors } } = form;
  const watched = useWatch({ control });

  function onSubmit(values: Step8Input) {
    startTransition(async () => {
      const r = await updateWebinarStep8(webinarId, values);
      if ("ok" in r) {
        toast.success("Audiência salva");
        router.push(`/dashboard/webinars/${webinarId}/integrations`);
      } else {
        toast.error(r.error.message);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-6 lg:grid-cols-[1fr_minmax(0,420px)]">
      <div className="space-y-6">
        <h2 className="text-2xl font-semibold">Audiência</h2>

        <section className="space-y-3 rounded-lg border bg-card p-4">
          <Label>Modo</Label>
          <Controller
            control={control}
            name="audienceMode"
            render={({ field }) => (
              <RadioGroup
                value={field.value}
                onValueChange={(v) => field.onChange(v)}
                className="grid gap-3"
              >
                {([
                  ["NONE", "Não exibir", "Player não mostra contador de audiência."],
                  ["FIXED", "Audiência fixa", "Mostra um número fixo durante todo o webinar."],
                  ["DYNAMIC", "Audiência dinâmica", "Contador varia ao longo do tempo seguindo curva natural."]
                ] as const).map(([value, label, desc]) => (
                  <label key={value} className="flex cursor-pointer items-start gap-3 rounded-md border p-3 hover:bg-accent/50">
                    <RadioGroupItem value={value} className="mt-1" />
                    <div>
                      <p className="text-sm font-medium">{label}</p>
                      <p className="text-xs text-muted-foreground">{desc}</p>
                    </div>
                  </label>
                ))}
              </RadioGroup>
            )}
          />
        </section>

        <section className="grid gap-4 rounded-lg border bg-card p-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="audienceMin">Mínimo de participantes</Label>
            <Input
              id="audienceMin"
              type="number"
              min={0}
              {...register("audienceMin", { valueAsNumber: true })}
            />
            {errors.audienceMin && <p className="text-xs text-destructive">{errors.audienceMin.message}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="audienceMax">Máximo de participantes</Label>
            <Input
              id="audienceMax"
              type="number"
              min={0}
              {...register("audienceMax", { valueAsNumber: true })}
            />
            {errors.audienceMax && <p className="text-xs text-destructive">{errors.audienceMax.message}</p>}
          </div>
        </section>

        <section className="rounded-lg border bg-card p-4">
          <Controller
            control={control}
            name="audienceLiveBadge"
            render={({ field }) => (
              <label className="flex items-center gap-3">
                <Switch checked={Boolean(field.value)} onCheckedChange={field.onChange} aria-label="Botão ao vivo" />
                <div>
                  <p className="text-sm font-medium">Exibir botão "AO VIVO"</p>
                  <p className="text-xs text-muted-foreground">Mostra ponto vermelho pulsante + "AO VIVO" ao lado do contador.</p>
                </div>
              </label>
            )}
          />
        </section>

        <WizardNav webinarId={webinarId} step={8} submitting={pending} />
      </div>

      <aside className="space-y-3 lg:sticky lg:top-6 lg:h-fit">
        <h3 className="text-sm font-medium text-muted-foreground">Prévia da curva</h3>
        <AudienceChart
          mode={(watched.audienceMode as "NONE" | "FIXED" | "DYNAMIC") ?? "NONE"}
          min={Number(watched.audienceMin ?? 0)}
          max={Number(watched.audienceMax ?? 0)}
          duration={durationSec}
          seed={seed}
        />
      </aside>
    </form>
  );
}
