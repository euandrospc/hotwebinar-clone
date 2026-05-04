"use client";
import { useState, useTransition } from "react";
import { useForm, Controller, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { step6Schema, type Step6Input } from "@/lib/validations/webinar";
import { updateWebinarStep6, publishWebinar } from "@/server/actions/webinar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SecondsInput } from "@/components/ui/seconds-input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from "@/components/ui/alert-dialog";

export interface Step6FormProps {
  webinarId: string;
  initial: Step6Input;
}

export function Step6Form({ webinarId, initial }: Step6FormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [tsv, setTsv] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const {
    register,
    handleSubmit,
    control,
    formState: { errors }
  } = useForm<Step6Input>({
    resolver: zodResolver(step6Schema),
    defaultValues: initial
  });
  const { fields, append, remove } = useFieldArray({ control, name: "messages" });

  function onSubmit(values: Step6Input) {
    startTransition(async () => {
      const r1 = await updateWebinarStep6(webinarId, values);
      if (!("ok" in r1)) {
        toast.error(r1.error.message);
        return;
      }
      const r2 = await publishWebinar(webinarId);
      if ("ok" in r2) {
        toast.success("Webinar publicado");
        router.push("/dashboard/webinars");
      } else {
        toast.error(r2.error.message);
      }
    });
  }

  function importTsv() {
    const rows = tsv
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => line.split("\t"));
    for (const cols of rows) {
      if (cols.length >= 3) {
        const [authorName, text, secStr] = cols;
        const showAtSec = Number.parseInt(secStr, 10);
        if (!Number.isNaN(showAtSec)) {
          append({ authorName, text, showAtSec, isOwner: false });
        }
      }
    }
    setTsv("");
    setImportOpen(false);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Chat scriptado</h2>
        <AlertDialog open={importOpen} onOpenChange={setImportOpen}>
          <AlertDialogTrigger asChild>
            <Button type="button" variant="outline">Importar TSV</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Importar mensagens (TSV)</AlertDialogTitle>
              <AlertDialogDescription>
                Cola linhas no formato <code>nome[TAB]mensagem[TAB]segundos</code>. Uma por linha.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <textarea
              value={tsv}
              onChange={(e) => setTsv(e.target.value)}
              className="h-40 w-full rounded-md border p-2 font-mono text-sm"
            />
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={importTsv}>Importar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <p className="text-sm text-muted-foreground">
        Use <code>{"{lead.name}"}</code> na mensagem para personalizar com o nome do lead (renderizado pelo player na sub-plan C).
      </p>

      <div className="space-y-3">
        {fields.map((f, i) => (
          <div key={f.id} className="grid grid-cols-12 items-end gap-2 rounded-md border p-3">
            <div className="col-span-3 space-y-1">
              <Label htmlFor={`messages.${i}.authorName`}>Autor</Label>
              <Input id={`messages.${i}.authorName`} {...register(`messages.${i}.authorName` as const)} />
              {errors.messages?.[i]?.authorName && (
                <p className="text-xs text-destructive">{errors.messages[i]?.authorName?.message}</p>
              )}
            </div>
            <div className="col-span-6 space-y-1">
              <Label htmlFor={`messages.${i}.text`}>Mensagem</Label>
              <Input id={`messages.${i}.text`} {...register(`messages.${i}.text` as const)} />
              {errors.messages?.[i]?.text && (
                <p className="text-xs text-destructive">{errors.messages[i]?.text?.message}</p>
              )}
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Mostrar</Label>
              <Controller
                control={control}
                name={`messages.${i}.showAtSec` as const}
                render={({ field }) => <SecondsInput value={field.value} onChange={field.onChange} aria-label="Mostrar" />}
              />
            </div>
            <div className="col-span-1">
              <Button type="button" variant="ghost" size="icon" onClick={() => remove(i)} aria-label="Remover">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={() => append({ authorName: "", text: "", showAtSec: 0, isOwner: false })}
      >
        <Plus className="mr-2 h-4 w-4" /> Adicionar mensagem
      </Button>

      <div className="mt-8 flex items-center justify-between border-t pt-4">
        <Button asChild variant="outline" type="button">
          <a href={`/dashboard/webinars/${webinarId}/step-5`}>← Voltar</a>
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando..." : "Salvar e Ativar"}
        </Button>
      </div>
    </form>
  );
}
