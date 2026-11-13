"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Image as ImageIcon, RefreshCw, Trash2, MoreHorizontal, Play, Pencil } from "@/components/icons";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { retryTranscode } from "@/server/actions/video";
import { DeleteVideoDialog } from "./delete-video-dialog";
import { ThumbEditDialog } from "./thumb-edit-dialog";
import { VideoPreviewDialog } from "./video-preview-dialog";
import { RenameVideoDialog } from "./rename-video-dialog";

export function VideoRowActions({
  id, name, status, customThumbUrl, hlsUrl
}: {
  id: string; name: string; status: "QUEUED" | "PROCESSING" | "READY" | "FAILED"; customThumbUrl: string | null; hlsUrl: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [thumbOpen, setThumbOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);

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
          <Button variant="ghost" size="icon" aria-label={`Ações de ${name}`} className="h-[34px] w-[34px] rounded-lg border border-[#1E241F] text-neutral-400 hover:bg-[#121512] hover:text-neutral-100 focus-visible:ring-2 focus-visible:ring-palco"><MoreHorizontal className="h-4 w-4" /></Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={6} className="w-[216px] rounded-xl border-[#1E241F] bg-[#0C0E0C] p-1.5 text-[#C9D1CA] shadow-xl [&_[role=menuitem]:focus]:bg-[#121512] [&_[role=menuitem]:focus]:text-neutral-100 [&_[role=menuitem]]:min-h-[34px] [&_[role=menuitem]]:rounded-lg [&_[role=menuitem]]:text-[13px]">
          {status === "READY" && hlsUrl && (
            <DropdownMenuItem onClick={() => setPreviewOpen(true)}>
              <Play className="h-3.5 w-3.5" /> Preview
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => setRenameOpen(true)}>
            <Pencil className="h-3.5 w-3.5" /> Renomear
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setThumbOpen(true)}>
            <ImageIcon className="h-3.5 w-3.5" /> Editar thumbnail
          </DropdownMenuItem>
          {status === "FAILED" && (
            <DropdownMenuItem onClick={onRetry} disabled={pending}>
              <RefreshCw className="h-3.5 w-3.5" /> {pending ? "..." : "Tentar novamente"}
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator className="bg-[#1A1F1B]" />
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
      <RenameVideoDialog open={renameOpen} onOpenChange={setRenameOpen} videoId={id} name={name} />
      <VideoPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        name={name}
        hlsUrl={hlsUrl}
      />
    </>
  );
}
