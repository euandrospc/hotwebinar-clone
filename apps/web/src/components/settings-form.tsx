"use client";
import { Globe } from "@/components/icons";
import styles from "@/components/management-v2.module.css";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { upsertAccountSettings } from "@/server/actions/settings";
import { accountSettingsSchema, type AccountSettingsInput } from "@/lib/validations/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TimezoneSelect } from "@/components/wizard/timezone-select";

export interface SettingsFormProps {
  initial: AccountSettingsInput;
}

export function SettingsForm({ initial }: SettingsFormProps) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting }
  } = useForm<AccountSettingsInput>({
    resolver: zodResolver(accountSettingsSchema),
    defaultValues: initial
  });

  async function onSubmit(values: AccountSettingsInput) {
    const result = await upsertAccountSettings(values);
    if ("ok" in result) {
      toast.success("Configurações salvas");
      reset(values);
      router.refresh();
    } else {
      toast.error(result.error.message);
    }
  }

  return (
    <section className={styles.surface}>
      <div className={styles.sectionHeader}><div className="flex items-center gap-3"><span className={styles.iconBadge}><Globe aria-hidden="true" /></span><div><h2 className={styles.sectionTitle}>Padrões dos webinars</h2><p className={styles.description}>Aplicados aos novos webinars.</p></div></div></div>
      <form onSubmit={handleSubmit(onSubmit)} className={`${styles.form} ${styles.sectionBody}`}>
      <div className="space-y-2">
        <Label htmlFor="brandName">Nome da marca</Label>
        <Input id="brandName" {...register("brandName")} placeholder="Ex.: Hotwebinar" />
        {errors.brandName && <p className="text-sm text-destructive">{errors.brandName.message}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="defaultLanguage">Idioma padrão</Label>
        <Input id="defaultLanguage" {...register("defaultLanguage")} placeholder="pt-BR" />
        {errors.defaultLanguage && <p className="text-sm text-destructive">{errors.defaultLanguage.message}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="defaultTimezone">Fuso horário padrão</Label>
        <TimezoneSelect
          value={watch("defaultTimezone") ?? ""}
          onChange={(v) => setValue("defaultTimezone", v, { shouldDirty: true })}
        />
        {errors.defaultTimezone && <p className="text-sm text-destructive">{errors.defaultTimezone.message}</p>}
      </div>
      <div className={styles.formFooter}><Button className={styles.primaryButton} type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Salvando..." : "Salvar"}
      </Button></div>
      </form>
    </section>
  );
}
