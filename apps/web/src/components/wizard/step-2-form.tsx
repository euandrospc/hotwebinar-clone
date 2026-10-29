"use client";
import { useTransition } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { step2Schema, type Step2Input } from "@/lib/validations/webinar";
import { updateWebinarStep2 } from "@/server/actions/webinar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { WizardNav } from "@/components/wizard/wizard-nav";
import { TimezoneSelect } from "@/components/wizard/timezone-select";
import { WaitingTemplatePicker } from "@/components/wizard/waiting-template-picker";

// Index = JS getDay() (0 = domingo).
const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const;

export interface Step2FormProps {
  webinarId: string;
  initial: Step2Input;
}

export function Step2Form({ webinarId, initial }: Step2FormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
    setError,
    watch
  } = useForm<Step2Input>({
    resolver: zodResolver(step2Schema),
    defaultValues: initial
  });

  const mode = watch("mode");
  const recurring = watch("recurring");

  function onSubmit(values: Step2Input) {
    startTransition(async () => {
      const res = await updateWebinarStep2(webinarId, values);
      if ("ok" in res) {
        router.push(`/dashboard/webinars/${webinarId}/step-3`);
      } else if (res.error.field) {
        setError(res.error.field as keyof Step2Input, { message: res.error.message });
      } else {
        toast.error(res.error.message);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-3xl space-y-6">
      <h2 className="text-2xl font-semibold">Webinar</h2>

      <Controller
        control={control}
        name="mode"
        render={({ field }) => (
          <Tabs value={field.value} onValueChange={field.onChange}>
            <TabsList>
              <TabsTrigger value="UNICO">Webinar único</TabsTrigger>
              <TabsTrigger value="JIT">Just in time</TabsTrigger>
            </TabsList>
            <TabsContent value="UNICO" className="mt-4 text-sm text-muted-foreground">
              Um evento único, em uma data e horário específicos.
            </TabsContent>
            <TabsContent value="JIT" className="mt-4 text-sm text-muted-foreground">
              Vídeo passa em tempo real desde o horário de início. Quem chega depois vê o offset correspondente.
            </TabsContent>
          </Tabs>
        )}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Data e hora de início</Label>
          <Controller
            control={control}
            name="startDate"
            render={({ field }) => (
              <DateTimePicker value={field.value} onChange={field.onChange} ariaLabel="Início" />
            )}
          />
          {errors.startDate && <p className="text-sm text-destructive">{errors.startDate.message}</p>}
        </div>
        <div className="space-y-2">
          <Label>Data e hora de finalização</Label>
          <Controller
            control={control}
            name="endDate"
            render={({ field }) => (
              <DateTimePicker value={field.value} onChange={field.onChange} ariaLabel="Fim" />
            )}
          />
          {errors.endDate && <p className="text-sm text-destructive">{errors.endDate.message}</p>}
        </div>
      </div>

      {mode === "UNICO" ? (
        <div className="space-y-3">
          <Controller
            control={control}
            name="recurring"
            render={({ field }) => (
              <div className="flex items-start gap-3">
                <Checkbox
                  id="recurring"
                  checked={field.value}
                  onCheckedChange={(v) => field.onChange(v === true)}
                  className="mt-0.5"
                />
                <div className="space-y-1">
                  <Label htmlFor="recurring">Webinar recorrente</Label>
                  <p className="text-xs text-muted-foreground">
                    Repete no mesmo horário nos dias da semana escolhidos, a partir da data de início.
                  </p>
                </div>
              </div>
            )}
          />
          {recurring ? (
            <Controller
              control={control}
              name="recurringDays"
              render={({ field }) => (
                <div className="flex flex-wrap gap-2" role="group" aria-label="Dias da semana">
                  {WEEKDAYS.map((label, day) => {
                    const on = field.value.includes(day);
                    return (
                      <button
                        key={label}
                        type="button"
                        aria-pressed={on}
                        onClick={() =>
                          field.onChange(on ? field.value.filter((d) => d !== day) : [...field.value, day].sort())
                        }
                        className={`h-9 min-w-12 rounded-md border px-3 text-sm font-medium transition-colors ${
                          on ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-accent"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              )}
            />
          ) : null}
          {errors.recurringDays && <p className="text-sm text-destructive">{errors.recurringDays.message}</p>}
        </div>
      ) : null}

      <div className="space-y-2">
        <Label>Fuso horário</Label>
        <Controller
          control={control}
          name="timezone"
          render={({ field }) => (
            <TimezoneSelect value={field.value} onChange={field.onChange} />
          )}
        />
        {errors.timezone && <p className="text-sm text-destructive">{errors.timezone.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="waitingTitle">Título da sala de espera</Label>
        <Input id="waitingTitle" {...register("waitingTitle")} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="waitingSubtitle">Subtítulo da sala de espera</Label>
        <Input id="waitingSubtitle" {...register("waitingSubtitle")} />
      </div>

      <div className="space-y-2">
        <Label>Modelo da página de espera</Label>
        <Controller
          control={control}
          name="waitingTemplate"
          render={({ field }) => (
            <WaitingTemplatePicker value={field.value} onChange={field.onChange} />
          )}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="closedGroupUrl">Link do grupo (exibido após o encerramento)</Label>
        <Input id="closedGroupUrl" placeholder="https://chat.whatsapp.com/..." {...register("closedGroupUrl")} />
        <p className="text-xs text-muted-foreground">
          Aparece na página de webinar encerrado com um botão para entrar no grupo.
        </p>
      </div>

      <input type="hidden" value={mode} {...register("mode")} />

      <WizardNav webinarId={webinarId} step={2} submitting={pending} />
    </form>
  );
}
