"use client";
import styles from "./wizard.module.css";
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
import { RecurringScheduleFields } from "@/components/wizard/recurring-schedule-fields";
import { WizardNav } from "@/components/wizard/wizard-nav";
import { TimezoneSelect } from "@/components/wizard/timezone-select";
import { WaitingTemplatePicker } from "@/components/wizard/waiting-template-picker";
import { ArrowUpRight, Globe } from "@/components/icons";

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
    setValue,
    watch
  } = useForm<Step2Input>({
    resolver: zodResolver(step2Schema),
    defaultValues: initial
  });

  const mode = watch("mode");
  const recurring = watch("recurring");
  const startDate = watch("startDate");
  const endDate = watch("endDate");
  const timezone = watch("timezone");

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
    <form onSubmit={handleSubmit(onSubmit)} className={styles.singleForm}>
      <h2 className={styles.title}>Webinar</h2>

      <Controller
        control={control}
        name="mode"
        render={({ field }) => (
          <Tabs value={field.value} onValueChange={field.onChange}>
            <TabsList>
              <TabsTrigger value="UNICO">Webinar agendado</TabsTrigger>
              <TabsTrigger value="JIT">Just in time</TabsTrigger>
            </TabsList>
            <TabsContent value="UNICO" className="mt-[18px] text-[13px] text-[#9AA39C]">
              Um evento com horário definido, único ou recorrente nos dias escolhidos.
            </TabsContent>
            <TabsContent value="JIT" className="mt-[18px] text-[13px] text-[#9AA39C]">
              Vídeo passa em tempo real desde o horário de início. Quem chega depois vê o offset correspondente.
            </TabsContent>
          </Tabs>
        )}
      />

      {mode === "UNICO" ? (
        <div className="space-y-2">
          <Controller
            control={control}
            name="recurring"
            render={({ field }) => (
              <div className="flex items-start gap-2.5">
                <Checkbox
                  id="recurring"
                  checked={field.value}
                  onCheckedChange={(v) => field.onChange(v === true)}
                  className="mt-px h-[18px] w-[18px] rounded-[5px] border-[#2E362F] data-[state=checked]:border-palco data-[state=checked]:bg-palco data-[state=checked]:text-palco-ink [&_svg]:h-3 [&_svg]:w-3"
                />
                <div className="space-y-1.5">
                  <Label htmlFor="recurring" className="!text-sm !text-[#F2F5F2]">Webinar recorrente</Label>
                  <p className="text-xs text-[#9AA39C]">
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
                <div className="flex flex-wrap gap-2 pl-7 pt-1.5" role="group" aria-label="Dias da semana">
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
                        className={`h-[34px] min-w-12 rounded-lg border px-2 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-palco motion-reduce:transition-none ${
                          on ? "border-palco/35 bg-palco/[0.12] text-palco" : "border-[#1E241F] text-[#7C867E] hover:text-[#C9D1CA]"
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
          {errors.recurringDays && <p className="pl-7 text-xs text-destructive">{errors.recurringDays.message}</p>}
        </div>
      ) : null}

      {mode === "UNICO" && recurring ? (
        <>
          <RecurringScheduleFields
            startDate={startDate}
            endDate={endDate}
            timezone={timezone}
            onChange={(schedule) => {
              setValue("startDate", schedule.startDate, { shouldDirty: true, shouldValidate: true });
              setValue("endDate", schedule.endDate, { shouldDirty: true, shouldValidate: true });
            }}
          />
          {errors.startDate && <p className="text-xs text-destructive">{errors.startDate.message}</p>}
          {errors.endDate && <p className="text-xs text-destructive">{errors.endDate.message}</p>}
        </>
      ) : (
        <div className={styles.fieldGrid}>
          <div className={styles.field}>
            <Label>Data e hora de início</Label>
            <Controller
              control={control}
              name="startDate"
              render={({ field }) => (
                <div className={styles.dateTimeField}>
                  <DateTimePicker value={field.value} onChange={field.onChange} ariaLabel="Início" />
                </div>
              )}
            />
            {errors.startDate && <p className="text-xs text-destructive">{errors.startDate.message}</p>}
          </div>
          <div className={styles.field}>
            <Label>Data e hora de finalização</Label>
            <Controller
              control={control}
              name="endDate"
              render={({ field }) => (
                <div className={styles.dateTimeField}>
                  <DateTimePicker value={field.value} onChange={field.onChange} ariaLabel="Fim" />
                </div>
              )}
            />
            {errors.endDate && <p className="text-xs text-destructive">{errors.endDate.message}</p>}
          </div>
        </div>
      )}

      <div className={styles.field}>
        <Label>Fuso horário</Label>
        <div className={styles.iconInput}>
          <Globe aria-hidden="true" />
          <Controller
            control={control}
            name="timezone"
            render={({ field }) => (
              <TimezoneSelect value={field.value} onChange={field.onChange} />
            )}
          />
        </div>
        {errors.timezone && <p className="text-xs text-destructive">{errors.timezone.message}</p>}
      </div>

      <div className={styles.fieldGrid}>
        <div className={styles.field}>
          <Label htmlFor="waitingTitle">Título da sala de espera</Label>
          <Input id="waitingTitle" {...register("waitingTitle")} />
        </div>
        <div className={styles.field}>
          <Label htmlFor="waitingSubtitle">Subtítulo da sala de espera</Label>
          <Input id="waitingSubtitle" {...register("waitingSubtitle")} />
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        <Label>Modelo da página de espera</Label>
        <Controller
          control={control}
          name="waitingTemplate"
          render={({ field }) => (
            <WaitingTemplatePicker value={field.value} onChange={field.onChange} />
          )}
        />
      </div>

      <div className={styles.field}>
        <Label htmlFor="closedGroupUrl">Link do grupo (exibido após o encerramento)</Label>
        <div className={styles.iconInput}>
          <ArrowUpRight aria-hidden="true" />
          <Input id="closedGroupUrl" placeholder="https://chat.whatsapp.com/…" {...register("closedGroupUrl")} />
        </div>
        <p className={styles.hint}>
          Aparece na página de webinar encerrado com um botão para entrar no grupo.
        </p>
      </div>

      <input type="hidden" value={mode} {...register("mode")} />

      <WizardNav webinarId={webinarId} step={2} submitting={pending} />
    </form>
  );
}
