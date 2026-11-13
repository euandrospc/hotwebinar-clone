"use client";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Trash2, Upload } from "@/components/icons";

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
        <img src={value} alt={`Imagem ${kind === "desktop" ? "desktop" : "mobile"}`} className="h-[150px] w-full rounded-lg bg-[#0B0D10] object-cover" />
        <button type="button" onClick={() => onChange(null)}
          className="inline-flex h-[34px] items-center gap-2 rounded-[10px] border border-[#DC2626]/35 bg-[#DC2626]/[0.08] px-3.5 text-[13px] font-bold text-[#F87171] transition-colors hover:bg-[#DC2626]/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F87171]/60 motion-reduce:transition-none">
          <Trash2 className="h-[15px] w-[15px]" /> Excluir imagem
        </button>
      </div>
    );
  }

  return (
    <label className="flex w-full cursor-pointer flex-col items-center gap-2 rounded-[10px] border border-dashed border-[#1E241F] bg-[#070807] px-6 py-8 text-center text-[13px] text-neutral-100 transition-colors hover:border-[#2E3630] hover:bg-[#0F120F] focus-within:ring-2 focus-within:ring-palco/60 motion-reduce:transition-none">
      <Upload className="h-6 w-6 text-[#7C867E]" />
      <span className="font-semibold">{uploading ? "Enviando..." : "Clique para selecionar."}</span>
      {recommendedHint ? (
        <span className="text-xs text-[#7C867E]">As dimensões recomendadas são {recommendedHint}</span>
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
