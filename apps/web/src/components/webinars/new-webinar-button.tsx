"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createDraftWebinar } from "@/server/actions/webinar";

export function NewWebinarButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      onClick={() =>
        startTransition(async () => {
          const { id } = await createDraftWebinar();
          router.push(`/dashboard/webinars/${id}/step-1`);
        })
      }
      disabled={pending}
    >
      <Plus className="mr-2 h-4 w-4" /> {pending ? "Criando..." : "Criar novo"}
    </Button>
  );
}
