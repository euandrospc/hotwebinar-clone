"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader,
  AlertDialogTitle, AlertDialogDescription, AlertDialogFooter,
  AlertDialogCancel
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { setCustomThumb } from "@/server/actions/video";

export function ThumbEditDialog({
  open, onOpenChange, videoId, currentCustomThumbUrl
}: {
  open: boolean; onOpenChange: (v: boolean) => void; videoId: string; currentCustomThumbUrl: string | null;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function onUpload(file: File) {
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Thumb > 5 MB");
      return;
    }
    setUploading(true);
    try {
      const initRes = await fetch("/api/upload/thumb", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ videoId })
      });
      if (!initRes.ok) throw new Error("init failed");
      const { uploadUrl, key } = (await initRes.json()) as { uploadUrl: string; key: string };
      const put = await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      if (!put.ok) throw new Error(`upload failed (${put.status})`);
      // Compute public URL using S3_PUBLIC_BASE_URL via server action
      const publicBaseUrl = process.env.NEXT_PUBLIC_S3_PUBLIC_BASE_URL ?? "";
      const hlsBucket = process.env.NEXT_PUBLIC_S3_BUCKET_HLS ?? "hls-public";
      // Cache-bust: same key overwrites previous file in MinIO; append ?v= so browser refetches
      const customThumbUrl = `${publicBaseUrl}/${hlsBucket}/${key}?v=${Date.now()}`;
      const r = await setCustomThumb(videoId, customThumbUrl);
      if ("ok" in r) {
        toast.success("Thumbnail atualizada");
        router.refresh();
        onOpenChange(false);
      } else toast.error(r.error);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao enviar thumbnail");
    } finally {
      setUploading(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Editar thumbnail</AlertDialogTitle>
          <AlertDialogDescription>
            Envie uma imagem JPG/PNG (até 5 MB) ou deixe a thumbnail automática gerada pelo transcode.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {currentCustomThumbUrl && <img src={currentCustomThumbUrl} alt="thumb atual" className="aspect-video w-full rounded border object-cover" />}
        <div className="flex gap-2">
          <Button onClick={() => inputRef.current?.click()} disabled={uploading}>
            {uploading ? "Enviando..." : "Selecionar arquivo"}
          </Button>
          {currentCustomThumbUrl && (
            <Button
              variant="outline"
              onClick={async () => {
                await setCustomThumb(videoId, null);
                toast.success("Voltou para thumbnail automática");
                router.refresh();
                onOpenChange(false);
              }}
            >
              Voltar para auto
            </Button>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onUpload(f);
          }}
        />
        <AlertDialogFooter>
          <AlertDialogCancel>Fechar</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
