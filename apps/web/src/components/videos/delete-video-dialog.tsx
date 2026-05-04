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

  async function onConfirm() {
    startTransition(async () => {
      const r = await deleteVideo(id, force);
      if ("ok" in r) {
        toast.success("Vídeo excluído");
        setOpen(false);
        router.refresh();
        return;
      }
      if (r.error === "in_use" && r.webinars) {
        setWebinars(r.webinars);
        return;
      }
      toast.error(r.error);
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir vídeo?</AlertDialogTitle>
          <AlertDialogDescription>
            <strong>{name}</strong> será removido permanentemente, incluindo os arquivos no storage.
            {webinars.length > 0 && (
              <>
                <p className="mt-3">Vídeo usado em {webinars.length} webinar(s):</p>
                <ul className="mt-1 ml-4 list-disc text-sm">
                  {webinars.map((w) => <li key={w.id}>{w.title || w.id}</li>)}
                </ul>
                <label className="mt-3 flex items-center gap-2 text-sm">
                  <Switch checked={force} onCheckedChange={setForce} />
                  Forçar exclusão (webinars perderão referência ao vídeo)
                </label>
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button variant="destructive" disabled={pending || (webinars.length > 0 && !force)} onClick={onConfirm}>
              {pending ? "Excluindo..." : "Excluir"}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
