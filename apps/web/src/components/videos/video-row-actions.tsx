"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Image as ImageIcon, RefreshCw, Trash2, MoreHorizontal } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { retryTranscode } from "@/server/actions/video";
import { DeleteVideoDialog } from "./delete-video-dialog";
import { ThumbEditDialog } from "./thumb-edit-dialog";

export function VideoRowActions({
  id, name, status, customThumbUrl
}: {
  id: string; name: string; status: "QUEUED" | "PROCESSING" | "READY" | "FAILED"; customThumbUrl: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [thumbOpen, setThumbOpen] = useState(false);

  function onRetry() {
    startTransition(async () => {
      const r = await retryTranscode(id);
      if ("ok" in r) {
        toast.success("Reenviado para processamento");
        router.refresh();
      } else toast.error(r.error);
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={() => setThumbOpen(true)}>
            <ImageIcon className="mr-2 h-4 w-4" /> Editar thumbnail
          </DropdownMenuItem>
          {status === "FAILED" && (
            <DropdownMenuItem onClick={onRetry} disabled={pending}>
              <RefreshCw className="mr-2 h-4 w-4" /> {pending ? "..." : "Tentar novamente"}
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DeleteVideoDialog id={id} name={name}>
            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
              <Trash2 className="mr-2 h-4 w-4" /> Excluir
            </DropdownMenuItem>
          </DeleteVideoDialog>
        </DropdownMenuContent>
      </DropdownMenu>
      <ThumbEditDialog
        open={thumbOpen}
        onOpenChange={setThumbOpen}
        videoId={id}
        currentCustomThumbUrl={customThumbUrl}
      />
    </>
  );
}
