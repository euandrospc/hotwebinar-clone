"use client";
import { useTransition } from "react";
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
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { deleteWebinar } from "@/server/actions/webinar";

export function DeleteConfirmDialog({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir webinar?</AlertDialogTitle>
          <AlertDialogDescription>
            Você está prestes a excluir <strong>{title || "Sem título"}</strong>. Essa ação é permanente e remove chats + CTAs + leads associados.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const r = await deleteWebinar(id);
                  if ("ok" in r) {
                    toast.success("Webinar excluído");
                    router.refresh();
                  } else toast.error(r.error.message);
                })
              }
            >
              {pending ? "Excluindo..." : "Excluir"}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
