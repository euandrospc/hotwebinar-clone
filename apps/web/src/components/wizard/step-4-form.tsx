"use client";
import { useTransition } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { step4Schema, type Step4Input } from "@/lib/validations/webinar";
import { updateWebinarStep4 } from "@/server/actions/webinar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { SecondsInput } from "@/components/ui/seconds-input";
import { WizardNav } from "@/components/wizard/wizard-nav";

export interface Step4FormProps {
  webinarId: string;
  initial: Step4Input;
}

export function Step4Form({ webinarId, initial }: Step4FormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
    setError
  } = useForm<Step4Input>({
    resolver: zodResolver(step4Schema),
    defaultValues: initial
  });

  const url = watch("videoExternalUrl");

  function onSubmit(values: Step4Input) {
    startTransition(async () => {
      const res = await updateWebinarStep4(webinarId, values);
      if ("ok" in res) {
        router.push(`/dashboard/webinars/${webinarId}/step-5`);
      } else if (res.error.field) {
        setError(res.error.field as keyof Step4Input, { message: res.error.message });
      } else {
        toast.error(res.error.message);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-3xl space-y-6">
      <h2 className="text-2xl font-semibold">Vídeo</h2>

      <Tabs defaultValue="external">
        <TabsList>
          <TabsTrigger value="external">URL externa</TabsTrigger>
          <TabsTrigger value="upload" disabled>
            Upload <Badge variant="outline" className="ml-2">Em breve — sub-plan B2</Badge>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="external" className="mt-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="videoExternalUrl">URL do vídeo (mp4 / m3u8)</Label>
            <Input id="videoExternalUrl" {...register("videoExternalUrl")} placeholder="https://cdn.example.com/v.mp4" />
            {errors.videoExternalUrl && <p className="text-sm text-destructive">{errors.videoExternalUrl.message}</p>}
          </div>
          {url ? (
            <div className="overflow-hidden rounded-md border bg-black">
              <video src={url} controls className="h-64 w-full" />
            </div>
          ) : null}
        </TabsContent>
      </Tabs>

      <div className="space-y-2">
        <Label>Momento "chegou no pitch"</Label>
        <Controller
          control={control}
          name="pitchAtSec"
          render={({ field }) => (
            <SecondsInput
              value={field.value}
              onChange={field.onChange}
              aria-label="pitchAtSec"
            />
          )}
        />
        <p className="text-xs text-muted-foreground">
          Tempo (mm:ss) em que o lead atinge o pitch — usado pelo funil.
        </p>
      </div>

      <WizardNav webinarId={webinarId} step={4} submitting={pending} />
    </form>
  );
}
