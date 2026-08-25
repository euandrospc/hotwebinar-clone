"use client";
import { useTransition } from "react";
import { useForm, Controller, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { step5Schema, type Step5Input } from "@/lib/validations/webinar";
import { updateWebinarStep5 } from "@/server/actions/webinar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { SecondsInput } from "@/components/ui/seconds-input";
import { ColorPickerField } from "@/components/wizard/color-picker-field";
import { ImageUploadField } from "@/components/wizard/image-upload-field";
import { OfferPreviewDesktop, OfferPreviewMobile } from "@/components/wizard/offer-preview";
import { WizardNav } from "@/components/wizard/wizard-nav";

export interface Step5FormProps {
  webinarId: string;
  initial: Step5Input;
}

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

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-8 lg:grid-cols-[1fr_minmax(0,420px)]">
      <div className="space-y-6">
        <h2 className="text-2xl font-semibold">Oferta</h2>

        <section className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="offerName">Nome da oferta *</Label>
            <Input id="offerName" {...register("offerName")} />
            {errors.offerName && <p className="text-xs text-destructive">{errors.offerName.message}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="offerTitle">Título da oferta *</Label>
            <Input id="offerTitle" {...register("offerTitle")} />
            {errors.offerTitle && <p className="text-xs text-destructive">{errors.offerTitle.message}</p>}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="offerPriceOriginal">Preço original</Label>
              <Input id="offerPriceOriginal" placeholder="R$2.997" {...register("offerPriceOriginal")} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="offerPriceFinal">Preço da oferta</Label>
              <Input id="offerPriceFinal" placeholder="12x de R$153.44" {...register("offerPriceFinal")} />
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="offerButtonText">Texto do botão *</Label>
            <Input id="offerButtonText" {...register("offerButtonText")} />
            {errors.offerButtonText && <p className="text-xs text-destructive">{errors.offerButtonText.message}</p>}
          </div>
          <div className="space-y-1">
            <Label>Cor do botão</Label>
            <Controller
              control={control}
              name="offerButtonColor"
              render={({ field }) => (
                <ColorPickerField
                  id="offerButtonColor"
                  aria-label="Cor do botão"
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
            {errors.offerButtonColor && <p className="text-xs text-destructive">{errors.offerButtonColor.message}</p>}
          </div>
        </section>

        <section className="space-y-4">
          <div className="space-y-1">
            <Label>Imagem da oferta para desktop</Label>
            <Controller
              control={control}
              name="offerImageDesktopUrl"
              render={({ field }) => (
                <ImageUploadField
                  webinarId={webinarId}
                  kind="desktop"
                  value={field.value ?? null}
                  onChange={field.onChange}
                />
              )}
            />
          </div>
          <div className="space-y-1">
            <Label>Imagem da oferta para mobile</Label>
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
        </section>

        <section className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1">
            <Label>Início da pitch</Label>
            <Controller
              control={control}
              name="pitchAtSec"
              render={({ field }) => (
                <SecondsInput
                  value={field.value ?? 0}
                  onChange={(v) => field.onChange(v === 0 ? null : v)}
                  aria-label="Início da pitch"
                />
              )}
            />
          </div>
          <div className="space-y-1">
            <Label>Tempo início da oferta</Label>
            <Controller
              control={control}
              name="offerShowAtSec"
              render={({ field }) => (
                <SecondsInput
                  value={field.value ?? 0}
                  onChange={(v) => field.onChange(v)}
                  aria-label="Tempo início da oferta"
                />
              )}
            />
          </div>
          <div className="space-y-1">
            <Label>Tempo do fim da oferta</Label>
            <Controller
              control={control}
              name="offerHideAtSec"
              render={({ field }) => (
                <SecondsInput
                  value={field.value ?? 0}
                  onChange={(v) => field.onChange(v === 0 ? null : v)}
                  aria-label="Tempo do fim da oferta"
                />
              )}
            />
            {errors.offerHideAtSec && <p className="text-xs text-destructive">{errors.offerHideAtSec.message}</p>}
          </div>
        </section>

        <section className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="offerLink">Link da oferta</Label>
            <Input id="offerLink" {...register("offerLink")} placeholder="https://" />
            {errors.offerLink && <p className="text-xs text-destructive">{errors.offerLink.message}</p>}
          </div>

          {(["offerPassUtms","offerDisabled","offerSameWindow","offerRaffleEnabled"] as const).map((key) => {
            const labels: Record<typeof key, string> = {
              offerPassUtms: "Repassar UTM's pro link da oferta",
              offerDisabled: "Desabilitar oferta",
              offerSameWindow: "Abrir o link na mesma janela do webinar",
              offerRaffleEnabled: "Habilitar sorteio"
            };
            return (
              <Controller
                key={key}
                control={control}
                name={key}
                render={({ field }) => (
                  <label className="flex items-center gap-3">
                    <Switch checked={Boolean(field.value)} onCheckedChange={field.onChange} aria-label={labels[key]} />
                    <span className="text-sm">{labels[key]}</span>
                  </label>
                )}
              />
            );
          })}

          {watched.offerRaffleEnabled && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Hora de início do sorteio</Label>
                <Controller
                  control={control}
                  name="offerRaffleAtSec"
                  render={({ field }) => (
                    <SecondsInput
                      value={field.value ?? 0}
                      onChange={(v) => field.onChange(v === 0 ? null : v)}
                      aria-label="Hora de início do sorteio"
                    />
                  )}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="offerRaffleNumber">Escolha o número do sorteio</Label>
                <Input
                  id="offerRaffleNumber"
                  {...register("offerRaffleNumber")}
                  placeholder=""
                />
                {errors.offerRaffleNumber && <p className="text-xs text-destructive">{errors.offerRaffleNumber.message}</p>}
              </div>
            </div>
          )}
        </section>

        <WizardNav webinarId={webinarId} step={5} submitting={pending} />
      </div>

      <aside className="space-y-4 lg:sticky lg:top-6 lg:h-fit">
        <h3 className="text-sm font-medium text-muted-foreground">Prévia da oferta</h3>
        <OfferPreviewDesktop
          offerTitle={watched.offerTitle ?? ""}
          offerPriceOriginal={watched.offerPriceOriginal ?? null}
          offerPriceFinal={watched.offerPriceFinal ?? null}
          offerButtonText={watched.offerButtonText ?? ""}
          offerButtonColor={watched.offerButtonColor ?? "#dc2626"}
          offerImageDesktopUrl={watched.offerImageDesktopUrl ?? null}
          offerImageMobileUrl={watched.offerImageMobileUrl ?? null}
          offerRaffleEnabled={Boolean(watched.offerRaffleEnabled)}
        />
        <OfferPreviewMobile
          offerTitle={watched.offerTitle ?? ""}
          offerPriceOriginal={watched.offerPriceOriginal ?? null}
          offerPriceFinal={watched.offerPriceFinal ?? null}
          offerButtonText={watched.offerButtonText ?? ""}
          offerButtonColor={watched.offerButtonColor ?? "#dc2626"}
          offerImageDesktopUrl={watched.offerImageDesktopUrl ?? null}
          offerImageMobileUrl={watched.offerImageMobileUrl ?? null}
          offerRaffleEnabled={Boolean(watched.offerRaffleEnabled)}
        />
      </aside>
    </form>
  );
}
