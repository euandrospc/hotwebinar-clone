"use client";
import { useEffect, useTransition } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import slugify from "slugify";
import { step1Schema, type Step1Input } from "@/lib/validations/webinar";
import { updateWebinarStep1 } from "@/server/actions/webinar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WizardNav } from "@/components/wizard/wizard-nav";
import { ToggleCard } from "@/components/wizard/toggle-card";

export interface Step1FormProps {
  webinarId: string;
  initial: Step1Input;
}

export function Step1Form({ webinarId, initial }: Step1FormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    setError,
    formState: { errors }
  } = useForm<Step1Input>({
    resolver: zodResolver(step1Schema),
    defaultValues: initial
  });

  const title = watch("title");
  useEffect(() => {
    const currentSlug = (watch("slug") ?? "").trim();
    if (currentSlug === "" && title) {
      setValue("slug", slugify(title, { lower: true, strict: true }), { shouldValidate: false });
    }
  }, [title, setValue, watch]);

  function onSubmit(values: Step1Input) {
    startTransition(async () => {
      const res = await updateWebinarStep1(webinarId, values);
      if ("ok" in res) {
        router.push(`/dashboard/webinars/${webinarId}/step-2`);
      } else {
        if (res.error.field) {
          setError(res.error.field as keyof Step1Input, { message: res.error.message });
        } else {
          toast.error(res.error.message);
        }
      }
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl space-y-6">
      <h2 className="text-2xl font-semibold">Início</h2>

      <div className="space-y-2">
        <Label htmlFor="name">Nome interno</Label>
        <Input id="name" {...register("name")} />
        {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="title">Título público</Label>
        <Input id="title" {...register("title")} />
        {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="slug">URL amigável</Label>
        <Input id="slug" {...register("slug")} />
        <p className="text-xs text-muted-foreground">
          {(typeof window !== "undefined" ? window.location.origin : "")}/<span className="font-mono">{watch("slug") || "<slug>"}</span>
        </p>
        {errors.slug && <p className="text-sm text-destructive">{errors.slug.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="language">Idioma</Label>
        <Input id="language" {...register("language")} placeholder="pt-BR" />
        {errors.language && <p className="text-sm text-destructive">{errors.language.message}</p>}
      </div>

      <Controller
        control={control}
        name="accessFacilitated"
        render={({ field }) => (
          <ToggleCard
            title="Forma de acesso à sala"
            description="Acesso Facilitado"
            info="Ao ativar o acesso facilitado, o usuário é direcionado imediatamente para a sala do webinar, sem a necessidade de fazer login."
            checked={field.value}
            onCheckedChange={field.onChange}
          />
        )}
      />

      <Controller
        control={control}
        name="videoSyncWithStart"
        render={({ field }) => (
          <ToggleCard
            title="Sincronizar vídeo com tempo de início do webinar"
            description="Quando ativo, o vídeo respeita o atraso do lead."
            info="Por exemplo, se o seu webinar estiver agendado para 20h e o usuário entrar às 20h05, o vídeo começará a partir do minuto 5."
            checked={field.value}
            onCheckedChange={field.onChange}
          />
        )}
      />

      <WizardNav webinarId={webinarId} step={1} submitting={pending} />
    </form>
  );
}
