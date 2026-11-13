"use client";
import styles from "./wizard.module.css";
import { useState, useTransition } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { z } from "zod";
import {
  step4ExternalSchema, step4LibrarySchema, type Step4Input
} from "@/lib/validations/webinar";
import { updateWebinarStep4 } from "@/server/actions/webinar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { palcoCard, palcoError, palcoInput, palcoLabel, palcoTime, palcoTitle } from "./palco-fields";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { SecondsInput } from "@/components/ui/seconds-input";
import { WizardNav } from "@/components/wizard/wizard-nav";
import { LibraryPicker, type LibraryVideo } from "@/components/videos/library-picker";
import { ArrowLeft, ArrowRight } from "@/components/icons";
import { UploadDropzone } from "@/components/videos/upload-dropzone";

type Mode = "external" | "upload" | "library";

interface Step4FormProps {
  webinarId: string;
  initial: {
    mode: Mode;
    videoExternalUrl: string;
    selectedVideoId: string | null;
    pitchAtSec: number | undefined;
  };
  libraryVideos: LibraryVideo[];
}

const externalShape = step4ExternalSchema.omit({ mode: true });
type ExternalInput = z.infer<typeof externalShape>;

export function Step4Form({ webinarId, initial, libraryVideos }: Step4FormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [tab, setTab] = useState<Mode>(initial.mode);
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(initial.selectedVideoId);

  const externalForm = useForm<ExternalInput>({
    resolver: zodResolver(externalShape),
    defaultValues: {
      videoExternalUrl: initial.videoExternalUrl,
      pitchAtSec: initial.pitchAtSec
    }
  });

  function submit(input: Step4Input) {
    startTransition(async () => {
      const res = await updateWebinarStep4(webinarId, input);
      if ("ok" in res) router.push(`/dashboard/webinars/${webinarId}/step-5`);
      else toast.error(res.error.message);
    });
  }

  function onSubmitExternal(values: ExternalInput) {
    submit({ mode: "external", ...values });
  }

  function onFormSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (tab !== "external") {
      e.preventDefault();
      return;
    }
    void externalForm.handleSubmit(onSubmitExternal)(e);
  }

  function onLibrarySelect(videoId: string) {
    setSelectedVideoId(videoId);
  }

  function onLibraryContinue() {
    if (!selectedVideoId) {
      toast.error("Selecione um vídeo");
      return;
    }
    submit({
      mode: "library",
      videoId: selectedVideoId,
      pitchAtSec: externalForm.getValues("pitchAtSec")
    });
  }

  function onUploadReady(videoId: string) {
    setSelectedVideoId(videoId);
    submit({
      mode: "upload-complete",
      videoId,
      pitchAtSec: externalForm.getValues("pitchAtSec")
    });
  }

  return (
    <form onSubmit={onFormSubmit} className={`${palcoCard} w-full max-w-[760px]`}>
      <h2 className={palcoTitle}>Vídeo</h2>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Mode)}>
        <TabsList className="grid h-auto w-full grid-cols-3 gap-1 rounded-[10px] border border-[#1E241F] bg-[#070807] p-1">
          {([["external", "URL externa"], ["upload", "Enviar novo"], ["library", "Biblioteca"]] as const).map(([value, label]) => (
            <TabsTrigger key={value} value={value}
              className="h-[34px] rounded-lg text-[13px] font-semibold text-[#7C867E] hover:text-neutral-100 focus-visible:ring-palco/60 focus-visible:ring-offset-0 data-[state=active]:bg-[#1A1F1B] data-[state=active]:text-neutral-100 data-[state=active]:shadow-none motion-reduce:transition-none">
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="external" className="mt-[18px]">
          <div className="flex flex-col gap-2">
            <Label htmlFor="videoExternalUrl" className={palcoLabel}>URL do vídeo (mp4 / m3u8)</Label>
            <Input id="videoExternalUrl" className={palcoInput} {...externalForm.register("videoExternalUrl")} placeholder="https://cdn.example.com/v.mp4" />
            {externalForm.formState.errors.videoExternalUrl && (
              <p className={palcoError}>{externalForm.formState.errors.videoExternalUrl.message}</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="upload" className="mt-[18px]">
          <UploadDropzone onReady={onUploadReady} />
        </TabsContent>

        <TabsContent value="library" className="mt-[18px]">
          <LibraryPicker
            videos={libraryVideos}
            selectedId={selectedVideoId}
            onSelect={onLibrarySelect}
          />
        </TabsContent>
      </Tabs>

      <div className="flex flex-col items-start gap-2">
        <Label className={palcoLabel}>Momento “chegou no pitch”</Label>
        <Controller
          control={externalForm.control}
          name="pitchAtSec"
          render={({ field }) => (
            <SecondsInput value={field.value} onChange={field.onChange} aria-label="pitchAtSec" className={palcoTime} />
          )}
        />
        <p className="text-xs text-[#7C867E]">Horas · minutos · segundos do vídeo</p>
      </div>

      {tab === "external" && <WizardNav webinarId={webinarId} step={4} submitting={pending} />}
      {tab === "library" && (
        <div className={styles.navFooter}>
          <Button asChild variant="outline" type="button">
            <Link href={`/dashboard/webinars/${webinarId}/step-3`}><ArrowLeft className="h-4 w-4" /> Voltar</Link>
          </Button>
          <Button type="button" onClick={onLibraryContinue} disabled={pending || !selectedVideoId} className="bg-palco text-palco-ink hover:bg-palco/90">
            {pending ? "Salvando..." : (<>Continuar <ArrowRight className="h-4 w-4" /></>)}
          </Button>
        </div>
      )}
      {tab === "upload" && (
        <p className="text-xs text-[#7C867E]">Após o vídeo ficar pronto, ele será selecionado automaticamente para este webinar.</p>
      )}
    </form>
  );
}
