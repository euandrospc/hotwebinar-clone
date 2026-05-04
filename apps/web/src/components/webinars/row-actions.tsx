"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, Pencil, Files, Trash2, Users, BarChart3, MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { duplicateWebinar } from "@/server/actions/webinar";
import { DeleteConfirmDialog } from "./delete-confirm-dialog";

export function RowActions({
  id,
  title,
  slug,
  publicBaseUrl
}: {
  id: string;
  title: string;
  slug: string | null;
  publicBaseUrl: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  async function copyLink() {
    if (!slug) {
      toast.error("Defina o slug antes de copiar o link");
      return;
    }
    await navigator.clipboard.writeText(`${publicBaseUrl}/w/${slug}`);
    toast.success("Link copiado");
  }

  function onDuplicate() {
    startTransition(async () => {
      const r = await duplicateWebinar(id);
      if ("newId" in r) router.push(`/dashboard/webinars/${r.newId}/step-1`);
      else toast.error(r.error.message);
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={() => router.push(`/dashboard/webinars/${id}/step-1`)}>
          <Pencil className="mr-2 h-4 w-4" /> Editar
        </DropdownMenuItem>
        <DropdownMenuItem onClick={copyLink}>
          <Copy className="mr-2 h-4 w-4" /> Copiar link público
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onDuplicate} disabled={pending}>
          <Files className="mr-2 h-4 w-4" /> {pending ? "Duplicando..." : "Duplicar"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push(`/dashboard/webinars/${id}/leads`)}>
          <Users className="mr-2 h-4 w-4" /> Leads
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push(`/dashboard/webinars/${id}/metrics`)}>
          <BarChart3 className="mr-2 h-4 w-4" /> Métricas
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DeleteConfirmDialog id={id} title={title}>
          <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
            <Trash2 className="mr-2 h-4 w-4" /> Excluir
          </DropdownMenuItem>
        </DeleteConfirmDialog>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
