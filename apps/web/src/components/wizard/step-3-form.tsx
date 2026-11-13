"use client";
import styles from "./wizard.module.css";
import { useRef, useState, useTransition } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlignCenter, AlignLeft, AlignRight, Upload, ArrowUp, ArrowDown, Image as ImageIcon } from "@/components/icons";
import { step3Schema, type Step3Input } from "@/lib/validations/webinar";
import { updateWebinarStep3 } from "@/server/actions/webinar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ColorPickerField } from "@/components/wizard/color-picker-field";
import { LoginPreview } from "@/components/wizard/login-preview";
import { WizardNav } from "@/components/wizard/wizard-nav";
import { cn } from "@/lib/utils";

export interface Step3FormProps {
  webinarId: string;
  initial: Step3Input & { titleHint?: string };
}

const FIELD_LABEL: Record<"name" | "email" | "phone", string> = {
  name: "Nome",
  email: "E-mail",
  phone: "WhatsApp"
};

const SQUARE_BUTTON = "flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[10px] border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-palco disabled:opacity-50 motion-reduce:transition-none [&_svg]:h-4 [&_svg]:w-4";
const ARROW_BUTTON = "flex h-7 w-7 items-center justify-center rounded-md text-[#9AA39C] transition-colors hover:bg-[#121512] hover:text-[#F2F5F2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-palco disabled:opacity-35 motion-reduce:transition-none";

