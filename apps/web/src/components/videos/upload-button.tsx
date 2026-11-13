"use client";
import { useState } from "react";
import { Upload } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { UploadDialog } from "./upload-dialog";

export function UploadButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button className="h-10 gap-2 rounded-[10px] bg-palco px-3.5 text-sm font-semibold text-palco-ink hover:bg-palco/90 focus-visible:ring-2 focus-visible:ring-palco focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0C0A]" onClick={() => setOpen(true)}>
        <Upload aria-hidden="true" className="h-4 w-4" /> Enviar novo vídeo
      </Button>
      <UploadDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
