"use client";
import { useTransition } from "react";
import { useForm, Controller, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { step8Schema, type Step8Input } from "@/lib/validations/webinar";
import { updateWebinarStep8 } from "@/server/actions/webinar";
import { Users } from "@/components/icons";
import { simulateAudienceSeries, type AudienceMode } from "@/lib/audience-sim";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { AudienceChart } from "@/components/wizard/audience-chart";
import { WizardNav } from "@/components/wizard/wizard-nav";

const inputClass = "h-[42px] rounded-[10px] border-[#1E241F] bg-[#070807] pl-10 text-sm text-neutral-100 focus-visible:ring-palco/50 focus-visible:ring-offset-0 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

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

  const mode = (watched.audienceMode as AudienceMode | undefined) ?? "NONE";
  const min = Number(watched.audienceMin ?? 0);
  const max = Number(watched.audienceMax ?? 0);
  const fmt = (n: number) => (Number.isFinite(n) ? n.toLocaleString("pt-BR") : "—");
  // Same deterministic simulation the player uses, so the badge shows the counter's real peak for this config.
  const peak = mode === "NONE" ? null : Math.max(...simulateAudienceSeries(durationSec, min, max, seed, mode).map((p) => p.count));

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid min-w-0 items-start gap-5 font-palco xl:grid-cols-[minmax(0,1fr)_440px]">
      <div className="flex min-w-0 flex-col gap-[18px] rounded-2xl border border-[#1E241F] bg-[#0C0E0C] p-6">
        <h2 className="text-lg font-semibold text-neutral-100">Audiência</h2>

        <section className="flex flex-col gap-2.5">
          <p id="audience-mode-label" className="text-[13px] font-semibold text-[#C9D1CA]">Modo</p>
          <Controller
            control={control}
            name="audienceMode"
            render={({ field }) => (
              <RadioGroup
                value={field.value}
                onValueChange={(v) => field.onChange(v)}
                aria-labelledby="audience-mode-label"
                className="grid gap-2.5"
              >
                {([
                  ["NONE", "Não exibir", "O player não mostra contador de audiência."],
                  ["FIXED", "Audiência fixa", "Mostra um número fixo durante todo o webinar."],
                  ["DYNAMIC", "Audiência dinâmica", "O contador varia ao longo do tempo seguindo uma curva natural."]
                ] as const).map(([value, label, desc]) => (
                  <label
                    key={value}
                    className={`flex cursor-pointer items-center gap-3.5 rounded-xl border p-4 transition-colors motion-reduce:transition-none ${
                      field.value === value ? "border-palco/45 bg-palco/[0.06]" : "border-[#1E241F] hover:bg-white/[0.02]"
                    }`}
                  >
                    <RadioGroupItem
                      value={value}
                      className="h-[18px] w-[18px] shrink-0 border-[#3A423C] text-palco data-[state=checked]:border-palco focus-visible:ring-palco/60 focus-visible:ring-offset-0"
                    />
                    <span className="flex flex-col gap-[3px]">
                      <span className="text-sm font-semibold text-neutral-100">{label}</span>
                      <span className="text-xs text-neutral-400">{desc}</span>
                    </span>
                  </label>
                ))}
              </RadioGroup>
            )}
          />
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          {([
            ["audienceMin", "Mínimo de participantes"],
            ["audienceMax", "Máximo de participantes"]
          ] as const).map(([name, label]) => (
            <div key={name} className="flex flex-col gap-2">
              <Label htmlFor={name} className="text-[13px] font-semibold text-[#C9D1CA]">{label}</Label>
              <div className="relative">
                <Users aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-[#7C867E]" />
                <Input id={name} type="number" min={0} {...register(name, { valueAsNumber: true })} className={inputClass} />
              </div>
              {errors[name] && <p className="text-xs text-destructive">{errors[name]?.message}</p>}
            </div>
          ))}
        </section>

        <section className="rounded-xl border border-[#1E241F] p-4">
          <Controller
            control={control}
            name="audienceLiveBadge"
            render={({ field }) => (
              <label className="flex cursor-pointer flex-wrap items-center gap-3.5">
                <Switch
                  checked={Boolean(field.value)}
                  onCheckedChange={field.onChange}
                  aria-label="Exibir selo AO VIVO"
                  className="h-5 w-[34px] data-[state=checked]:bg-palco data-[state=unchecked]:bg-[#2A322C] focus-visible:ring-palco/60 focus-visible:ring-offset-0"
                />
                <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
                  <span className="text-sm font-semibold text-neutral-100">Exibir selo “AO VIVO”</span>
                  <span className="text-xs text-neutral-400">Mostra um ponto vermelho pulsante + “AO VIVO” ao lado do contador.</span>
                </span>
                {field.value && peak !== null && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#DC2626]/[0.12] px-2.5 py-1 text-[11px] font-bold text-[#FCA5A5]">
                    <span aria-hidden="true" className="h-[7px] w-[7px] rounded-full bg-[#EF4444] motion-safe:animate-pulse" />
                    AO VIVO · {fmt(peak)}
                  </span>
                )}
              </label>
            )}
          />
        </section>

        <WizardNav webinarId={webinarId} step={8} submitting={pending} />
      </div>

      <aside className="flex min-w-0 flex-col gap-3.5 rounded-2xl border border-[#1E241F] bg-[#0C0E0C] p-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-xs font-semibold text-[#7C867E]">Prévia da curva</h3>
          {mode !== "NONE" && <span className="text-xs font-semibold text-palco">{fmt(min)} → {fmt(max)}</span>}
        </div>
        <AudienceChart mode={mode} min={min} max={max} duration={durationSec} seed={seed} />
      </aside>
    </form>
  );
}
