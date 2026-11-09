"use client";
import styles from "@/components/management-v2.module.css";
import { useState } from "react";
import { Plus } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { UploadDialog } from "./upload-dialog";

export function UploadButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button className={styles.primaryButton} onClick={() => setOpen(true)}>
        <Plus className="h-3.5 w-3.5" /> Enviar novo vídeo
      </Button>
      <UploadDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
