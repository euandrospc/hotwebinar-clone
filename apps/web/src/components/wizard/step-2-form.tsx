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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { Switch } from "@/components/ui/switch";
import { WizardNav } from "@/components/wizard/wizard-nav";

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

      <div className="space-y-2">
        <Label htmlFor="timezone">Fuso horário</Label>
        <Input id="timezone" {...register("timezone")} placeholder="America/Sao_Paulo" />
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

      <Controller
        control={control}
        name="waitingShowThumb"
        render={({ field }) => (
          <label className="flex items-center gap-3">
            <Switch checked={field.value} onCheckedChange={field.onChange} />
            <span className="text-sm">Mostrar thumbnail do vídeo na sala de espera</span>
          </label>
        )}
      />

      <input type="hidden" value={mode} {...register("mode")} />

      <WizardNav webinarId={webinarId} step={2} submitting={pending} />
    </form>
  );
}
