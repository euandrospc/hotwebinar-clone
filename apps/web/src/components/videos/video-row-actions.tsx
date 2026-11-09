"use client";
import styles from "@/components/management-v2.module.css";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Image as ImageIcon, RefreshCw, Trash2, MoreHorizontal, Play } from "@/components/icons";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { retryTranscode } from "@/server/actions/video";
import { DeleteVideoDialog } from "./delete-video-dialog";
import { ThumbEditDialog } from "./thumb-edit-dialog";
import { VideoPreviewDialog } from "./video-preview-dialog";

export function VideoRowActions({
  id, name, status, customThumbUrl, hlsUrl
}: {
  id: string; name: string; status: "QUEUED" | "PROCESSING" | "READY" | "FAILED"; customThumbUrl: string | null; hlsUrl: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [thumbOpen, setThumbOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

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
          <Button variant="ghost" size="icon" aria-label={`Ações de ${name}`} className={styles.iconButton}><MoreHorizontal className="h-4 w-4" /></Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className={styles.menu} align="end" sideOffset={6}>
          {status === "READY" && hlsUrl && (
            <DropdownMenuItem onClick={() => setPreviewOpen(true)}>
              <Play className="h-3.5 w-3.5" /> Preview
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => setThumbOpen(true)}>
            <ImageIcon className="h-3.5 w-3.5" /> Editar thumbnail
          </DropdownMenuItem>
          {status === "FAILED" && (
            <DropdownMenuItem onClick={onRetry} disabled={pending}>
              <RefreshCw className="h-3.5 w-3.5" /> {pending ? "..." : "Tentar novamente"}
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DeleteVideoDialog id={id} name={name}>
            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
              <Trash2 className="h-3.5 w-3.5" /> Excluir
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
      <VideoPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        name={name}
        hlsUrl={hlsUrl}
      />
    </>
  );
}
