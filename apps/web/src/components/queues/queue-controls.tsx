"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Play, RefreshCw, RotateCcw, X } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { clearFailedQueueJobs, retryFailedQueueJobs, setQueuePaused } from "@/server/actions/queues";

const REFRESH_MS = 5_000;
const buttonClass = "h-[34px] rounded-lg px-3 text-xs";

type Result = { ok: true } | { error: { message: string } };

/** Header actions plus a quiet refresh while the tab is visible. */
export function QueueControls({ available, paused, failed }: { available: boolean; paused: boolean; failed: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [router]);

  function run(action: () => Promise<Result>, success: string) {
    startTransition(async () => {
      const result = await action();
      if ("ok" in result) toast.success(success);
      else toast.error(result.error.message);
      router.refresh();
    });
  }

  return (
    <>
      <Button variant="outline" className={buttonClass} disabled={pending} onClick={() => startTransition(() => router.refresh())}>
        <RefreshCw className="h-3.5 w-3.5" />Atualizar
      </Button>
      {available && failed > 0 && (
        <>
          <Button variant="outline" className={buttonClass} disabled={pending}
            onClick={() => run(retryFailedQueueJobs, "Falhas reenviadas para a fila")}>
            <RotateCcw className="h-3.5 w-3.5" />Reprocessar falhas
          </Button>
          <Button variant="outline" className={buttonClass} disabled={pending} onClick={() => setConfirmClear(true)}>
            <X className="h-3.5 w-3.5" />Limpar falhas
          </Button>
        </>
      )}
      {available && (
        <Button variant="outline" className={buttonClass} disabled={pending} aria-pressed={paused}
          onClick={() => run(() => setQueuePaused(!paused), paused ? "Fila retomada" : "Fila pausada")}>
          {paused ? <Play className="h-3.5 w-3.5" /> : <span aria-hidden="true" className="flex h-3.5 w-3.5 items-center justify-center gap-[3px]"><span className="h-2.5 w-[3px] rounded-sm bg-current" /><span className="h-2.5 w-[3px] rounded-sm bg-current" /></span>}
          {paused ? "Retomar fila" : "Pausar fila"}
        </Button>
      )}
      <AlertDialog open={confirmClear} onOpenChange={setConfirmClear}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Limpar jobs com falha?</AlertDialogTitle>
            <AlertDialogDescription>
              Os {failed} job{failed === 1 ? "" : "s"} com falha saem da fila e não poderão mais ser reprocessados por aqui.
              O histórico de disparos de cada webinar é preservado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => run(clearFailedQueueJobs, "Falhas removidas da fila")}>Limpar falhas</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
