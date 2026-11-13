"use client";
import styles from "./wizard.module.css";
import { useEffect, useState, useTransition } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import slugify from "slugify";
import { step1Schema, type Step1Input } from "@/lib/validations/webinar";
import { updateWebinarStep1 } from "@/server/actions/webinar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Globe } from "@/components/icons";
import adminStyles from "@/components/admin/admin-page.module.css";
import { WizardNav } from "@/components/wizard/wizard-nav";
import { ToggleCard } from "@/components/wizard/toggle-card";

const LANGUAGES = [
  { value: "pt-BR", label: "Português (Brasil)" },
  { value: "en-US", label: "English (US)" },
  { value: "es-ES", label: "Español" }
] as const;

export interface Step1FormProps {
  webinarId: string;
  initial: Step1Input;
}

export function Step1Form({ webinarId, initial }: Step1FormProps) {
  const router = useRouter();
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
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
    <form onSubmit={handleSubmit(onSubmit)} className={styles.singleForm}>
      <h2 className={styles.title}>Início</h2>

      <div className={styles.fieldGrid}>
        <div className={styles.field}>
          <Label htmlFor="name">Nome interno</Label>
          <Input id="name" {...register("name")} />
          {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
        </div>
        <div className={styles.field}>
          <Label htmlFor="title">Título público</Label>
          <Input id="title" {...register("title")} />
          {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
        </div>
      </div>
      <div className={styles.fieldGrid}>
        <div className={styles.field}>
          <Label htmlFor="slug">URL amigável</Label>
          <Input id="slug" {...register("slug")} />
          <p className={styles.hint}>{origin}/{watch("slug") || "<slug>"}</p>
          {errors.slug && <p className="text-xs text-destructive">{errors.slug.message}</p>}
        </div>
        <div className={styles.field}>
          <Label htmlFor="language">Idioma</Label>
          <Controller
            control={control}
            name="language"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="language" aria-label="Idioma" className="gap-2.5">
                  <Globe aria-hidden="true" className="h-[15px] w-[15px] shrink-0 text-[#7C867E]" />
                  <span className="flex-1 truncate text-left"><SelectValue placeholder="Escolha um idioma" /></span>
                </SelectTrigger>
                <SelectContent className={adminStyles.portal}>
                  {LANGUAGES.map((l) => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
                  {LANGUAGES.some((l) => l.value === field.value) ? null : <SelectItem value={field.value}>{field.value}</SelectItem>}
                </SelectContent>
              </Select>
            )}
          />
          {errors.language && <p className="text-xs text-destructive">{errors.language.message}</p>}
        </div>
      </div>

      <Controller
        control={control}
        name="accessFacilitated"
        render={({ field }) => (
          <ToggleCard
            title="Forma de acesso à sala"
            description="Acesso facilitado"
            info="Ao ativar, o usuário vai direto para a sala do webinar, sem precisar fazer login."
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
            title="Sincronizar vídeo com o início do webinar"
            description="Quando ativo, o vídeo respeita o atraso do lead."
            info="Ex.: webinar às 20h e o usuário entra às 20h05 — o vídeo começa no minuto 5."
            checked={field.value}
            onCheckedChange={field.onChange}
          />
        )}
      />

      <WizardNav webinarId={webinarId} step={1} submitting={pending} />
    </form>
  );
}
