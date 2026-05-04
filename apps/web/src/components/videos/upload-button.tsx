"use client";
import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UploadDialog } from "./upload-dialog";

export function UploadButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="mr-2 h-4 w-4" /> Enviar novo vídeo
      </Button>
      <UploadDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
