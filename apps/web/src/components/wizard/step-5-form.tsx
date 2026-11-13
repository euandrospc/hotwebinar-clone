"use client";
import { OfferTitleEditor } from "./offer-title-editor";
import { useTransition } from "react";
import { useForm, Controller, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { step5Schema, type Step5Input } from "@/lib/validations/webinar";
import { updateWebinarStep5 } from "@/server/actions/webinar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { SecondsInput } from "@/components/ui/seconds-input";
import { ColorPicker } from "@/components/ui/color-picker";
import { Globe, Pipette } from "@/components/icons";
import { ImageUploadField } from "@/components/wizard/image-upload-field";
import { OfferPreviewDesktop, OfferPreviewMobile } from "@/components/wizard/offer-preview";
import { WizardNav } from "@/components/wizard/wizard-nav";
import { palcoCard, palcoError, palcoField, palcoInput, palcoLabel, palcoSwitch, palcoTime, palcoTitle } from "./palco-fields";

export interface Step5FormProps {
  webinarId: string;
  initial: Step5Input;
}

const timeFields = [
  { name: "pitchAtSec", label: "Início do pitch", nullable: true },
  { name: "offerShowAtSec", label: "Início da oferta", nullable: false },
  { name: "offerHideAtSec", label: "Fim da oferta", nullable: true }
] as const;

const toggles = [
  ["offerPassUtms", "Repassar UTMs para o link da oferta"],
  ["offerDisabled", "Desabilitar oferta"],
  ["offerSameWindow", "Abrir o link na mesma janela do webinar"],
  ["offerRaffleEnabled", "Habilitar sorteio"]
] as const;

export function Step5Form({ webinarId, initial }: Step5FormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const form = useForm<Step5Input>({
    resolver: zodResolver(step5Schema),
    defaultValues: initial
  });
  const { register, handleSubmit, control, formState: { errors } } = form;
  const watched = useWatch({ control });

  function onSubmit(values: Step5Input) {
    startTransition(async () => {
      const res = await updateWebinarStep5(webinarId, values);
      if ("ok" in res) {
        toast.success("Oferta salva");
        router.push(`/dashboard/webinars/${webinarId}/step-6`);
      } else {
        toast.error(res.error.message);
      }
    });
  }

  const previewProps = {
    offerTitle: watched.offerTitle ?? "",
    offerTitleStyle: watched.offerTitleStyle,
    offerPriceOriginal: watched.offerPriceOriginal ?? null,
    offerPriceFinal: watched.offerPriceFinal ?? null,
    offerButtonText: watched.offerButtonText ?? "",
    offerButtonColor: watched.offerButtonColor ?? "#dc2626",
    offerImageDesktopUrl: watched.offerImageDesktopUrl ?? null,
    offerImageMobileUrl: watched.offerImageMobileUrl ?? null,
    offerRaffleEnabled: Boolean(watched.offerRaffleEnabled)
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
      <div className={palcoCard}>
        <h2 className={palcoTitle}>Oferta</h2>

        <div className={palcoField}>
          <Label htmlFor="offerName" className={palcoLabel}>Nome da oferta *</Label>
          <Input id="offerName" className={palcoInput} {...register("offerName")} />
          {errors.offerName && <p className={palcoError}>{errors.offerName.message}</p>}
        </div>

        <div className={palcoField}>
          <Label htmlFor="offerTitle" className={palcoLabel}>Título da oferta *</Label>
          <Controller control={control} name="offerTitle" render={({ field }) => (
            <OfferTitleEditor value={field.value} format={watched.offerTitleStyle}
              onChange={field.onChange}
              onFormat={value => form.setValue("offerTitleStyle", value, { shouldDirty: true, shouldValidate: true })} />
          )} />
          {errors.offerTitle && <p className={palcoError}>{errors.offerTitle.message}</p>}
          {errors.offerTitleStyle && <p className={palcoError}>{errors.offerTitleStyle.message}</p>}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className={palcoField}>
            <Label htmlFor="offerPriceOriginal" className={palcoLabel}>Preço original</Label>
            <Input id="offerPriceOriginal" className={palcoInput} placeholder="R$ 2.997" {...register("offerPriceOriginal")} />
          </div>
          <div className={palcoField}>
            <Label htmlFor="offerPriceFinal" className={palcoLabel}>Preço da oferta</Label>
            <Input id="offerPriceFinal" className={palcoInput} placeholder="12x de R$ 153,44" {...register("offerPriceFinal")} />
          </div>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row">
          <div className={`${palcoField} flex-1`}>
            <Label htmlFor="offerButtonText" className={palcoLabel}>Texto do botão *</Label>
            <Input id="offerButtonText" className={palcoInput} {...register("offerButtonText")} />
            {errors.offerButtonText && <p className={palcoError}>{errors.offerButtonText.message}</p>}
          </div>
          <div className={palcoField}>
            <Label htmlFor="offerButtonColor" className={palcoLabel}>Cor do botão</Label>
            <Controller
              control={control}
              name="offerButtonColor"
              render={({ field }) => (
                <ColorPicker value={field.value} onChange={field.onChange}>
                  <button id="offerButtonColor" type="button" aria-label="Cor do botão"
                    className="flex h-[42px] items-center gap-2.5 rounded-[10px] border border-[#1E241F] bg-[#070807] px-3 text-xs text-[#C9D1CA] transition-colors hover:border-[#2E3630] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-palco/60 motion-reduce:transition-none">
                    <span className="h-[18px] w-[18px] shrink-0 rounded-full border border-white/15" style={{ backgroundColor: field.value }} aria-hidden />
                    <span className="min-w-[52px] text-left">{field.value}</span>
                    <Pipette className="h-3.5 w-3.5 text-[#7C867E]" aria-hidden />
                  </button>
                </ColorPicker>
              )}
            />
            {errors.offerButtonColor && <p className={palcoError}>{errors.offerButtonColor.message}</p>}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className={palcoField}>
            <Label className={palcoLabel}>Imagem da oferta para desktop</Label>
            <Controller
              control={control}
              name="offerImageDesktopUrl"
              render={({ field }) => (
                <ImageUploadField webinarId={webinarId} kind="desktop" value={field.value ?? null} onChange={field.onChange} />
              )}
            />
          </div>
          <div className={palcoField}>
            <Label className={palcoLabel}>Imagem da oferta para mobile</Label>
            <Controller
              control={control}
              name="offerImageMobileUrl"
              render={({ field }) => (
                <ImageUploadField
                  webinarId={webinarId}
                  kind="mobile"
                  value={field.value ?? null}
                  onChange={field.onChange}
                  recommendedHint="384 pixels de largura e 110 pixels de altura"
                />
              )}
            />
          </div>
        </div>

        <div className="grid gap-x-6 gap-y-[18px] sm:grid-cols-3">
          {timeFields.map(({ name, label, nullable }) => (
            <div key={name} className={palcoField}>
              <Label className={palcoLabel}>{label}</Label>
              <Controller
                control={control}
                name={name}
                render={({ field }) => (
                  <SecondsInput
                    value={field.value ?? 0}
                    onChange={(v) => field.onChange(nullable && v === 0 ? null : v)}
                    aria-label={label}
                    className={palcoTime}
                  />
                )}
              />
              {name === "offerHideAtSec" && errors.offerHideAtSec && <p className={palcoError}>{errors.offerHideAtSec.message}</p>}
            </div>
          ))}
        </div>

        <div className={palcoField}>
          <Label htmlFor="offerLink" className={palcoLabel}>Link da oferta</Label>
          <div className="relative">
            <Globe className="pointer-events-none absolute left-3.5 top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-[#7C867E]" aria-hidden />
            <Input id="offerLink" className={`${palcoInput} pl-10 text-[13px]`} {...register("offerLink")} placeholder="https://" />
          </div>
          {errors.offerLink && <p className={palcoError}>{errors.offerLink.message}</p>}
        </div>

        <div className="flex flex-col gap-3">
          {toggles.map(([key, label]) => (
            <Controller
              key={key}
              control={control}
              name={key}
              render={({ field }) => (
                <label className="flex w-fit cursor-pointer items-center gap-2.5">
                  <Switch checked={Boolean(field.value)} onCheckedChange={field.onChange} aria-label={label} className={palcoSwitch} />
                  <span className="text-sm text-[#E4E9E5]">{label}</span>
                </label>
              )}
            />
          ))}
        </div>

        {watched.offerRaffleEnabled && (
          <div className="grid gap-4 rounded-xl border border-[#1E241F] bg-[#0F120F] p-4 sm:grid-cols-2">
            <div className={palcoField}>
              <Label className={palcoLabel}>Hora de início do sorteio</Label>
              <Controller
                control={control}
                name="offerRaffleAtSec"
                render={({ field }) => (
                  <SecondsInput
                    value={field.value ?? 0}
                    onChange={(v) => field.onChange(v === 0 ? null : v)}
                    aria-label="Hora de início do sorteio"
                    className={palcoTime}
                  />
                )}
              />
            </div>
            <div className={palcoField}>
              <Label htmlFor="offerRaffleNumber" className={palcoLabel}>Escolha o número do sorteio</Label>
              <Input id="offerRaffleNumber" className={palcoInput} {...register("offerRaffleNumber")} />
              {errors.offerRaffleNumber && <p className={palcoError}>{errors.offerRaffleNumber.message}</p>}
            </div>
          </div>
        )}

        <WizardNav webinarId={webinarId} step={5} submitting={pending} />
      </div>

      <aside className="flex min-w-0 flex-col gap-3.5 rounded-2xl border border-[#1E241F] bg-[#0C0E0C] p-5 font-palco xl:sticky xl:top-[76px]">
        <h3 className="text-xs font-semibold text-[#7C867E]">Prévia da oferta</h3>
        <OfferPreviewDesktop {...previewProps} />
        <OfferPreviewMobile {...previewProps} />
      </aside>
    </form>
  );
}
