"use client";
import { useTransition } from "react";
import { useForm, Controller, type Control, type UseFormRegister, type UseFormWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { step3Schema, type Step3Input } from "@/lib/validations/webinar";
import { updateWebinarStep3 } from "@/server/actions/webinar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { WizardNav } from "@/components/wizard/wizard-nav";

export interface Step3FormProps {
  webinarId: string;
  initial: Step3Input;
}

type FieldKey = "name" | "email" | "phone";

function FieldToggleRow({
  prefix,
  label,
  control,
  register,
  watch
}: {
  prefix: FieldKey;
  label: string;
  control: Control<Step3Input>;
  register: UseFormRegister<Step3Input>;
  watch: UseFormWatch<Step3Input>;
}) {
  const enabledKey = `${prefix}Enabled` as keyof Step3Input;
  const requiredKey = `${prefix}Required` as keyof Step3Input;
  const placeholderKey = `${prefix}Placeholder` as keyof Step3Input;
  const enabled = watch(enabledKey) as boolean;
  return (
    <div className="grid grid-cols-1 gap-3 rounded-md border p-4 md:grid-cols-3">
      <div>
        <p className="font-medium">{label}</p>
        <Controller
          control={control}
          name={enabledKey as never}
          render={({ field }) => (
            <label className="mt-2 flex items-center gap-2 text-sm">
              <Switch
                checked={Boolean(field.value)}
                onCheckedChange={field.onChange}
              />
              Habilitado
            </label>
          )}
        />
      </div>
      <Controller
        control={control}
        name={requiredKey as never}
        render={({ field }) => (
          <label className="flex items-center gap-2 text-sm">
            <Switch
              checked={Boolean(field.value)}
              onCheckedChange={field.onChange}
              disabled={!enabled}
            />
            Obrigatório
          </label>
        )}
      />
      <div className="space-y-1">
        <Label htmlFor={String(placeholderKey)}>Placeholder</Label>
        <Input
          id={String(placeholderKey)}
          {...register(placeholderKey as never)}
          disabled={!enabled}
        />
      </div>
    </div>
  );
}

export function Step3Form({ webinarId, initial }: Step3FormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
    setError,
    watch
  } = useForm<Step3Input>({
    resolver: zodResolver(step3Schema),
    defaultValues: initial
  });

  function onSubmit(values: Step3Input) {
    startTransition(async () => {
      const res = await updateWebinarStep3(webinarId, values);
      if ("ok" in res) {
        router.push(`/dashboard/webinars/${webinarId}/step-4`);
      } else if (res.error.field) {
        setError(res.error.field as keyof Step3Input, { message: res.error.message });
      } else {
        toast.error(res.error.message);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-3xl space-y-6">
      <h2 className="text-2xl font-semibold">Login (opt-in)</h2>

      <section className="space-y-4">
        <h3 className="font-semibold">Identidade visual</h3>
        <div className="space-y-2">
          <Label htmlFor="logoUrl">URL do logo</Label>
          <Input id="logoUrl" {...register("logoUrl")} />
          {errors.logoUrl && <p className="text-sm text-destructive">{errors.logoUrl.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="primaryColor">Cor primária (hex)</Label>
          <Input id="primaryColor" type="color" {...register("primaryColor")} className="h-10 w-20" />
          {errors.primaryColor && <p className="text-sm text-destructive">{errors.primaryColor.message}</p>}
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="font-semibold">Botão entrar</h3>
        <div className="space-y-2">
          <Label htmlFor="loginButtonText">Texto</Label>
          <Input id="loginButtonText" {...register("loginButtonText")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="loginButtonColor">Cor (hex)</Label>
          <Input id="loginButtonColor" type="color" {...register("loginButtonColor")} className="h-10 w-20" />
          {errors.loginButtonColor && <p className="text-sm text-destructive">{errors.loginButtonColor.message}</p>}
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="font-semibold">Form opt-in</h3>
        <FieldToggleRow prefix="name" label="Nome" control={control} register={register} watch={watch} />
        <FieldToggleRow prefix="email" label="E-mail" control={control} register={register} watch={watch} />
        <FieldToggleRow prefix="phone" label="Telefone" control={control} register={register} watch={watch} />
      </section>

      <WizardNav webinarId={webinarId} step={3} submitting={pending} />
    </form>
  );
}
