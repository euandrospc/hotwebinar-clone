"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertDialog, AlertDialogTrigger, AlertDialogContent,
  AlertDialogHeader, AlertDialogTitle, AlertDialogDescription,
  AlertDialogFooter, AlertDialogCancel, AlertDialogAction
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { deleteVideo } from "@/server/actions/video";

export function DeleteVideoDialog({ id, name, children }: { id: string; name: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [force, setForce] = useState(false);
  const [webinars, setWebinars] = useState<Array<{ id: string; title: string }>>([]);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function reset() {
    setWebinars([]);
    setForce(false);
  }

  async function onConfirm() {
    startTransition(async () => {
      const r = await deleteVideo(id, force);
      if ("ok" in r) {
        toast.success("Vídeo excluído");
        setOpen(false);
        reset();
        router.refresh();
        return;
      }
      if (r.error === "in_use" && r.webinars) {
        setWebinars(r.webinars);
        toast.warning(`Vídeo em uso por ${r.webinars.length} webinar(s). Ative "Forçar exclusão" para continuar.`);
        return;
      }
      toast.error(r.error);
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir vídeo?</AlertDialogTitle>
          <AlertDialogDescription>
            <strong>{name}</strong> será removido permanentemente, incluindo os arquivos no storage.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {webinars.length > 0 && (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
            <p className="font-medium text-destructive">
              Vídeo usado em {webinars.length} webinar(s):
            </p>
            <ul className="mt-1 ml-4 list-disc">
              {webinars.map((w) => <li key={w.id}>{w.title || w.id}</li>)}
            </ul>
            <label className="mt-3 flex items-center gap-2">
              <Switch checked={force} onCheckedChange={setForce} />
              <span>Forçar exclusão (webinars perderão referência ao vídeo)</span>
            </label>
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button variant="destructive" disabled={pending || (webinars.length > 0 && !force)} onClick={onConfirm}>
              {pending ? "Excluindo..." : webinars.length > 0 ? (force ? "Forçar exclusão" : "Excluir") : "Excluir"}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
