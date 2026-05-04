"use client";
import { useTransition } from "react";
import { useForm, Controller, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { step5Schema, type Step5Input } from "@/lib/validations/webinar";
import { updateWebinarStep5 } from "@/server/actions/webinar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SecondsInput } from "@/components/ui/seconds-input";
import { WizardNav } from "@/components/wizard/wizard-nav";

export interface Step5FormProps {
  webinarId: string;
  initial: Step5Input;
}

export function Step5Form({ webinarId, initial }: Step5FormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    control,
    formState: { errors }
  } = useForm<Step5Input>({
    resolver: zodResolver(step5Schema),
    defaultValues: initial
  });
  const { fields, append, remove } = useFieldArray({ control, name: "ctas" });

  function onSubmit(values: Step5Input) {
    startTransition(async () => {
      const res = await updateWebinarStep5(webinarId, values);
      if ("ok" in res) {
        router.push(`/dashboard/webinars/${webinarId}/step-6`);
      } else {
        toast.error(res.error.message);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <h2 className="text-2xl font-semibold">Oferta (CTAs)</h2>

      <div className="space-y-3">
        {fields.map((f, i) => (
          <div key={f.id} className="grid grid-cols-12 items-end gap-2 rounded-md border p-3">
            <div className="col-span-3 space-y-1">
              <Label htmlFor={`ctas.${i}.label`}>Label</Label>
              <Input id={`ctas.${i}.label`} {...register(`ctas.${i}.label` as const)} />
              {errors.ctas?.[i]?.label && <p className="text-xs text-destructive">{errors.ctas[i]?.label?.message}</p>}
            </div>
            <div className="col-span-4 space-y-1">
              <Label htmlFor={`ctas.${i}.url`}>URL</Label>
              <Input id={`ctas.${i}.url`} {...register(`ctas.${i}.url` as const)} />
              {errors.ctas?.[i]?.url && <p className="text-xs text-destructive">{errors.ctas[i]?.url?.message}</p>}
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Mostrar</Label>
              <Controller
                control={control}
                name={`ctas.${i}.showAtSec` as const}
                render={({ field }) => <SecondsInput value={field.value} onChange={field.onChange} aria-label="Mostrar" />}
              />
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Ocultar</Label>
              <Controller
                control={control}
                name={`ctas.${i}.hideAtSec` as const}
                render={({ field }) => <SecondsInput value={field.value} onChange={field.onChange} aria-label="Ocultar" />}
              />
            </div>
            <div className="col-span-1">
              <Button type="button" variant="ghost" size="icon" onClick={() => remove(i)} aria-label="Remover">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={() => append({ label: "", url: "", showAtSec: 0 })}
      >
        <Plus className="mr-2 h-4 w-4" /> Adicionar CTA
      </Button>

      <WizardNav webinarId={webinarId} step={5} submitting={pending} />
    </form>
  );
}
