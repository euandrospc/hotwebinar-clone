"use client";
import { useTransition } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlignCenter, AlignLeft, AlignRight } from "lucide-react";
import { step3Schema, type Step3Input } from "@/lib/validations/webinar";
import { updateWebinarStep3 } from "@/server/actions/webinar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ColorPicker } from "@/components/ui/color-picker";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { LoginPreview } from "@/components/wizard/login-preview";
import { WizardNav } from "@/components/wizard/wizard-nav";

export interface Step3FormProps {
  webinarId: string;
  initial: Step3Input & { titleHint?: string };
}

const FIELD_LABEL: Record<"name" | "email" | "phone", string> = {
  name: "Nome",
  email: "E-mail",
  phone: "WhatsApp"
};

export function Step3Form({ webinarId, initial }: Step3FormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const { register, handleSubmit, control, watch, setValue, formState: { errors } } = useForm<Step3Input>({
    resolver: zodResolver(step3Schema),
    defaultValues: initial
  });

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

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <h2 className="text-2xl font-semibold">Login</h2>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_minmax(0,360px)]">
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="logoUrl">Logo do webinar (URL)</Label>
              <Input id="logoUrl" {...register("logoUrl")} placeholder="https://..." />
              {errors.logoUrl && <p className="text-sm text-destructive">{errors.logoUrl.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Alinhamento do logo</Label>
              <Controller
                control={control}
                name="loginLogoAlign"
                render={({ field }) => (
                  <div className="flex gap-2">
                    {(["LEFT", "CENTER", "RIGHT"] as const).map((a) => {
                      const Icon = a === "LEFT" ? AlignLeft : a === "CENTER" ? AlignCenter : AlignRight;
                      const selected = field.value === a;
                      return (
                        <Button
                          key={a}
                          type="button"
                          variant={selected ? "default" : "outline"}
                          size="icon"
                          onClick={() => field.onChange(a)}
                          aria-pressed={selected}
                          aria-label={`Alinhar à ${a.toLowerCase()}`}
                        >
                          <Icon className="h-4 w-4" />
                        </Button>
                      );
                    })}
                  </div>
                )}
              />
            </div>
          </div>

          <fieldset className="space-y-3 rounded-md border p-4">
            <legend className="px-1 text-sm font-semibold">Barra de progresso</legend>
            <Controller
              control={control}
              name="progressEnabled"
              render={({ field }) => (
                <label className="flex items-center gap-3">
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                  <span className="text-sm">Exibir barra de progresso</span>
                </label>
              )}
            />
            {watch("progressEnabled") ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="progressStartPct">Iniciar em (%)</Label>
                  <Input
                    id="progressStartPct"
                    type="number"
                    min={0}
                    max={99}
                    {...register("progressStartPct", { valueAsNumber: true })}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Cor da barra</Label>
                  <Controller
                    control={control}
                    name="progressBarColor"
                    render={({ field }) => (
                      <ColorPicker value={field.value} onChange={field.onChange} aria-label="Cor da barra" />
                    )}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Cor do texto</Label>
                  <Controller
                    control={control}
                    name="progressTextColor"
                    render={({ field }) => (
                      <ColorPicker value={field.value} onChange={field.onChange} aria-label="Cor do texto" />
                    )}
                  />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <Label htmlFor="progressText">Texto (use {"{pct}"} para o número)</Label>
                  <Input id="progressText" {...register("progressText")} />
                </div>
              </div>
            ) : null}
          </fieldset>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="loginButtonText">Texto do botão</Label>
              <Input id="loginButtonText" {...register("loginButtonText")} />
            </div>
            <div className="space-y-2">
              <Label>Cor do botão</Label>
              <Controller
                control={control}
                name="loginButtonColor"
                render={({ field }) => (
                  <ColorPicker value={field.value} onChange={field.onChange} aria-label="Cor do botão" />
                )}
              />
            </div>
          </div>

          <fieldset className="space-y-3 rounded-md border p-4">
            <legend className="px-1 text-sm font-semibold">Formulário de acesso à sala</legend>
            <p className="text-xs text-muted-foreground">
              Reordene os campos com as setas. Desative campos que não deseja exibir.
            </p>
            <Controller
              control={control}
              name="formFieldOrder"
              render={({ field }) => (
                <ol className="space-y-2">
                  {field.value.map((key, idx) => (
                    <li key={key} className="flex items-center gap-2 rounded-md border bg-muted/30 p-2">
                      <span className="w-24 text-sm font-medium">{FIELD_LABEL[key]}</span>
                      <div className="flex flex-1 items-center gap-3">
                        <Switch
                          checked={isFieldEnabled(key)}
                          onCheckedChange={(v) => toggleFieldEnabled(key, v)}
                        />
                        <span className="text-xs text-muted-foreground">Exibir</span>
                      </div>
                      <Button type="button" size="sm" variant="ghost" onClick={() => moveField(idx, -1)} aria-label="Subir">
                        ↑
                      </Button>
                      <Button type="button" size="sm" variant="ghost" onClick={() => moveField(idx, 1)} aria-label="Descer">
                        ↓
                      </Button>
                    </li>
                  ))}
                </ol>
              )}
            />
            {errors.formFieldOrder && (
              <p className="text-sm text-destructive">{errors.formFieldOrder.message as string}</p>
            )}
          </fieldset>

          <fieldset className="space-y-3 rounded-md border p-4">
            <legend className="px-1 text-sm font-semibold">Campos obrigatórios</legend>
            <Controller control={control} name="nameRequired" render={({ field }) => (
              <label className="flex items-center gap-3">
                <Switch checked={field.value} onCheckedChange={field.onChange} />
                <span className="text-sm">Incluir Nome como requisito obrigatório</span>
              </label>
            )} />
            <Controller control={control} name="emailRequired" render={({ field }) => (
              <label className="flex items-center gap-3">
                <Switch checked={field.value} onCheckedChange={field.onChange} />
                <span className="text-sm">Incluir E-mail como requisito obrigatório</span>
              </label>
            )} />
            <Controller control={control} name="phoneRequired" render={({ field }) => (
              <label className="flex items-center gap-3">
                <Switch checked={field.value} onCheckedChange={field.onChange} />
                <span className="text-sm">Incluir WhatsApp como requisito obrigatório</span>
              </label>
            )} />
          </fieldset>

          <fieldset className="space-y-3 rounded-md border p-4">
            <legend className="px-1 text-sm font-semibold">Campos do formulário</legend>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="space-y-1">
                <Label htmlFor="namePlaceholder">Placeholder Nome</Label>
                <Input id="namePlaceholder" {...register("namePlaceholder")} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="emailPlaceholder">Placeholder E-mail</Label>
                <Input id="emailPlaceholder" {...register("emailPlaceholder")} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="phonePlaceholder">Placeholder WhatsApp</Label>
                <Input id="phonePlaceholder" {...register("phonePlaceholder")} />
              </div>
            </div>
          </fieldset>
        </div>

        <aside className="lg:sticky lg:top-4 lg:self-start">
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
      </div>

      <WizardNav webinarId={webinarId} step={3} submitting={pending} />
    </form>
  );
}
