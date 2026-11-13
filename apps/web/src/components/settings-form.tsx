"use client";
import { Globe, MessageCircle, MonitorPlay } from "@/components/icons";
import adminStyles from "@/components/admin/admin-page.module.css";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { upsertAccountSettings } from "@/server/actions/settings";
import { accountSettingsSchema, type AccountSettingsInput } from "@/lib/validations/settings";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TIMEZONES, AUTO_TIMEZONE_VALUE, resolveAutoTimezone, timezoneLabel } from "@/lib/timezones";
import { SettingsField, SettingsSection, settingsUi } from "@/components/settings-section";

export interface SettingsFormProps {
  initial: AccountSettingsInput;
}

const LANGUAGES = [
  { value: "pt-BR", label: "Português (Brasil)" },
  { value: "en-US", label: "Inglês (EUA)" },
  { value: "es-ES", label: "Espanhol" }
];

const triggerClass = `${settingsUi.input} gap-2.5 text-left focus:ring-2 focus:ring-palco/30 focus:ring-offset-0 [&>svg:last-child]:size-[15px] [&>svg:last-child]:text-[#6E776F] [&>svg:last-child]:opacity-100`;

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
  const language = watch("defaultLanguage");
  const timezone = watch("defaultTimezone");
  // Keep legacy free-text values selectable instead of silently replacing them.
  const languages = LANGUAGES.some(l => l.value === language) || !language ? LANGUAGES : [...LANGUAGES, { value: language, label: language }];
  const timezones = TIMEZONES.filter(t => t.value !== AUTO_TIMEZONE_VALUE);
  const zones = timezones.some(t => t.value === timezone) || !timezone ? timezones : [...timezones, { value: timezone, label: timezone }];

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
    <SettingsSection icon={<MonitorPlay />} title="Padrões dos webinars" description="Valores usados ao criar um webinar novo. Webinars existentes não mudam.">
      <form onSubmit={handleSubmit(onSubmit)} className={settingsUi.card}>
        <SettingsField id="brandName" label="Nome da marca" hint="Aparece na sala e nos e-mails" error={errors.brandName?.message}>
          <input id="brandName" {...register("brandName")} placeholder="Ex.: Hotwebinar" className={settingsUi.input} />
        </SettingsField>
        <div className="flex flex-col gap-4 sm:flex-row">
          <SettingsField id="defaultLanguage" label="Idioma padrão" error={errors.defaultLanguage?.message}>
            <Select value={language} onValueChange={v => setValue("defaultLanguage", v, { shouldDirty: true })}>
              <SelectTrigger id="defaultLanguage" className={triggerClass}>
                <MessageCircle aria-hidden="true" className="size-[15px] shrink-0 text-[#7C867E]" />
                <span className="flex-1 truncate"><SelectValue placeholder="Escolha um idioma" /></span>
              </SelectTrigger>
              <SelectContent className={adminStyles.portal}>
                {languages.map(l => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </SettingsField>
          <SettingsField id="defaultTimezone" label="Fuso horário padrão" error={errors.defaultTimezone?.message}>
            <Select value={timezone} onValueChange={v => setValue("defaultTimezone", v === AUTO_TIMEZONE_VALUE ? resolveAutoTimezone() : v, { shouldDirty: true })}>
              <SelectTrigger id="defaultTimezone" className={triggerClass}>
                <Globe aria-hidden="true" className="size-[15px] shrink-0 text-[#7C867E]" />
                <span className="flex-1 truncate"><SelectValue placeholder="Escolha um fuso" /></span>
              </SelectTrigger>
              <SelectContent className={adminStyles.portal}>
                <SelectItem value={AUTO_TIMEZONE_VALUE}>Detectar automático (navegador)</SelectItem>
                {zones.map(t => <SelectItem key={t.value} value={t.value}>{timezoneLabel(t.value, t.label)}</SelectItem>)}
              </SelectContent>
            </Select>
          </SettingsField>
        </div>
        <div className={settingsUi.footer}>
          <p className={settingsUi.hint}>Aplicado só a novos webinars</p>
          <button className={settingsUi.primary} type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Salvando..." : "Salvar alterações"}
          </button>
        </div>
      </form>
    </SettingsSection>
  );
}
