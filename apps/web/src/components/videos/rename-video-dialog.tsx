"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader,
  AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export function RenameVideoDialog({ open, onOpenChange, videoId, name }: {
  open: boolean; onOpenChange: (v: boolean) => void; videoId: string; name: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(name);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const trimmed = value.trim();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!trimmed || trimmed === name) return onOpenChange(false);
    setSaving(true);
    try {
      const res = await fetch(`/api/videos/${videoId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: trimmed })
      });
      if (!res.ok) throw new Error();
      toast.success("Vídeo renomeado");
      onOpenChange(false);
      router.refresh();
    } catch {
      toast.error("Não foi possível renomear o vídeo");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={(v) => { if (v) setValue(name); onOpenChange(v); }}>
      <AlertDialogContent onOpenAutoFocus={(e) => { e.preventDefault(); inputRef.current?.select(); }} className="max-w-md rounded-2xl border-[#1E241F] bg-[#0C0E0C] p-5 font-palco text-neutral-100">
        <form onSubmit={onSubmit} className="grid gap-4">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[15px] font-semibold">Renomear vídeo</AlertDialogTitle>
            <AlertDialogDescription className="text-[13px] text-neutral-400">O nome aparece apenas na sua biblioteca e no editor de webinars.</AlertDialogDescription>
          </AlertDialogHeader>
          <Input ref={inputRef} aria-label="Nome do vídeo" value={value} maxLength={255} className="h-[38px] rounded-[10px] border-[#1E241F] bg-[#070807] text-[13px] text-neutral-100 focus-visible:ring-palco" onChange={(e) => setValue(e.target.value)} />
          <AlertDialogFooter>
            <AlertDialogCancel type="button" className="h-9 rounded-[10px] border-[#1E241F] bg-transparent text-[13px] text-[#C9D1CA] hover:bg-[#121512] hover:text-neutral-100">Cancelar</AlertDialogCancel>
            <Button type="submit" className="h-9 rounded-[10px] bg-palco text-[13px] font-semibold text-palco-ink hover:bg-palco/90" disabled={saving || !trimmed}>{saving ? "Salvando..." : "Salvar"}</Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