export function Step3Form({ webinarId, initial }: Step3FormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [logoUploading, setLogoUploading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const { register, handleSubmit, control, watch, setValue, formState: { errors } } = useForm<Step3Input>({
    resolver: zodResolver(step3Schema),
    defaultValues: initial
  });

  async function uploadLogo(file: File) {
    setLogoUploading(true);
    try {
      const presignRes = await fetch("/api/upload/offer-image", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ webinarId, kind: "logo", mimeType: file.type, sizeBytes: file.size })
      });
      if (!presignRes.ok) {
        const err = await presignRes.json().catch(() => ({}));
        toast.error(err.message ?? "Falha ao iniciar upload");
        return;
      }
      const { uploadUrl, publicUrl } = await presignRes.json();
      const putRes = await fetch(uploadUrl, { method: "PUT", headers: { "content-type": file.type }, body: file });
      if (!putRes.ok) {
        toast.error("Falha ao enviar imagem");
        return;
      }
      setValue("logoUrl", publicUrl, { shouldDirty: true });
      toast.success("Logo enviado");
    } finally {
      setLogoUploading(false);
      if (logoInputRef.current) logoInputRef.current.value = "";
    }
  }

  function onSubmit(values: Step3Input) {
    startTransition(async () => {
      const r = await updateWebinarStep3(webinarId, values);
      if ("ok" in r) {
        router.push(`/dashboard/webinars/${webinarId}/step-4`);
      } else {
        toast.error(r.error.message);
      }
    });
  }

  function moveField(idx: number, dir: -1 | 1) {
    const order = [...watch("formFieldOrder")];
    const ni = idx + dir;
    if (ni < 0 || ni >= order.length) return;
    const a = order[idx];
    const b = order[ni];
    order[idx] = b;
    order[ni] = a;
    setValue("formFieldOrder", order);
  }

  function toggleFieldEnabled(key: "name" | "email" | "phone", enabled: boolean) {
    if (key === "name") setValue("nameEnabled", enabled);
    if (key === "email") setValue("emailEnabled", enabled);
    if (key === "phone") setValue("phoneEnabled", enabled);
  }

  function isFieldEnabled(key: "name" | "email" | "phone"): boolean {
    if (key === "name") return Boolean(watch("nameEnabled"));
    if (key === "email") return Boolean(watch("emailEnabled"));
    return Boolean(watch("phoneEnabled"));
  }

  const switchRow = (name: "nameRequired" | "emailRequired" | "phoneRequired" | "progressEnabled", text: string) => (
    <Controller control={control} name={name} render={({ field }) => (
      <label className={styles.switchRow}>
        <Switch checked={field.value} onCheckedChange={field.onChange} />
        <span>{text}</span>
      </label>
    )} />
  );

  const colorField = (name: "progressBarColor" | "progressTextColor" | "loginButtonColor" | "primaryColor", label: string) => (
    <div className={cn(styles.field, "sm:w-[178px] sm:shrink-0")}>
      <Label htmlFor={name}>{label}</Label>
      <Controller control={control} name={name} render={({ field }) => (
        <ColorPickerField id={name} value={field.value || "#16a34a"} onChange={field.onChange} aria-label={label} />
      )} />
    </div>
  );

  return (
    <form onSubmit={handleSubmit(onSubmit)} className={styles.formColumns}>
      <div className={styles.formPanel}>
        <h2 className={styles.title}>Login</h2>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className={cn(styles.field, "flex-1")}>
            <Label htmlFor="logoUrl">Logo do webinar (URL)</Label>
            <div className="flex gap-4">
              <div className={cn(styles.iconInput, "flex-1")}>
                <ImageIcon aria-hidden="true" />
                <Input id="logoUrl" {...register("logoUrl")} placeholder="https://..." />
              </div>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void uploadLogo(f);
                }}
              />
              <button
                type="button"
                className={cn(SQUARE_BUTTON, "border-[#1E241F] text-[#C9D1CA] hover:bg-[#121512]")}
                disabled={logoUploading}
                onClick={() => logoInputRef.current?.click()}
                aria-label="Enviar logo"
                title="Enviar logo"
              >
                <Upload aria-hidden="true" />
              </button>
            </div>
          </div>
          <div className={styles.field}>
            <Label id="logo-align-label">Alinhamento do logo</Label>
            <Controller
              control={control}
              name="loginLogoAlign"
              render={({ field }) => (
                <div className="flex gap-1.5" role="group" aria-labelledby="logo-align-label">
                  {(["LEFT", "CENTER", "RIGHT"] as const).map((a) => {
                    const Icon = a === "LEFT" ? AlignLeft : a === "CENTER" ? AlignCenter : AlignRight;
                    const selected = field.value === a;
                    return (
                      <button
                        key={a}
                        type="button"
                        className={cn(SQUARE_BUTTON, selected ? "border-palco bg-palco text-palco-ink" : "border-[#1E241F] text-[#C9D1CA] hover:bg-[#121512]")}
                        onClick={() => field.onChange(a)}
                        aria-pressed={selected}
                        aria-label={a === "LEFT" ? "Alinhar à esquerda" : a === "CENTER" ? "Centralizar" : "Alinhar à direita"}
                      >
                        <Icon aria-hidden="true" />
                      </button>
                    );
                  })}
                </div>
              )}
            />
          </div>
        </div>
        {errors.logoUrl && <p className="-mt-2 text-xs text-destructive">{errors.logoUrl.message}</p>}

        <section className={styles.formSection}>
          <h3 className={styles.sectionTitle}>Barra de progresso</h3>
          {switchRow("progressEnabled", "Exibir barra de progresso")}
          {watch("progressEnabled") ? (
            <>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                <div className={cn(styles.field, "flex-1")}>
                  <Label htmlFor="progressStartPct">Iniciar em (%)</Label>
                  <Input id="progressStartPct" type="number" min={0} max={99} {...register("progressStartPct", { valueAsNumber: true })} />
                </div>
                {colorField("progressBarColor", "Cor da barra")}
                {colorField("progressTextColor", "Cor do texto")}
              </div>
              <div className={styles.field}>
                <Label htmlFor="progressText">Texto (use {"{pct}"} para o número)</Label>
                <Input id="progressText" {...register("progressText")} />
              </div>
            </>
          ) : null}
        </section>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className={cn(styles.field, "flex-1")}>
            <Label htmlFor="loginButtonText">Texto do botão</Label>
            <Input id="loginButtonText" {...register("loginButtonText")} />
          </div>
          {colorField("loginButtonColor", "Cor do botão")}
          {colorField("primaryColor", "Cor primária")}
        </div>

        <section className={styles.formSection}>
          <h3 className={styles.sectionTitle}>Formulário de acesso à sala</h3>
          <p className={styles.hint}>Reordene os campos com as setas. Desative os que não deseja exibir.</p>
          <Controller
            control={control}
            name="formFieldOrder"
            render={({ field }) => (
              <ol className="flex flex-col gap-2">
                {field.value.map((key, idx) => (
                  <li key={key} className="flex h-[46px] items-center gap-4 rounded-[10px] border border-[#1E241F] bg-[#070807] px-3.5">
                    <span className="w-[110px] shrink-0 truncate text-[13px] font-semibold text-[#F2F5F2]">{FIELD_LABEL[key]}</span>
                    <div className="flex flex-1 items-center gap-2">
                      <Switch aria-label={`Exibir ${FIELD_LABEL[key]}`} checked={isFieldEnabled(key)} onCheckedChange={(v) => toggleFieldEnabled(key, v)} />
                      <span aria-hidden="true" className="text-xs text-[#9AA39C]">Exibir</span>
                    </div>
                    <div className="flex gap-1">
                      <button type="button" disabled={idx === 0} onClick={() => moveField(idx, -1)} aria-label={`Subir ${FIELD_LABEL[key]}`} className={ARROW_BUTTON}>
                        <ArrowUp aria-hidden="true" className="h-[15px] w-[15px]" />
                      </button>
                      <button type="button" disabled={idx === field.value.length - 1} onClick={() => moveField(idx, 1)} aria-label={`Descer ${FIELD_LABEL[key]}`} className={ARROW_BUTTON}>
                        <ArrowDown aria-hidden="true" className="h-[15px] w-[15px]" />
                      </button>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          />
          {errors.formFieldOrder && <p className="text-xs text-destructive">{errors.formFieldOrder.message as string}</p>}
        </section>

        <section className={styles.formSection}>
          <h3 className={styles.sectionTitle}>Campos obrigatórios</h3>
          {switchRow("nameRequired", "Incluir Nome como obrigatório")}
          {switchRow("emailRequired", "Incluir E-mail como obrigatório")}
          {switchRow("phoneRequired", "Incluir WhatsApp como obrigatório")}
        </section>

        <section className={styles.formSection}>
          <h3 className={styles.sectionTitle}>Textos dos campos</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className={styles.field}>
              <Label htmlFor="namePlaceholder">Placeholder Nome</Label>
              <Input id="namePlaceholder" {...register("namePlaceholder")} />
            </div>
            <div className={styles.field}>
              <Label htmlFor="emailPlaceholder">Placeholder E-mail</Label>
              <Input id="emailPlaceholder" {...register("emailPlaceholder")} />
            </div>
            <div className={styles.field}>
              <Label htmlFor="phonePlaceholder">Placeholder WhatsApp</Label>
              <Input id="phonePlaceholder" {...register("phonePlaceholder")} />
            </div>
          </div>
        </section>

        <WizardNav webinarId={webinarId} step={3} submitting={pending} />
      </div>

      <aside className={styles.previewPanel} aria-label="Prévia do acesso">
        <h3 className={styles.previewTitle}>Prévia do acesso</h3>
        <LoginPreview
          logoUrl={watch("logoUrl") || ""}
          loginLogoAlign={watch("loginLogoAlign")}
          title={initial.titleHint ?? "Título do webinar"}
          loginButtonText={watch("loginButtonText")}
          loginButtonColor={watch("loginButtonColor")}
          primaryColor={watch("primaryColor") || "#16a34a"}
          nameEnabled={watch("nameEnabled")}
          emailEnabled={watch("emailEnabled")}
          phoneEnabled={watch("phoneEnabled")}
          namePlaceholder={watch("namePlaceholder")}
          emailPlaceholder={watch("emailPlaceholder")}
          phonePlaceholder={watch("phonePlaceholder")}
          formFieldOrder={watch("formFieldOrder") as ReadonlyArray<"name" | "email" | "phone">}
          progressEnabled={watch("progressEnabled")}
          progressStartPct={watch("progressStartPct")}
          progressBarColor={watch("progressBarColor")}
          progressTextColor={watch("progressTextColor")}
          progressText={watch("progressText")}
        />
      </aside>
    </form>
  );
}
