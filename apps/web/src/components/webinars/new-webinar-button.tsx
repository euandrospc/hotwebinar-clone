"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { createDraftWebinar } from "@/server/actions/webinar";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function NewWebinarButton({ className, label = "Criar novo" }: { className?: string; label?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      className={cn("h-[34px] rounded-lg px-3 text-xs", className)}
      onClick={() =>
        startTransition(async () => {
          try {
            const { id } = await createDraftWebinar();
            router.push(`/dashboard/webinars/${id}/step-1`);
          } catch {
            toast.error("Não foi possível criar o webinar. Tente novamente.");
          }
        })
      }
      disabled={pending}
    >
      <Plus className="mr-2 h-4 w-4" /> {pending ? "Criando..." : label}
    </Button>
  );
}
