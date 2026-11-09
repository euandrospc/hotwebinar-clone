"use client";
import styles from "@/components/management-v2.module.css";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel
} from "@/components/ui/alert-dialog";
import { UploadDropzone } from "./upload-dropzone";

export function UploadDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const router = useRouter();
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className={styles.dialog}>
        <AlertDialogHeader>
          <AlertDialogTitle>Enviar novo vídeo</AlertDialogTitle>
          <AlertDialogDescription>
            Envie seu arquivo. O vídeo fica disponível na biblioteca assim que o processamento terminar.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <UploadDropzone onReady={() => { router.refresh(); }} />
        <AlertDialogFooter>
          <AlertDialogCancel className={styles.secondaryButton}>Fechar</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
