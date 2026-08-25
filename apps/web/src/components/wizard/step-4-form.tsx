"use client";
import { useState, useTransition } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { z } from "zod";
import {
  step4ExternalSchema, step4LibrarySchema, type Step4Input
} from "@/lib/validations/webinar";
import { updateWebinarStep4 } from "@/server/actions/webinar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { SecondsInput } from "@/components/ui/seconds-input";
import { WizardNav } from "@/components/wizard/wizard-nav";
import { LibraryPicker, type LibraryVideo } from "@/components/videos/library-picker";
import { ArrowLeft, ArrowRight } from "lucide-react";
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
    <form onSubmit={onFormSubmit} className="max-w-3xl space-y-6">
      <h2 className="text-2xl font-semibold">Vídeo</h2>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Mode)}>
        <TabsList>
          <TabsTrigger value="external">URL externa</TabsTrigger>
          <TabsTrigger value="upload">Enviar novo</TabsTrigger>
          <TabsTrigger value="library">Biblioteca</TabsTrigger>
        </TabsList>

        <TabsContent value="external" className="mt-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="videoExternalUrl">URL do vídeo (mp4 / m3u8)</Label>
            <Input id="videoExternalUrl" {...externalForm.register("videoExternalUrl")} placeholder="https://cdn.example.com/v.mp4" />
            {externalForm.formState.errors.videoExternalUrl && (
              <p className="text-sm text-destructive">{externalForm.formState.errors.videoExternalUrl.message}</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="upload" className="mt-4 space-y-4">
          <UploadDropzone onReady={onUploadReady} />
        </TabsContent>

        <TabsContent value="library" className="mt-4 space-y-4">
          <LibraryPicker
            videos={libraryVideos}
            selectedId={selectedVideoId}
            onSelect={onLibrarySelect}
          />
        </TabsContent>
      </Tabs>

      <div className="space-y-2">
        <Label>Momento "chegou no pitch"</Label>
        <Controller
          control={externalForm.control}
          name="pitchAtSec"
          render={({ field }) => (
            <SecondsInput value={field.value} onChange={field.onChange} aria-label="pitchAtSec" />
          )}
        />
      </div>

      {tab === "external" && <WizardNav webinarId={webinarId} step={4} submitting={pending} />}
      {tab === "library" && (
        <div className="mt-8 flex items-center justify-between border-t pt-4">
          <a href={`/dashboard/webinars/${webinarId}/step-3`} className="inline-flex items-center gap-1 rounded-md border px-4 py-2 text-sm"><ArrowLeft className="h-4 w-4" /> Voltar</a>
          <button
            type="button"
            onClick={onLibraryContinue}
            disabled={pending || !selectedVideoId}
            className="inline-flex items-center gap-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {pending ? "Salvando..." : (<>Continuar <ArrowRight className="h-4 w-4" /></>)}
          </button>
        </div>
      )}
      {tab === "upload" && (
        <p className="text-xs text-muted-foreground">Após o vídeo ficar pronto, ele será selecionado automaticamente para este webinar.</p>
      )}
    </form>
  );
}
