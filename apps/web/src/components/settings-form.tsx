"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { upsertAccountSettings } from "@/server/actions/settings";
import { accountSettingsSchema, type AccountSettingsInput } from "@/lib/validations/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface SettingsFormProps {
  initial: AccountSettingsInput;
}

export function SettingsForm({ initial }: SettingsFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<AccountSettingsInput>({
    resolver: zodResolver(accountSettingsSchema),
    defaultValues: initial
  });

  async function onSubmit(values: AccountSettingsInput) {
    const result = await upsertAccountSettings(values);
    if ("ok" in result) {
      toast.success("Configurações salvas");
    } else {
      toast.error(result.error.message);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-xl space-y-6">
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
        <Input id="defaultTimezone" {...register("defaultTimezone")} placeholder="America/Sao_Paulo" />
        {errors.defaultTimezone && <p className="text-sm text-destructive">{errors.defaultTimezone.message}</p>}
      </div>
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Salvando..." : "Salvar"}
      </Button>
    </form>
  );
}
