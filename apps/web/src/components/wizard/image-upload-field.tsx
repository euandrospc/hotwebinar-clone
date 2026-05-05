"use client";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Trash2, Upload } from "lucide-react";

interface Props {
  webinarId: string;
  kind: "desktop" | "mobile";
  value: string | null;
  onChange: (next: string | null) => void;
  recommendedHint?: string;
}

export function ImageUploadField({ webinarId, kind, value, onChange, recommendedHint }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File) {
    setUploading(true);
    try {
      const presignRes = await fetch("/api/upload/offer-image", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ webinarId, kind, mimeType: file.type, sizeBytes: file.size })
      });
      if (!presignRes.ok) {
        const err = await presignRes.json().catch(() => ({}));
        toast.error(err.message ?? "Falha ao iniciar upload");
        return;
      }
      const { uploadUrl, publicUrl } = await presignRes.json();
      const putRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "content-type": file.type },
        body: file
      });
      if (!putRes.ok) {
        toast.error("Falha ao enviar imagem");
        return;
      }
      onChange(publicUrl);
      toast.success("Imagem enviada");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  if (value) {
    return (
      <div className="space-y-2">
        <img src={value} alt={`Imagem ${kind === "desktop" ? "desktop" : "mobile"}`} className="aspect-video w-full max-w-md rounded-lg border object-cover" />
        <Button type="button" variant="destructive" size="sm" onClick={() => onChange(null)}>
          <Trash2 className="mr-2 h-4 w-4" /> Excluir imagem
        </Button>
      </div>
    );
  }

  return (
    <label className="flex w-full cursor-pointer flex-col items-center gap-2 rounded-md border border-dashed bg-muted/30 px-6 py-8 text-center text-sm hover:bg-muted/50">
      <Upload className="h-6 w-6 opacity-60" />
      <span className="font-medium">Clique para selecionar.</span>
      {recommendedHint ? (
        <span className="text-xs text-muted-foreground">As dimensões recomendadas são {recommendedHint}</span>
      ) : null}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        aria-label={`Imagem ${kind === "desktop" ? "desktop" : "mobile"}`}
        className="sr-only"
        disabled={uploading}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
        }}
      />
    </label>
  );
}
